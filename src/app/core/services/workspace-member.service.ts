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
import {
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceUserType,
} from '../models/workspace-member.model';
import { WorkspaceMemberProfile } from '../models/workspace-member-profile.model';
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
        return collectionData(membersQuery, { idField: 'id' }).pipe(
          map((members) =>
            (members as WorkspaceMember[]).map((member) => ({
              ...member,
              type: member.type || 'worker',
              status: member.status || 'active',
            })),
          ),
        );
      }),
    );
  }

  getMembersWithProfiles(): Observable<WorkspaceMemberProfile[]> {
    return this.getMembers().pipe(
      switchMap((members) => {
        if (!members.length) return of([]);
        return combineLatest(
          members.map((member) => {
            if (!member.userId) {
              return of({
                ...member,
                displayName: member.displayName || member.email,
                photoURL: '',
                jobTitle: '',
              } as WorkspaceMemberProfile);
            }
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

  async addMemberByEmail(
    email: string,
    role: WorkspaceRole,
    type: WorkspaceUserType = 'worker',
  ): Promise<void> {
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
      type,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  updateRole(memberId: string, role: WorkspaceRole): Promise<void> {
    if (role === 'owner') throw new Error('Owner role cannot be assigned here.');
    return updateDoc(doc(this.firestore, `workspaceMembers/${memberId}`), {
      role,
      updatedAt: serverTimestamp(),
    });
  }

  updateType(memberId: string, type: WorkspaceUserType): Promise<void> {
    return updateDoc(doc(this.firestore, `workspaceMembers/${memberId}`), {
      type,
      updatedAt: serverTimestamp(),
    });
  }

  updateMember(
    memberId: string,
    member: Partial<Pick<WorkspaceMember, 'displayName' | 'email' | 'role' | 'type' | 'status'>>,
  ): Promise<void> {
    const cleanMember = Object.fromEntries(
      Object.entries(member).filter(([, value]) => value !== undefined),
    );
    return updateDoc(doc(this.firestore, `workspaceMembers/${memberId}`), {
      ...cleanMember,
      updatedAt: serverTimestamp(),
    });
  }

  removeMember(memberId: string): Promise<void> {
    return deleteDoc(doc(this.firestore, `workspaceMembers/${memberId}`));
  }
}
