import { computed, inject, Injectable, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { WorkspaceMember, WorkspaceRole } from '../models/workspace-member.model';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class WorkspacePermissionService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private workspaceService = inject(WorkspaceService);
  private membershipSubscription?: Subscription;
  private readonly membershipSignal = signal<WorkspaceMember | null>(null);
  private readonly ownerSignal = signal(false);
  private readonly loadingSignal = signal(false);

  readonly membership = this.membershipSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly role = computed<WorkspaceRole | null>(() => {
    if (this.ownerSignal()) return 'owner';
    return this.membershipSignal()?.role ?? null;
  });
  readonly isOwner = computed(() => this.role() === 'owner');
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isManager = computed(() => this.role() === 'manager');
  readonly isMember = computed(() => this.role() === 'member');
  readonly isViewer = computed(() => this.role() === 'viewer');
  readonly hasWorkspaceAccess = computed(() => this.ownerSignal() || !!this.membershipSignal());

  readonly canManageWorkspace = computed(() => this.isOwner());
  readonly canManageMembers = computed(() => this.isOwner() || this.isAdmin());
  readonly canInviteMembers = computed(() => this.canManageMembers());
  readonly canChangeRoles = computed(() => this.canManageMembers());
  readonly canRemoveMembers = computed(() => this.canManageMembers());

  readonly canCreateProjects = computed(() => this.canEditContent());
  readonly canEditProjects = computed(() => this.canEditContent());
  readonly canDeleteProjects = computed(() => this.canEditContent());

  readonly canCreateTasks = computed(() => this.canEditContent());
  readonly canEditTasks = computed(() => this.canEditContent());
  readonly canDeleteTasks = computed(() => this.canEditContent());
  readonly canManageTaskStatuses = computed(() => this.canEditContent());

  readonly canCreateClients = computed(() => this.canEditContent());
  readonly canEditClients = computed(() => this.canEditContent());
  readonly canDeleteClients = computed(() => this.canEditContent());

  readonly canViewContent = computed(() => this.hasWorkspaceAccess());
  readonly canManageContent = computed(() => this.canEditContent());
  readonly isReadOnly = computed(() => this.isViewer());

  constructor() {
    this.workspaceService.currentWorkspace$.subscribe((workspace) => {
      const user = this.auth.currentUser;
      const isOwner = !!user && !!workspace?.id && workspace.ownerId === user.uid;
      this.ownerSignal.set(isOwner);
      this.loadMembership(workspace?.id, isOwner);
    });
  }

  private canEditContent(): boolean {
    return this.isOwner() || this.isAdmin() || this.isManager() || this.isMember();
  }

  private loadMembership(workspaceId?: string, isOwner = false): void {
    this.membershipSubscription?.unsubscribe();
    this.membershipSubscription = undefined;
    this.membershipSignal.set(null);
    const user = this.auth.currentUser;
    if (!user || !workspaceId) {
      this.loadingSignal.set(false);
      return;
    }
    if (isOwner) {
      this.loadingSignal.set(false);
      return;
    }
    this.loadingSignal.set(true);
    const memberRef = doc(this.firestore, `workspaceMembers/${workspaceId}_${user.uid}`);
    this.membershipSubscription = docData(memberRef, { idField: 'id' }).subscribe({
      next: (member) => {
        const membership = member as WorkspaceMember;
        this.membershipSignal.set(membership?.status === 'active' ? membership : null);
        this.loadingSignal.set(false);
      },
      error: (error) => {
        console.error('Unable to load workspace membership:', error);
        this.membershipSignal.set(null);
        this.loadingSignal.set(false);
      },
    });
  }
}
