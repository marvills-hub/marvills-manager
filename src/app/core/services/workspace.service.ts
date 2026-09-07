import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  collection,
  collectionData,
  doc,
  Firestore,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { Workspace } from '../models/workspace.model';
import { WorkspaceMember } from '../models/workspace-member.model';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private readonly currentWorkspaceSignal = signal<Workspace | null>(null);

  readonly currentWorkspace = this.currentWorkspaceSignal.asReadonly();

  readonly currentWorkspace$ = toObservable(this.currentWorkspaceSignal);

  getWorkspaces(): Observable<Workspace[]> {
    const user = this.auth.currentUser;

    if (!user) {
      return of([]);
    }

    const membersRef = collection(this.firestore, 'workspaceMembers');

    const membershipQuery = query(membersRef, where('userId', '==', user.uid));

    return (
      collectionData(membershipQuery, {
        idField: 'id',
      }) as Observable<WorkspaceMember[]>
    ).pipe(
      switchMap((memberships) => {
        if (!memberships.length) {
          return this.getOwnedWorkspaces();
        }

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

    if (!user) {
      return of([]);
    }

    const workspacesRef = collection(this.firestore, 'workspaces');

    const workspaceQuery = query(workspacesRef, where('ownerId', '==', user.uid));

    return collectionData(workspaceQuery, {
      idField: 'id',
    }) as Observable<Workspace[]>;
  }

  async createWorkspace(name: string, description = '') {
    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('You must be logged in to create a workspace.');
    }

    const workspaceRef = doc(collection(this.firestore, 'workspaces'));

    const memberRef = doc(this.firestore, `workspaceMembers/${workspaceRef.id}_${user.uid}`);

    const batch = writeBatch(this.firestore);

    batch.set(workspaceRef, {
      name: name.trim(),
      description: description.trim(),

      ownerId: user.uid,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    batch.set(memberRef, {
      workspaceId: workspaceRef.id,

      userId: user.uid,

      email: user.email ?? '',

      displayName: user.displayName ?? '',

      role: 'owner',

      status: 'active',

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return workspaceRef;
  }

  updateWorkspace(id: string, workspace: Partial<Workspace>) {
    const workspaceRef = doc(this.firestore, `workspaces/${id}`);

    const cleanWorkspace = Object.fromEntries(
      Object.entries(workspace).filter(([, value]) => value !== undefined),
    );

    return updateDoc(workspaceRef, {
      ...cleanWorkspace,

      updatedAt: serverTimestamp(),
    });
  }

  selectWorkspace(workspace: Workspace): void {
    this.currentWorkspaceSignal.set(workspace);

    if (workspace.id) {
      localStorage.setItem('marvills-workspace', workspace.id);
    }
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
}
