import { Injectable } from '@angular/core';
import {
  DiagramConnection,
  DiagramNode,
  DiagramPoint,
} from '../../../../../core/models/diagram.model';
import { DiagramGeometryService, DiagramSelectionRect } from './diagram-geometry.service';

export interface DiagramSelectionState {
  nodeIds: Set<string>;
  connectionIds: Set<string>;
  primaryNodeId: string | null;
  primaryConnectionId: string | null;
  connectionLabelId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramSelectionService {
  readonly selectedNodeIds = new Set<string>();
  readonly selectedConnectionIds = new Set<string>();
  selectedNodeId: string | null = null;
  selectedConnectionId: string | null = null;
  selectedConnectionLabelId: string | null = null;
  marqueeRect: DiagramSelectionRect | null = null;
  private marqueeStart: DiagramPoint | null = null;
  private marqueeBaseNodeIds = new Set<string>();
  private marqueeBaseConnectionIds = new Set<string>();

  constructor(private readonly geometry: DiagramGeometryService) {}

  selectOnlyNode(nodeId: string): void {
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(nodeId);
    this.selectedNodeId = nodeId;
    this.clearConnectionSelection();
  }

  selectOnlyConnection(connectionId: string): void {
    this.selectedConnectionIds.clear();
    this.selectedConnectionIds.add(connectionId);
    this.selectedConnectionId = connectionId;
    this.selectedConnectionLabelId = null;
    this.selectedNodeIds.clear();
    this.selectedNodeId = null;
  }

  toggleNode(nodeId: string): void {
    if (this.selectedNodeIds.has(nodeId)) {
      this.selectedNodeIds.delete(nodeId);
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = Array.from(this.selectedNodeIds).at(-1) ?? null;
      }
      return;
    }
    this.selectedNodeIds.add(nodeId);
    this.selectedNodeId = nodeId;
  }

  toggleConnection(connectionId: string): void {
    if (this.selectedConnectionIds.has(connectionId)) {
      this.selectedConnectionIds.delete(connectionId);
      if (this.selectedConnectionId === connectionId) {
        this.selectedConnectionId = Array.from(this.selectedConnectionIds).at(-1) ?? null;
      }
      return;
    }
    this.selectedConnectionIds.add(connectionId);
    this.selectedConnectionId = connectionId;
  }

  selectConnectionLabel(connectionId: string, labelId: string): void {
    this.selectedConnectionIds.clear();
    this.selectedConnectionIds.add(connectionId);
    this.selectedConnectionId = connectionId;
    this.selectedConnectionLabelId = labelId;
    this.selectedNodeIds.clear();
    this.selectedNodeId = null;
  }

  clearConnectionSelection(): void {
    this.selectedConnectionIds.clear();
    this.selectedConnectionId = null;
    this.selectedConnectionLabelId = null;
  }

  clearNodeSelection(): void {
    this.selectedNodeIds.clear();
    this.selectedNodeId = null;
  }

  clearAll(): void {
    this.clearNodeSelection();
    this.clearConnectionSelection();
    this.marqueeRect = null;
    this.marqueeStart = null;
    this.marqueeBaseNodeIds.clear();
    this.marqueeBaseConnectionIds.clear();
  }

  selectAll(nodes: DiagramNode[], connections: DiagramConnection[]): void {
    this.selectedNodeIds.clear();
    this.selectedConnectionIds.clear();
    for (const node of nodes) {
      this.selectedNodeIds.add(node.id);
    }
    for (const connection of connections) {
      this.selectedConnectionIds.add(connection.id);
    }
    this.selectedNodeId = nodes.at(-1)?.id ?? null;
    this.selectedConnectionId = connections.at(-1)?.id ?? null;
    this.selectedConnectionLabelId = null;
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds.has(nodeId);
  }

  isConnectionSelected(connectionId: string): boolean {
    return this.selectedConnectionIds.has(connectionId);
  }

  getSelectedNodes(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.filter((node) => this.selectedNodeIds.has(node.id));
  }

  getSelectedConnections(connections: DiagramConnection[]): DiagramConnection[] {
    return connections.filter((connection) => this.selectedConnectionIds.has(connection.id));
  }

  getSelectionCount(): number {
    return this.selectedNodeIds.size + this.selectedConnectionIds.size;
  }

  hasSelection(): boolean {
    return this.selectedNodeIds.size > 0 || this.selectedConnectionIds.size > 0;
  }

  hasMultipleSelection(): boolean {
    return this.getSelectionCount() > 1;
  }

  getState(): DiagramSelectionState {
    return {
      nodeIds: new Set(this.selectedNodeIds),
      connectionIds: new Set(this.selectedConnectionIds),
      primaryNodeId: this.selectedNodeId,
      primaryConnectionId: this.selectedConnectionId,
      connectionLabelId: this.selectedConnectionLabelId,
    };
  }

  restoreState(state: DiagramSelectionState): void {
    this.selectedNodeIds.clear();
    this.selectedConnectionIds.clear();
    for (const id of state.nodeIds) {
      this.selectedNodeIds.add(id);
    }
    for (const id of state.connectionIds) {
      this.selectedConnectionIds.add(id);
    }
    this.selectedNodeId = state.primaryNodeId;
    this.selectedConnectionId = state.primaryConnectionId;
    this.selectedConnectionLabelId = state.connectionLabelId;
  }

  removeNode(nodeId: string): void {
    this.selectedNodeIds.delete(nodeId);
    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = Array.from(this.selectedNodeIds).at(-1) ?? null;
    }
  }

  removeConnection(connectionId: string): void {
    this.selectedConnectionIds.delete(connectionId);
    if (this.selectedConnectionId === connectionId) {
      this.selectedConnectionId = Array.from(this.selectedConnectionIds).at(-1) ?? null;
    }
    if (!this.selectedConnectionId) {
      this.selectedConnectionLabelId = null;
    }
  }

  removeConnections(connectionIds: Iterable<string>): void {
    for (const connectionId of connectionIds) {
      this.selectedConnectionIds.delete(connectionId);
    }
    if (this.selectedConnectionId && !this.selectedConnectionIds.has(this.selectedConnectionId)) {
      this.selectedConnectionId = Array.from(this.selectedConnectionIds).at(-1) ?? null;
    }
    if (!this.selectedConnectionId) {
      this.selectedConnectionLabelId = null;
    }
  }

  startMarquee(point: DiagramPoint, additive = false): void {
    this.marqueeStart = point;
    this.marqueeBaseNodeIds = additive ? new Set(this.selectedNodeIds) : new Set<string>();
    this.marqueeBaseConnectionIds = additive
      ? new Set(this.selectedConnectionIds)
      : new Set<string>();
    if (!additive) {
      this.selectedNodeIds.clear();
      this.selectedConnectionIds.clear();
      this.selectedNodeId = null;
      this.selectedConnectionId = null;
    }
    this.selectedConnectionLabelId = null;
    this.marqueeRect = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    };
  }

  updateMarquee(
    point: DiagramPoint,
    nodes: DiagramNode[],
    connections: DiagramConnection[],
    dragPositions: Record<string, DiagramPoint> = {},
  ): void {
    if (!this.marqueeStart) return;
    const x = Math.min(this.marqueeStart.x, point.x);
    const y = Math.min(this.marqueeStart.y, point.y);
    const width = Math.abs(point.x - this.marqueeStart.x);
    const height = Math.abs(point.y - this.marqueeStart.y);
    this.marqueeRect = {
      x,
      y,
      width,
      height,
    };
    const nodeIds = new Set(this.marqueeBaseNodeIds);
    const connectionIds = new Set(this.marqueeBaseConnectionIds);
    for (const node of nodes) {
      if (this.geometry.doesNodeIntersectRect(node, this.marqueeRect, dragPositions)) {
        nodeIds.add(node.id);
      }
    }
    for (const connection of connections) {
      if (
        this.geometry.doesConnectionIntersectRect(
          connection,
          this.marqueeRect,
          nodes,
          dragPositions,
        )
      ) {
        connectionIds.add(connection.id);
      }
    }
    this.replaceNodeSelection(nodeIds);
    this.replaceConnectionSelection(connectionIds);
    this.selectedNodeId = Array.from(nodeIds).at(-1) ?? null;
    this.selectedConnectionId = Array.from(connectionIds).at(-1) ?? null;
  }

  finishMarquee(): void {
    this.marqueeStart = null;
    this.marqueeRect = null;
    this.marqueeBaseNodeIds.clear();
    this.marqueeBaseConnectionIds.clear();
  }

  cancelMarquee(): void {
    this.finishMarquee();
  }

  isMarqueeActive(): boolean {
    return this.marqueeStart !== null;
  }

  getMarqueeRect(): DiagramSelectionRect | null {
    return this.marqueeRect;
  }

  replaceNodeSelection(nodeIds: Iterable<string>): void {
    this.selectedNodeIds.clear();
    for (const nodeId of nodeIds) {
      this.selectedNodeIds.add(nodeId);
    }
    if (this.selectedNodeId && !this.selectedNodeIds.has(this.selectedNodeId)) {
      this.selectedNodeId = Array.from(this.selectedNodeIds).at(-1) ?? null;
    }
  }

  replaceConnectionSelection(connectionIds: Iterable<string>): void {
    this.selectedConnectionIds.clear();
    for (const connectionId of connectionIds) {
      this.selectedConnectionIds.add(connectionId);
    }
    if (this.selectedConnectionId && !this.selectedConnectionIds.has(this.selectedConnectionId)) {
      this.selectedConnectionId = Array.from(this.selectedConnectionIds).at(-1) ?? null;
    }
    if (!this.selectedConnectionId) {
      this.selectedConnectionLabelId = null;
    }
  }

  prune(nodes: DiagramNode[], connections: DiagramConnection[]): void {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const connectionIds = new Set(connections.map((connection) => connection.id));
    for (const nodeId of Array.from(this.selectedNodeIds)) {
      if (!nodeIds.has(nodeId)) {
        this.selectedNodeIds.delete(nodeId);
      }
    }
    for (const connectionId of Array.from(this.selectedConnectionIds)) {
      if (!connectionIds.has(connectionId)) {
        this.selectedConnectionIds.delete(connectionId);
      }
    }
    if (this.selectedNodeId && !nodeIds.has(this.selectedNodeId)) {
      this.selectedNodeId = Array.from(this.selectedNodeIds).at(-1) ?? null;
    }
    if (this.selectedConnectionId && !connectionIds.has(this.selectedConnectionId)) {
      this.selectedConnectionId = Array.from(this.selectedConnectionIds).at(-1) ?? null;
    }
    if (!this.selectedConnectionId) {
      this.selectedConnectionLabelId = null;
    }
  }
}
