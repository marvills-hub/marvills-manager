import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import {
  DiagramConnection,
  DiagramNode,
  DiagramVersionSnapshot,
} from '../../../../../core/models/diagram.model';
@Injectable({
  providedIn: 'root',
})
export class DiagramVersionService {
  private readonly firestore = inject(Firestore);
  getVersions(diagramId: string): Observable<DiagramVersionSnapshot[]> {
    const versionsRef = collection(this.firestore, `diagrams/${diagramId}/versions`);
    const versionsQuery = query(versionsRef, orderBy('createdAt', 'desc'), limit(50));
    return collectionData(versionsQuery, {
      idField: 'id',
    }) as Observable<DiagramVersionSnapshot[]>;
  }
  async createVersion(
    diagramId: string,
    workspaceId: string,
    name: string,
    nodes: DiagramNode[],
    connections: DiagramConnection[],
    createdBy?: string,
  ): Promise<string> {
    const versionsRef = collection(this.firestore, `diagrams/${diagramId}/versions`);
    const version = await addDoc(versionsRef, {
      diagramId,
      workspaceId,
      name,
      nodes: this.cloneNodes(nodes),
      connections: this.cloneConnections(connections),
      createdAt: serverTimestamp(),
      createdBy: createdBy || null,
    });
    return version.id;
  }
  async deleteVersion(diagramId: string, versionId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `diagrams/${diagramId}/versions/${versionId}`));
  }
  restoreVersion(version: DiagramVersionSnapshot): {
    nodes: DiagramNode[];
    connections: DiagramConnection[];
  } {
    return {
      nodes: this.cloneNodes(version.nodes),
      connections: this.cloneConnections(version.connections),
    };
  }
  private cloneNodes(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) => ({
      ...node,
      table: node.table
        ? {
            ...node.table,
            rows: node.table.rows.map((row) => ({
              ...row,
              cells: row.cells.map((cell) => ({
                ...cell,
              })),
            })),
          }
        : undefined,
      project: node.project
        ? {
            ...node.project,
          }
        : undefined,
    }));
  }
  private cloneConnections(connections: DiagramConnection[]): DiagramConnection[] {
    return connections.map((connection) => ({
      ...connection,
      bendPoints:
        connection.bendPoints?.map((point) => ({
          ...point,
        })) || [],
      labels:
        connection.labels?.map((label) => ({
          ...label,
        })) || [],
    }));
  }
}
