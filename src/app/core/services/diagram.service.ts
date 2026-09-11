import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { map, Observable, of, switchMap } from 'rxjs';
import { Diagram, DiagramConnection, DiagramNode } from '../models/diagram.model';
import { AuthService } from './auth.service';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class DiagramService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);

  getDiagrams(): Observable<Diagram[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) return of([]);
        const diagramsRef = collection(this.firestore, 'diagrams');
        const diagramsQuery = query(diagramsRef, where('workspaceId', '==', workspace.id));
        return (collectionData(diagramsQuery, { idField: 'id' }) as Observable<Diagram[]>).pipe(
          map((diagrams) =>
            [...diagrams].sort((a, b) => {
              const aTime = this.getTimestamp(a.updatedAt);
              const bTime = this.getTimestamp(b.updatedAt);
              return bTime - aTime;
            }),
          ),
        );
      }),
    );
  }

  async createDiagram(name: string, description = ''): Promise<string> {
    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;
    if (!workspace?.id) throw new Error('No workspace selected.');
    if (!user?.uid) throw new Error('You must be signed in.');
    const document = await addDoc(collection(this.firestore, 'diagrams'), {
      workspaceId: workspace.id,
      name: name.trim(),
      description: description.trim(),
      nodes: [],
      connections: [],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return document.id;
  }

  async renameDiagram(diagramId: string, name: string): Promise<void> {
    await updateDoc(doc(this.firestore, `diagrams/${diagramId}`), {
      name: name.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateDiagram(
    diagramId: string,
    nodes: DiagramNode[],
    connections: DiagramConnection[],
  ): Promise<void> {
    await updateDoc(doc(this.firestore, `diagrams/${diagramId}`), {
      nodes,
      connections,
      updatedAt: serverTimestamp(),
    });
  }

  async updateDescription(diagramId: string, description: string): Promise<void> {
    await updateDoc(doc(this.firestore, `diagrams/${diagramId}`), {
      description: description.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteDiagram(diagramId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `diagrams/${diagramId}`));
  }

  private getTimestamp(value: any): number {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return 0;
  }
}
