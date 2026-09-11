import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  collectionData,
  doc,
  DocumentData,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { deleteObject, listAll, ref, Storage } from '@angular/fire/storage';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { WorkspaceMember } from '../models/workspace-member.model';
import { Workspace } from '../models/workspace.model';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private storage = inject(Storage);
  private readonly currentWorkspaceSignal = signal<Workspace | null>(null);
  readonly currentWorkspace = this.currentWorkspaceSignal.asReadonly();
  readonly currentWorkspace$ = toObservable(this.currentWorkspaceSignal);

  getWorkspaces(): Observable<Workspace[]> {
    const user = this.auth.currentUser;
    if (!user) return of([]);
    return combineLatest([this.getOwnedWorkspaces(), this.getMemberWorkspaces(user.uid)]).pipe(
      map(([ownedWorkspaces, memberWorkspaces]) => {
        const workspaces = [...ownedWorkspaces, ...memberWorkspaces];
        return Array.from(
          new Map(
            workspaces
              .filter((workspace) => !!workspace.id)
              .map((workspace) => [workspace.id!, workspace]),
          ).values(),
        ).sort((a, b) => a.name.localeCompare(b.name));
      }),
    );
  }

  async createWorkspace(name: string, description = '') {
    const user = this.auth.currentUser;
    if (!user) throw new Error('You must be logged in to create a workspace.');
    const workspaceRef = doc(collection(this.firestore, 'workspaces'));
    const memberRef = doc(this.firestore, `workspaceMembers/${workspaceRef.id}_${user.uid}`);
    const batch = writeBatch(this.firestore);
    batch.set(workspaceRef, {
      name: name.trim(),
      description: description.trim(),
      ownerId: user.uid,
      taskStatusesInitialized: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(memberRef, {
      workspaceId: workspaceRef.id,
      userId: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      role: 'owner',
      type: 'worker',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return workspaceRef;
  }

  async updateWorkspace(id: string, workspace: Partial<Workspace>): Promise<void> {
    await this.requireOwnership(id);
    const workspaceRef = doc(this.firestore, `workspaces/${id}`);
    const cleanWorkspace = Object.fromEntries(
      Object.entries(workspace).filter(
        ([key, value]) =>
          value !== undefined &&
          !['id', 'ownerId', 'createdAt', 'updatedAt', 'taskStatusesInitialized'].includes(key),
      ),
    );
    await updateDoc(workspaceRef, {
      ...cleanWorkspace,
      updatedAt: serverTimestamp(),
    });
    const current = this.currentWorkspaceSignal();
    if (current?.id === id) {
      this.currentWorkspaceSignal.set({
        ...current,
        ...cleanWorkspace,
      });
    }
  }

  async deleteWorkspace(id: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('You must be logged in.');
    await this.requireOwnership(id);
    await this.deleteWorkspaceStorage(id);
    await this.deleteWorkspaceCollection('tasks', id);
    await this.deleteWorkspaceCollection('projects', id);
    await this.deleteWorkspaceCollection('clients', id);
    await this.deleteWorkspaceCollection('taskStatuses', id);
    await this.deleteWorkspaceCollection('workspaceInvitations', id);
    await this.deleteNonOwnerMemberships(id, user.uid);
    const workspaceRef = doc(this.firestore, `workspaces/${id}`);
    const ownerMemberRef = doc(this.firestore, `workspaceMembers/${id}_${user.uid}`);
    const batch = writeBatch(this.firestore);
    batch.delete(ownerMemberRef);
    batch.delete(workspaceRef);
    await batch.commit();
    if (this.currentWorkspaceSignal()?.id === id) this.clearWorkspace();
  }

  selectWorkspace(workspace: Workspace): void {
    this.currentWorkspaceSignal.set(workspace);
    if (workspace.id) localStorage.setItem('marvills-workspace', workspace.id);
  }

  clearWorkspace(): void {
    this.currentWorkspaceSignal.set(null);
    localStorage.removeItem('marvills-workspace');
  }

  restoreWorkspace(workspaces: Workspace[]): void {
    if (!workspaces.length) {
      this.clearWorkspace();
      return;
    }
    const savedWorkspaceId = localStorage.getItem('marvills-workspace');
    const workspace = workspaces.find((item) => item.id === savedWorkspaceId) ?? workspaces[0];
    this.selectWorkspace(workspace);
  }

  private async requireOwnership(workspaceId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('You must be logged in.');
    const snapshot = await getDoc(doc(this.firestore, `workspaces/${workspaceId}`));
    if (!snapshot.exists()) throw new Error('Workspace was not found.');
    const workspace = snapshot.data() as Workspace;
    if (workspace.ownerId !== user.uid) {
      throw new Error('Only the workspace owner can perform this action.');
    }
  }

  private async deleteWorkspaceCollection(
    collectionName: string,
    workspaceId: string,
  ): Promise<void> {
    const collectionRef = collection(this.firestore, collectionName);
    const snapshot = await getDocs(query(collectionRef, where('workspaceId', '==', workspaceId)));
    await this.deleteDocumentReferences(snapshot.docs.map((document) => document.ref));
  }

  private async deleteNonOwnerMemberships(workspaceId: string, ownerId: string): Promise<void> {
    const membersRef = collection(this.firestore, 'workspaceMembers');
    const snapshot = await getDocs(query(membersRef, where('workspaceId', '==', workspaceId)));
    const ownerMemberId = `${workspaceId}_${ownerId}`;
    const references = snapshot.docs
      .filter((document) => document.id !== ownerMemberId)
      .map((document) => document.ref);
    await this.deleteDocumentReferences(references);
  }

  private async deleteDocumentReferences(
    references: DocumentReference<DocumentData>[],
  ): Promise<void> {
    const chunkSize = 400;
    for (let index = 0; index < references.length; index += chunkSize) {
      const batch = writeBatch(this.firestore);
      references.slice(index, index + chunkSize).forEach((documentRef) => {
        batch.delete(documentRef);
      });
      await batch.commit();
    }
  }

  private async deleteWorkspaceStorage(workspaceId: string): Promise<void> {
    const workspaceRef = ref(this.storage, `workspaces/${workspaceId}`);
    await this.deleteStorageFolder(workspaceRef);
  }

  private async deleteStorageFolder(folderRef: ReturnType<typeof ref>): Promise<void> {
    const result = await listAll(folderRef);
    await Promise.all(result.items.map((item) => deleteObject(item)));
    for (const folder of result.prefixes) {
      await this.deleteStorageFolder(folder);
    }
  }

  private getMemberWorkspaces(userId: string): Observable<Workspace[]> {
    const membersRef = collection(this.firestore, 'workspaceMembers');
    const membershipQuery = query(membersRef, where('userId', '==', userId));
    return (
      collectionData(membershipQuery, {
        idField: 'id',
      }) as Observable<WorkspaceMember[]>
    ).pipe(
      map((memberships) => memberships.filter((membership) => membership.status === 'active')),
      switchMap((memberships) => {
        if (!memberships.length) return of([]);
        const workspaceObservables = memberships.map((membership) => {
          const workspacesRef = collection(this.firestore, 'workspaces');
          const workspaceQuery = query(
            workspacesRef,
            where('__name__', '==', membership.workspaceId),
          );
          return collectionData(workspaceQuery, {
            idField: 'id',
          }) as Observable<Workspace[]>;
        });
        return combineLatest(workspaceObservables).pipe(map((results) => results.flat()));
      }),
    );
  }

  private getOwnedWorkspaces(): Observable<Workspace[]> {
    const user = this.auth.currentUser;
    if (!user) return of([]);
    const workspacesRef = collection(this.firestore, 'workspaces');
    const workspaceQuery = query(workspacesRef, where('ownerId', '==', user.uid));
    return collectionData(workspaceQuery, {
      idField: 'id',
    }) as Observable<Workspace[]>;
  }
}
