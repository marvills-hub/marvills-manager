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
import { Diagram, DiagramConnection, DiagramNode, DiagramType } from '../models/diagram.model';
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

        return (
          collectionData(diagramsQuery, {
            idField: 'id',
          }) as Observable<Diagram[]>
        ).pipe(
          map((diagrams) =>
            diagrams
              .map((diagram) => this.normalizeDiagram(diagram))
              .sort((a, b) => {
                const aTime = this.getTimestamp(a.updatedAt);
                const bTime = this.getTimestamp(b.updatedAt);
                return bTime - aTime;
              }),
          ),
        );
      }),
    );
  }

  getDiagramsByProject(projectId: string): Observable<Diagram[]> {
    return this.getDiagrams().pipe(
      map((diagrams) => diagrams.filter((diagram) => diagram.projectId === projectId)),
    );
  }

  getWorkspaceDiagrams(): Observable<Diagram[]> {
    return this.getDiagrams().pipe(
      map((diagrams) => diagrams.filter((diagram) => !diagram.projectId)),
    );
  }

  async createDiagram(
    name: string,
    description = '',
    type: DiagramType = 'blank',
    projectId?: string,
    nodes: DiagramNode[] = [],
    connections: DiagramConnection[] = [],
  ): Promise<string> {
    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;

    if (!workspace?.id) {
      throw new Error('No workspace selected.');
    }

    if (!user?.uid) {
      throw new Error('You must be signed in.');
    }

    const data: Record<string, any> = {
      workspaceId: workspace.id,
      name: name.trim(),
      description: description.trim(),
      type,
      nodes: this.cleanNodes(nodes),
      connections: this.cleanConnections(connections),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (projectId) {
      data['projectId'] = projectId;
    }

    const document = await addDoc(collection(this.firestore, 'diagrams'), data);

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
      nodes: this.cleanNodes(nodes),
      connections: this.cleanConnections(connections),
      updatedAt: serverTimestamp(),
    });
  }

  async updateDescription(diagramId: string, description: string): Promise<void> {
    await updateDoc(doc(this.firestore, `diagrams/${diagramId}`), {
      description: description.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateType(diagramId: string, type: DiagramType): Promise<void> {
    await updateDoc(doc(this.firestore, `diagrams/${diagramId}`), {
      type,
      updatedAt: serverTimestamp(),
    });
  }

  async assignToProject(diagramId: string, projectId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `diagrams/${diagramId}`), {
      projectId,
      updatedAt: serverTimestamp(),
    });
  }

  async removeFromProject(diagramId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `diagrams/${diagramId}`), {
      projectId: null,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteDiagram(diagramId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `diagrams/${diagramId}`));
  }

  private cleanNodes(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) => ({
      id: node.id,
      type: node.type,
      text: node.text,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      background: node.background,
      color: node.color,
      borderColor: node.borderColor,
      zIndex: node.zIndex,
    }));
  }

  private cleanConnections(connections: DiagramConnection[]): DiagramConnection[] {
    return connections.map((connection) => {
      const clean: DiagramConnection = {
        id: connection.id,
        sourceNodeId: connection.sourceNodeId,
        targetNodeId: connection.targetNodeId,
        type: connection.type,
      };

      if (connection.sourceSide !== undefined) {
        clean.sourceSide = connection.sourceSide;
      }

      if (connection.targetSide !== undefined) {
        clean.targetSide = connection.targetSide;
      }

      if (connection.color !== undefined) {
        clean.color = connection.color;
      }

      if (connection.label !== undefined) {
        clean.label = connection.label;
      }

      if (connection.labels !== undefined) {
        clean.labels = connection.labels.map((label) => ({
          id: label.id,
          text: label.text,
          x: label.x,
          y: label.y,
        }));
      }

      if (connection.bendPoints !== undefined) {
        clean.bendPoints = connection.bendPoints.map((point) => ({
          x: point.x,
          y: point.y,
        }));
      }

      return clean;
    });
  }

  private normalizeDiagram(diagram: Diagram): Diagram {
    return {
      ...diagram,
      projectId: diagram.projectId || undefined,
      type: diagram.type ?? 'blank',
      nodes: diagram.nodes ?? [],
      connections: diagram.connections ?? [],
    };
  }

  private getTimestamp(value: any): number {
    if (!value) return 0;

    if (typeof value.toMillis === 'function') {
      return value.toMillis();
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return 0;
  }
}
