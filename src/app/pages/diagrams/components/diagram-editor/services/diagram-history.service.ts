import { Injectable } from '@angular/core';
import { DiagramConnection, DiagramNode } from '../../../../../core/models/diagram.model';

export interface DiagramHistorySnapshot {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

@Injectable({
  providedIn: 'root',
})
export class DiagramHistoryService {
  private readonly historyLimit = 50;
  private undoStack: DiagramHistorySnapshot[] = [];
  private redoStack: DiagramHistorySnapshot[] = [];

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  capture(nodes: DiagramNode[], connections: DiagramConnection[]): DiagramHistorySnapshot {
    return {
      nodes: this.cloneNodes(nodes),
      connections: this.cloneConnections(connections),
    };
  }

  cloneNodes(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) => ({
      ...node,
    }));
  }

  cloneConnections(connections: DiagramConnection[]): DiagramConnection[] {
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

  signature(snapshot: DiagramHistorySnapshot): string {
    return JSON.stringify(snapshot);
  }

  snapshotsEqual(first: DiagramHistorySnapshot, second: DiagramHistorySnapshot): boolean {
    return this.signature(first) === this.signature(second);
  }

  commit(
    before: DiagramHistorySnapshot,
    nodes: DiagramNode[],
    connections: DiagramConnection[],
  ): boolean {
    const after = this.capture(nodes, connections);
    if (this.snapshotsEqual(before, after)) return false;
    this.push(this.undoStack, before);
    this.redoStack = [];
    return true;
  }

  undo(nodes: DiagramNode[], connections: DiagramConnection[]): DiagramHistorySnapshot | null {
    if (!this.undoStack.length) return null;
    const current = this.capture(nodes, connections);
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.push(this.redoStack, current);
    return this.cloneSnapshot(previous);
  }

  redo(nodes: DiagramNode[], connections: DiagramConnection[]): DiagramHistorySnapshot | null {
    if (!this.redoStack.length) return null;
    const current = this.capture(nodes, connections);
    const next = this.redoStack.pop();
    if (!next) return null;
    this.push(this.undoStack, current);
    return this.cloneSnapshot(next);
  }

  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  clearRedo(): void {
    this.redoStack = [];
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  private cloneSnapshot(snapshot: DiagramHistorySnapshot): DiagramHistorySnapshot {
    return {
      nodes: this.cloneNodes(snapshot.nodes),
      connections: this.cloneConnections(snapshot.connections),
    };
  }

  private push(stack: DiagramHistorySnapshot[], snapshot: DiagramHistorySnapshot): void {
    stack.push(this.cloneSnapshot(snapshot));
    if (stack.length > this.historyLimit) {
      stack.shift();
    }
  }
}
