import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Client } from '../../core/models/client.model';
import { WorkspaceRole, WorkspaceUserType } from '../../core/models/workspace-member.model';
import { WorkspaceUser } from '../../core/models/workspace-user.model';
import { ClientService } from '../../core/services/client.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspaceInvitationService } from '../../core/services/workspace-invitaion.service';
import { WorkspaceMemberService } from '../../core/services/workspace-member.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';
import { WorkspaceUserService } from '../../core/services/workspace-user.service';

type UserFilter = 'all' | WorkspaceUserType;

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private fb = inject(FormBuilder);
  private workspaceUserService = inject(WorkspaceUserService);
  private workspaceMemberService = inject(WorkspaceMemberService);
  private workspaceInvitationService = inject(WorkspaceInvitationService);
  private clientService = inject(ClientService);
  private topbarService = inject(TopbarService);
  private toast = inject(ToastService);
  readonly permissions = inject(WorkspacePermissionService);

  users = signal<WorkspaceUser[]>([]);
  loading = signal(true);
  search = signal('');
  activeFilter = signal<UserFilter>('all');
  updatingUserId = signal<string | null>(null);
  createDrawerOpen = signal(false);
  creatingUser = signal(false);
  removalUser = signal<WorkspaceUser | null>(null);
  removingUser = signal(false);

  readonly filters: { label: string; value: UserFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Workers', value: 'worker' },
    { label: 'Clients', value: 'client' },
    { label: 'Contractors', value: 'contractor' },
    { label: 'Guests', value: 'guest' },
  ];

  readonly userTypes: {
    value: WorkspaceUserType;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: 'worker',
      label: 'Worker',
      description: 'Internal workspace team member.',
      icon: 'fa-solid fa-user-gear',
    },
    {
      value: 'client',
      label: 'Client',
      description: 'Customer or company contact.',
      icon: 'fa-solid fa-briefcase',
    },
    {
      value: 'contractor',
      label: 'Contractor',
      description: 'External worker or specialist.',
      icon: 'fa-solid fa-screwdriver-wrench',
    },
    {
      value: 'guest',
      label: 'Guest',
      description: 'Limited workspace participant.',
      icon: 'fa-regular fa-eye',
    },
  ];

  readonly roles: {
    value: Exclude<WorkspaceRole, 'owner'>;
    label: string;
    description: string;
  }[] = [
    {
      value: 'admin',
      label: 'Admin',
      description: 'Manage users and workspace content.',
    },
    {
      value: 'manager',
      label: 'Manager',
      description: 'Manage projects, tasks and assignments.',
    },
    {
      value: 'member',
      label: 'Member',
      description: 'Create and update workspace content.',
    },
    {
      value: 'viewer',
      label: 'Viewer',
      description: 'View workspace content with limited access.',
    },
  ];

  newUserForm = this.fb.nonNullable.group({
    type: ['worker' as WorkspaceUserType],
    role: ['member' as Exclude<WorkspaceRole, 'owner'>],
    email: ['', [Validators.required, Validators.email]],
    name: [''],
    company: [''],
    phone: [''],
  });

  filteredUsers = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.activeFilter();
    return this.users().filter((user) => {
      const matchesType = filter === 'all' || user.type === filter;
      const matchesSearch =
        !search ||
        user.displayName.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        !!user.company?.toLowerCase().includes(search) ||
        !!user.jobTitle?.toLowerCase().includes(search);
      return matchesType && matchesSearch;
    });
  });

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Users',
      icon: 'fa-solid fa-users',
    });
    this.workspaceUserService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Unable to load workspace users.');
      },
    });
  }

  setFilter(filter: UserFilter): void {
    this.activeFilter.set(filter);
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  getTypeCount(type: UserFilter): number {
    if (type === 'all') return this.users().length;
    return this.users().filter((user) => user.type === type).length;
  }

  openCreateUser(): void {
    if (!this.permissions.canManageMembers()) return;
    this.newUserForm.reset({
      type: 'worker',
      role: 'member',
      email: '',
      name: '',
      company: '',
      phone: '',
    });
    this.configureCreateForm('worker');
    this.createDrawerOpen.set(true);
  }

  closeCreateUser(): void {
    if (this.creatingUser()) return;
    this.createDrawerOpen.set(false);
  }

  onCreateTypeChange(): void {
    if (!this.permissions.canManageMembers()) return;
    this.configureCreateForm(this.newUserForm.controls.type.value);
  }

  isClientType(): boolean {
    return this.newUserForm.controls.type.value === 'client';
  }

  async createUser(): Promise<void> {
    if (!this.permissions.canManageMembers() || this.creatingUser()) return;
    const value = this.newUserForm.getRawValue();
    if (value.type === 'client') {
      if (!value.name.trim()) {
        this.newUserForm.controls.name.markAsTouched();
        return;
      }
      if (value.email && this.newUserForm.controls.email.invalid) {
        this.newUserForm.controls.email.markAsTouched();
        return;
      }
    } else if (this.newUserForm.controls.email.invalid) {
      this.newUserForm.controls.email.markAsTouched();
      return;
    }
    this.creatingUser.set(true);
    try {
      if (value.type === 'client') {
        const client: Omit<Client, 'workspaceId'> = {
          name: value.name.trim(),
          company: value.company.trim(),
          email: value.email.trim(),
          phone: value.phone.trim(),
        };
        await this.clientService.createClient(client);
        this.toast.success('Client added successfully.');
      } else {
        await this.addMemberOrInvite(value.email, value.role, value.type);
      }
      this.createDrawerOpen.set(false);
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to add user.');
    } finally {
      this.creatingUser.set(false);
    }
  }

  async changeType(user: WorkspaceUser, type: WorkspaceUserType): Promise<void> {
    if (!this.canEditType(user) || user.type === type || !user.memberId || this.isUpdating(user))
      return;
    this.updatingUserId.set(user.id);
    try {
      await this.workspaceMemberService.updateType(user.memberId, type);
      this.updateLocalUser(user.id, { type });
      this.toast.success('User type updated successfully.');
    } catch {
      this.toast.error('Unable to update user type.');
    } finally {
      this.updatingUserId.set(null);
    }
  }

  async changeRole(user: WorkspaceUser, role: WorkspaceRole): Promise<void> {
    if (
      !this.canEditRole(user) ||
      user.role === role ||
      !user.memberId ||
      role === 'owner' ||
      this.isUpdating(user)
    )
      return;
    this.updatingUserId.set(user.id);
    try {
      await this.workspaceMemberService.updateRole(user.memberId, role);
      this.updateLocalUser(user.id, { role });
      this.toast.success('User role updated successfully.');
    } catch {
      this.toast.error('Unable to update user role.');
    } finally {
      this.updatingUserId.set(null);
    }
  }

  canEditType(user: WorkspaceUser): boolean {
    return (
      this.permissions.canManageMembers() &&
      user.source === 'member' &&
      !!user.memberId &&
      user.role !== 'owner'
    );
  }

  canEditRole(user: WorkspaceUser): boolean {
    return (
      this.permissions.canChangeRoles() &&
      user.source === 'member' &&
      !!user.memberId &&
      user.role !== 'owner'
    );
  }

  canRemoveUser(user: WorkspaceUser): boolean {
    if (!this.permissions.canRemoveMembers() || user.role === 'owner') return false;
    if (user.source === 'member') return !!user.memberId;
    if (user.source === 'invitation') return !!user.invitationId;
    if (user.source === 'client') return !!user.clientId;
    return false;
  }

  openRemoveUser(user: WorkspaceUser): void {
    if (!this.canRemoveUser(user) || this.isUpdating(user)) return;
    this.removalUser.set(user);
  }

  closeRemoveUser(): void {
    if (this.removingUser()) return;
    this.removalUser.set(null);
  }

  async confirmRemoveUser(): Promise<void> {
    const user = this.removalUser();
    if (!user || !this.canRemoveUser(user) || this.removingUser()) return;
    this.removingUser.set(true);
    this.updatingUserId.set(user.id);
    try {
      if (user.source === 'member' && user.memberId) {
        await this.workspaceMemberService.removeMember(user.memberId);
        this.toast.success('User removed from workspace.');
      } else if (user.source === 'invitation' && user.invitationId) {
        await this.workspaceInvitationService.cancelInvitation(user.invitationId);
        this.toast.success('Invitation cancelled.');
      } else if (user.source === 'client' && user.clientId) {
        await this.clientService.deleteClient(user.clientId, user.photoPath);
        this.toast.success('Client deleted successfully.');
      } else {
        return;
      }
      this.users.update((users) => users.filter((item) => item.id !== user.id));
      this.removalUser.set(null);
    } catch (error: any) {
      this.toast.error(error?.message || this.getRemovalErrorMessage(user));
    } finally {
      this.removingUser.set(false);
      this.updatingUserId.set(null);
    }
  }

  getRemovalTitle(user: WorkspaceUser): string {
    if (user.source === 'invitation') return 'Cancel Invitation';
    if (user.source === 'client') return 'Delete Client';
    return 'Remove User';
  }

  getRemovalMessage(user: WorkspaceUser): string {
    if (user.source === 'invitation') {
      return `Cancel the pending invitation for ${user.email}? They will no longer be able to join this workspace using this invitation.`;
    }
    if (user.source === 'client') {
      return `Delete ${user.displayName} from this workspace? The client record and profile photo will be removed.`;
    }
    return `Remove ${user.displayName} from this workspace? Their Marvills Manager account will remain available, but they will lose access to this workspace.`;
  }

  getRemovalButtonLabel(user: WorkspaceUser): string {
    if (user.source === 'invitation') return 'Cancel Invitation';
    if (user.source === 'client') return 'Delete Client';
    return 'Remove User';
  }

  isUpdating(user: WorkspaceUser): boolean {
    return this.updatingUserId() === user.id;
  }

  getInitials(user: WorkspaceUser): string {
    const initials = user.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    return initials || 'U';
  }

  getTypeLabel(type: WorkspaceUserType): string {
    const labels: Record<WorkspaceUserType, string> = {
      worker: 'Worker',
      client: 'Client',
      contractor: 'Contractor',
      guest: 'Guest',
    };
    return labels[type];
  }

  getRoleLabel(role: WorkspaceRole): string {
    const labels: Record<WorkspaceRole, string> = {
      owner: 'Owner',
      admin: 'Admin',
      manager: 'Manager',
      member: 'Member',
      viewer: 'Viewer',
    };
    return labels[role];
  }

  getContextLabel(user: WorkspaceUser): string {
    if (user.source === 'invitation') return 'Pending invitation';
    if (user.type === 'client') return user.company || 'Independent Client';
    return user.jobTitle || 'Workspace Member';
  }

  private async addMemberOrInvite(
    email: string,
    role: Exclude<WorkspaceRole, 'owner'>,
    type: WorkspaceUserType,
  ): Promise<void> {
    if (!this.permissions.canManageMembers()) return;
    try {
      await this.workspaceMemberService.addMemberByEmail(email.trim(), role, type);
      this.toast.success(`${this.getTypeLabel(type)} added successfully.`);
    } catch (error: any) {
      if (error?.message !== 'No Marvills Manager account was found with this email.') throw error;
      await this.workspaceInvitationService.createInvitation(email.trim(), role, type);
      this.toast.success('Invitation created successfully.');
    }
  }

  private configureCreateForm(type: WorkspaceUserType): void {
    const email = this.newUserForm.controls.email;
    const name = this.newUserForm.controls.name;
    const role = this.newUserForm.controls.role;
    if (type === 'client') {
      name.setValidators([Validators.required]);
      email.setValidators([Validators.email]);
      role.setValue('viewer');
    } else {
      name.clearValidators();
      email.setValidators([Validators.required, Validators.email]);
      if (role.value === 'viewer' && type === 'worker') role.setValue('member');
    }
    name.updateValueAndValidity();
    email.updateValueAndValidity();
  }

  private updateLocalUser(id: string, changes: Partial<WorkspaceUser>): void {
    this.users.update((users) =>
      users.map((user) => (user.id === id ? { ...user, ...changes } : user)),
    );
  }

  private getRemovalErrorMessage(user: WorkspaceUser): string {
    if (user.source === 'invitation') return 'Unable to cancel invitation.';
    if (user.source === 'client') return 'Unable to delete client.';
    return 'Unable to remove user from workspace.';
  }
}
