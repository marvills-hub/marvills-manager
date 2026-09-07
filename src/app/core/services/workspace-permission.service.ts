import { computed, inject, Injectable, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  collectionData,
  Firestore,
  limit,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
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

  private readonly loadingSignal = signal(false);

  readonly membership = this.membershipSignal.asReadonly();

  readonly loading = this.loadingSignal.asReadonly();

  readonly role = computed<WorkspaceRole | null>(() => this.membershipSignal()?.role ?? null);

  readonly isOwner = computed(() => this.role() === 'owner');

  readonly isAdmin = computed(() => this.role() === 'admin');

  readonly isMember = computed(() => this.role() === 'member');

  readonly canManageWorkspace = computed(() => this.isOwner());

  readonly canManageMembers = computed(() => this.isOwner() || this.isAdmin());

  readonly canManageContent = computed(() => this.isOwner() || this.isAdmin() || this.isMember());

  constructor() {
    this.workspaceService.currentWorkspace$.subscribe((workspace) => {
      this.loadMembership(workspace?.id);
    });
  }

  private loadMembership(workspaceId?: string): void {
    this.membershipSubscription?.unsubscribe();

    this.membershipSignal.set(null);

    const user = this.auth.currentUser;

    if (!user || !workspaceId) {
      this.loadingSignal.set(false);
      return;
    }

    this.loadingSignal.set(true);

    const membersRef = collection(this.firestore, 'workspaceMembers');

    const membershipQuery = query(
      membersRef,
      where('workspaceId', '==', workspaceId),
      where('userId', '==', user.uid),
      limit(1),
    );

    this.membershipSubscription = (
      collectionData(membershipQuery, {
        idField: 'id',
      }) as Observable<WorkspaceMember[]>
    ).subscribe({
      next: (members) => {
        this.membershipSignal.set(members[0] ?? null);

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
