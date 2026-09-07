import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { WorkspaceMember, WorkspaceRole } from '../../core/models/workspace-member.model';
import { WorkspaceMemberService } from '../../core/services/workspace-member.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';
import { UserSearchService } from '../../core/services/user-search.service';
import { ToastService } from '../../core/services/toast.service';
import { AppUser } from '../../core/models/app.-user.model';
import { WorkspaceInvitationService } from '../../core/services/workspace-invitaion.service';

type InviteRole = Exclude<WorkspaceRole, 'owner'>;

type InviteMode = 'existing' | 'email';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss',
})
export class MembersComponent implements OnInit, OnDestroy {
  workspaceService = inject(WorkspaceService);
  permissionService = inject(WorkspacePermissionService);
  private memberService = inject(WorkspaceMemberService);
  private invitationService = inject(WorkspaceInvitationService);
  private userSearchService = inject(UserSearchService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  members: WorkspaceMember[] = [];
  inviteMode: InviteMode = 'existing';
  showInviteModal = false;
  inviting = false;
  userSearch = '';
  searchingUsers = false;
  userResults: AppUser[] = [];
  selectedUser: AppUser | null = null;

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private searchRequestId = 0;

  inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['member' as InviteRole, Validators.required],
  });

  ngOnInit(): void {
    this.memberService.getMembers().subscribe((members) => {
      this.members = members;
    });

    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((search) => {
        void this.performUserSearch(search);
      });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();

    this.searchSubject.complete();
  }

  openInviteModal(): void {
    if (!this.permissionService.canManageMembers()) {
      this.toast.error('You do not have permission to invite members.');

      return;
    }

    if (!this.workspaceService.currentWorkspace()) {
      this.toast.error('Select a workspace first.');

      return;
    }

    this.resetInviteModal();

    this.showInviteModal = true;
  }

  closeInviteModal(): void {
    if (this.inviting) {
      return;
    }

    this.showInviteModal = false;

    this.resetInviteModal();
  }

  setInviteMode(mode: InviteMode): void {
    this.inviteMode = mode;

    this.userSearch = '';
    this.userResults = [];
    this.selectedUser = null;
    this.searchingUsers = false;

    this.searchRequestId++;

    this.inviteForm.reset({
      email: '',
      role: 'member',
    });
  }

  onUserSearch(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.userSearch = input.value;

    this.selectedUser = null;

    if (this.userSearch.trim().length < 2) {
      this.userResults = [];
      this.searchingUsers = false;

      this.searchRequestId++;

      return;
    }

    this.searchingUsers = true;

    this.searchSubject.next(this.userSearch);
  }

  private async performUserSearch(search: string): Promise<void> {
    const normalizedSearch = search.trim();

    if (normalizedSearch.length < 2) {
      this.userResults = [];
      this.searchingUsers = false;

      return;
    }

    const requestId = ++this.searchRequestId;

    try {
      const users = await this.userSearchService.searchUsers(normalizedSearch);

      if (requestId !== this.searchRequestId) {
        return;
      }

      const memberIds = new Set(this.members.map((member) => member.userId));

      this.userResults = users.filter((user) => !memberIds.has(user.uid)).slice(0, 5);
    } catch (error) {
      console.error('Unable to search users:', error);

      if (requestId === this.searchRequestId) {
        this.userResults = [];

        this.toast.error('Unable to search users.');
      }
    } finally {
      if (requestId === this.searchRequestId) {
        this.searchingUsers = false;
      }
    }
  }

  selectUser(user: AppUser): void {
    this.selectedUser = user;

    this.userSearch = user.displayName || user.email;

    this.userResults = [];

    this.inviteForm.controls.email.setValue(user.email);
  }

  clearSelectedUser(): void {
    this.selectedUser = null;

    this.userSearch = '';

    this.userResults = [];

    this.inviteForm.controls.email.setValue('');
  }

  async inviteMember(): Promise<void> {
    if (!this.permissionService.canManageMembers()) {
      this.toast.error('You do not have permission to invite members.');

      return;
    }

    if (this.inviteMode === 'existing' && !this.selectedUser) {
      this.toast.error('Select a user first.');

      return;
    }

    if (this.inviteForm.invalid || this.inviting) {
      this.inviteForm.markAllAsTouched();

      return;
    }

    const value = this.inviteForm.getRawValue();

    this.inviting = true;

    try {
      await this.invitationService.createInvitation(value.email, value.role);

      this.toast.success('Invitation sent.');

      this.showInviteModal = false;

      this.resetInviteModal();
    } catch (error) {
      console.error(error);

      const message = error instanceof Error ? error.message : 'Unable to send invitation.';

      this.toast.error(message);
    } finally {
      this.inviting = false;
    }
  }

  async changeRole(member: WorkspaceMember, event: Event): Promise<void> {
    if (!member.id || member.role === 'owner') {
      return;
    }

    if (!this.permissionService.canManageMembers()) {
      this.toast.error('You do not have permission to change member roles.');

      return;
    }

    const target = event.target as HTMLSelectElement;

    const role = target.value as InviteRole;

    try {
      await this.memberService.updateRole(member.id, role);

      this.toast.success('Member role updated.');
    } catch (error) {
      console.error(error);

      this.toast.error('Unable to update member role.');
    }
  }

  async removeMember(member: WorkspaceMember): Promise<void> {
    if (!member.id || member.role === 'owner') {
      return;
    }

    if (!this.permissionService.canManageMembers()) {
      this.toast.error('You do not have permission to remove members.');

      return;
    }

    const confirmed = confirm(`Remove ${member.displayName || member.email} from this workspace?`);

    if (!confirmed) {
      return;
    }

    try {
      await this.memberService.removeMember(member.id);

      this.toast.success('Member removed.');
    } catch (error) {
      console.error(error);

      this.toast.error('Unable to remove member.');
    }
  }

  getInitial(member: WorkspaceMember): string {
    return (member.displayName || member.email || '?').charAt(0).toUpperCase();
  }

  getUserInitial(user: AppUser): string {
    return (user.displayName || user.email || '?').charAt(0).toUpperCase();
  }

  private resetInviteModal(): void {
    this.inviteMode = 'existing';

    this.userSearch = '';
    this.userResults = [];
    this.selectedUser = null;
    this.searchingUsers = false;

    this.searchRequestId++;

    this.inviteForm.reset({
      email: '',
      role: 'member',
    });
  }
}
