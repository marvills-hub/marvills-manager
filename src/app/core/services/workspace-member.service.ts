import { inject, Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
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
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { WorkspaceMember, WorkspaceRole } from '../models/workspace-member.model';
import { WorkspaceService } from './workspace.service';
import { AppUser } from '../models/app.-user.model';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceMemberService {
  private firestore = inject(Firestore);
  private workspaceService = inject(WorkspaceService);

  getMembers(): Observable<WorkspaceMember[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) {
          return of([]);
        }

        const membersRef = collection(this.firestore, 'workspaceMembers');

        const membersQuery = query(membersRef, where('workspaceId', '==', workspace.id));

        return collectionData(membersQuery, {
          idField: 'id',
        }) as Observable<WorkspaceMember[]>;
      }),
    );
  }

  async addMemberByEmail(email: string, role: WorkspaceRole): Promise<void> {
    const workspace = this.workspaceService.currentWorkspace();

    if (!workspace?.id) {
      throw new Error('No workspace selected.');
    }

    if (role === 'owner') {
      throw new Error('Owner cannot be assigned through invitations.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error('Email address is required.');
    }

    const usersRef = collection(this.firestore, 'users');

    const userQuery = query(usersRef, where('email', '==', normalizedEmail), limit(1));

    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      throw new Error('No Marvills Manager account was found with this email.');
    }

    const userDocument = userSnapshot.docs[0];

    const user = {
      id: userDocument.id,
      ...userDocument.data(),
    } as AppUser;

    const memberId = `${workspace.id}_${user.uid}`;

    const memberRef = doc(this.firestore, `workspaceMembers/${memberId}`);

    const existingMember = await getDoc(memberRef);

    if (existingMember.exists()) {
      throw new Error('This user is already a member of the workspace.');
    }

    await setDoc(memberRef, {
      workspaceId: workspace.id,
      userId: user.uid,
      email: user.email,
      displayName: user.displayName ?? '',
      role,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  updateRole(memberId: string, role: WorkspaceRole) {
    if (role === 'owner') {
      throw new Error('Owner role cannot be assigned here.');
    }

    const memberRef = doc(this.firestore, `workspaceMembers/${memberId}`);

    return updateDoc(memberRef, {
      role,
      updatedAt: serverTimestamp(),
    });
  }

  removeMember(memberId: string) {
    const memberRef = doc(this.firestore, `workspaceMembers/${memberId}`);

    return deleteDoc(memberRef);
  }
}
