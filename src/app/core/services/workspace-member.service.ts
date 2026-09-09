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
import { combineLatest, from, map, Observable, of, switchMap } from 'rxjs';
import { AppUser } from '../models/app.-user.model';
import { WorkspaceMember } from '../models/workspace-member.model';
import { WorkspaceMemberProfile } from '../models/workspace-member-profile.model';
import { WorkspaceRole } from '../models/workspace-member.model';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceMemberService {
  private firestore = inject(Firestore);
  private workspaceService = inject(WorkspaceService);

  getMembers(): Observable<WorkspaceMember[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) return of([]);
        const membersRef = collection(this.firestore, 'workspaceMembers');
        const membersQuery = query(membersRef, where('workspaceId', '==', workspace.id));
        return collectionData(membersQuery, { idField: 'id' }) as Observable<WorkspaceMember[]>;
      }),
    );
  }

  getMembersWithProfiles(): Observable<WorkspaceMemberProfile[]> {
    return this.getMembers().pipe(
      switchMap((members) => {
        if (!members.length) return of([]);
        return combineLatest(
          members.map((member) => {
            const userRef = doc(this.firestore, `users/${member.userId}`);
            return from(getDoc(userRef)).pipe(
              map((snapshot) => {
                const user = snapshot.exists() ? (snapshot.data() as AppUser) : null;
                return {
                  ...member,
                  displayName: user?.displayName || member.displayName || member.email,
                  photoURL: user?.photoURL || '',
                  jobTitle: user?.jobTitle || '',
                } as WorkspaceMemberProfile;
              }),
            );
          }),
        );
      }),
    );
  }

  async addMemberByEmail(email: string, role: WorkspaceRole): Promise<void> {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) throw new Error('No workspace selected.');
    if (role === 'owner') throw new Error('Owner cannot be assigned through invitations.');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Email address is required.');
    const usersRef = collection(this.firestore, 'users');
    const userSnapshot = await getDocs(
      query(usersRef, where('email', '==', normalizedEmail), limit(1)),
    );
    if (userSnapshot.empty)
      throw new Error('No Marvills Manager account was found with this email.');
    const userDocument = userSnapshot.docs[0];
    const user = { id: userDocument.id, ...userDocument.data() } as AppUser;
    const memberId = `${workspace.id}_${user.uid}`;
    const memberRef = doc(this.firestore, `workspaceMembers/${memberId}`);
    if ((await getDoc(memberRef)).exists())
      throw new Error('This user is already a member of the workspace.');
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
    if (role === 'owner') throw new Error('Owner role cannot be assigned here.');
    return updateDoc(doc(this.firestore, `workspaceMembers/${memberId}`), {
      role,
      updatedAt: serverTimestamp(),
    });
  }

  removeMember(memberId: string) {
    return deleteDoc(doc(this.firestore, `workspaceMembers/${memberId}`));
  }
}
