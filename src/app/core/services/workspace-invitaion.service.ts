import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  collectionData,
  doc,
  Firestore,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import type { WorkspaceInvitation } from '../models/workspace-invitation.model';
import type { WorkspaceRole } from '../models/workspace-member.model';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceInvitationService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private workspaceService = inject(WorkspaceService);

  getMyInvitations(): Observable<WorkspaceInvitation[]> {
    const user = this.auth.currentUser;

    if (!user?.email) {
      return of([]);
    }

    const invitationsRef = collection(this.firestore, 'workspaceInvitations');

    const invitationsQuery = query(
      invitationsRef,
      where('email', '==', user.email.toLowerCase()),
      where('status', '==', 'pending'),
    );

    return collectionData(invitationsQuery, {
      idField: 'id',
    }) as Observable<WorkspaceInvitation[]>;
  }

  getWorkspaceInvitations(): Observable<WorkspaceInvitation[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) {
          return of([]);
        }

        const invitationsRef = collection(this.firestore, 'workspaceInvitations');

        const invitationsQuery = query(
          invitationsRef,
          where('workspaceId', '==', workspace.id),
          where('status', '==', 'pending'),
        );

        return collectionData(invitationsQuery, {
          idField: 'id',
        }) as Observable<WorkspaceInvitation[]>;
      }),
    );
  }

  async createInvitation(email: string, role: Exclude<WorkspaceRole, 'owner'>): Promise<void> {
    const user = this.auth.currentUser;

    const workspace = this.workspaceService.currentWorkspace();

    if (!user) {
      throw new Error('You must be logged in.');
    }

    if (!workspace?.id) {
      throw new Error('No workspace selected.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error('Email address is required.');
    }

    if (normalizedEmail === user.email?.toLowerCase()) {
      throw new Error('You cannot invite yourself.');
    }

    const membersRef = collection(this.firestore, 'workspaceMembers');

    const memberQuery = query(
      membersRef,
      where('workspaceId', '==', workspace.id),
      where('email', '==', normalizedEmail),
      limit(1),
    );

    const memberSnapshot = await getDocs(memberQuery);

    if (!memberSnapshot.empty) {
      throw new Error('This user is already a workspace member.');
    }

    const invitationsRef = collection(this.firestore, 'workspaceInvitations');

    const existingQuery = query(
      invitationsRef,
      where('workspaceId', '==', workspace.id),
      where('email', '==', normalizedEmail),
      where('status', '==', 'pending'),
      limit(1),
    );

    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error('A pending invitation already exists for this email.');
    }

    const invitationId = `${workspace.id}_${normalizedEmail}`;

    const invitationRef = doc(this.firestore, `workspaceInvitations/${invitationId}`);

    await setDoc(invitationRef, {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      email: normalizedEmail,
      role,
      status: 'pending',
      invitedBy: user.uid,
      invitedByEmail: user.email ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async acceptInvitation(invitation: WorkspaceInvitation): Promise<void> {
    const user = this.auth.currentUser;

    if (!user || !user.email || !invitation.id) {
      throw new Error('Unable to accept invitation.');
    }

    const userEmail = user.email.toLowerCase();

    if (userEmail !== invitation.email.toLowerCase()) {
      throw new Error('This invitation belongs to another account.');
    }

    const invitationRef = doc(this.firestore, `workspaceInvitations/${invitation.id}`);

    const invitationSnapshot = await getDoc(invitationRef);

    if (!invitationSnapshot.exists()) {
      throw new Error('Invitation no longer exists.');
    }

    const invitationData = invitationSnapshot.data();

    if (invitationData['status'] !== 'pending') {
      throw new Error('This invitation is no longer pending.');
    }

    if (invitationData['email'] !== userEmail) {
      throw new Error('This invitation belongs to another account.');
    }

    const workspaceId = invitationData['workspaceId'] as string;

    const role = invitationData['role'] as Exclude<WorkspaceRole, 'owner'>;

    const memberId = `${workspaceId}_${user.uid}`;

    const memberRef = doc(this.firestore, `workspaceMembers/${memberId}`);

    const batch = writeBatch(this.firestore);

    batch.set(memberRef, {
      workspaceId,
      userId: user.uid,
      email: userEmail,
      displayName: user.displayName ?? '',
      role,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(invitationRef, {
      status: 'accepted',
      acceptedBy: user.uid,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }

  async declineInvitation(invitation: WorkspaceInvitation): Promise<void> {
    const user = this.auth.currentUser;

    if (!user?.email || !invitation.id) {
      throw new Error('Unable to decline invitation.');
    }

    const userEmail = user.email.toLowerCase();

    if (userEmail !== invitation.email.toLowerCase()) {
      throw new Error('This invitation belongs to another account.');
    }

    const invitationRef = doc(this.firestore, `workspaceInvitations/${invitation.id}`);

    await updateDoc(invitationRef, {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
  }
}
