import { Injectable } from '@angular/core';
import {
  DiagramConnection,
  DiagramNode,
  DiagramPoint,
} from '../../../../../core/models/diagram.model';

export interface DiagramNodeDragState {
  activeNodeId: string | null;
  startPositions: Record<string, DiagramPoint>;
  currentPositions: Record<string, DiagramPoint>;
}

export interface DiagramConnectionDragState {
  bendPoints: DiagramPoint[];
  labels: {
    id: string;
    x: number;
    y: number;
  }[];
}

export interface DiagramResizeState {
  nodeId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startNodeX: number;
  startNodeY: number;
}

export interface DiagramLabelDragState {
  connectionId: string;
  labelId: string;
  offsetX: number;
  offsetY: number;
}

export interface DiagramBendDragState {
  connectionId: string;
  index: number;
}

export type DiagramReconnectEndpoint = 'source' | 'target';

export interface DiagramReconnectState {
  connectionId: string;
  endpoint: DiagramReconnectEndpoint;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramDragService {
  readonly dragPositions: Record<string, DiagramPoint> = {};
  readonly groupDragStartPositions: Record<string, DiagramPoint> = {};
  readonly groupDragConnectionStates: Record<string, DiagramConnectionDragState> = {};
  activeDragNodeId: string | null = null;
  resizeState: DiagramResizeState | null = null;
  labelDragState: DiagramLabelDragState | null = null;
  bendDragState: DiagramBendDragState | null = null;
  reconnectState: DiagramReconnectState | null = null;

  startNodeDrag(
    nodeId: string,
    nodes: DiagramNode[],
    selectedNodeIds: Set<string>,
    connections: DiagramConnection[],
  ): void {
    this.activeDragNodeId = nodeId;
    this.clearRecord(this.groupDragStartPositions);
    this.clearRecord(this.groupDragConnectionStates);
    const draggingSelection = selectedNodeIds.has(nodeId) ? selectedNodeIds : new Set([nodeId]);
    for (const node of nodes) {
      if (!draggingSelection.has(node.id)) continue;
      this.groupDragStartPositions[node.id] = {
        x: this.dragPositions[node.id]?.x ?? node.x,
        y: this.dragPositions[node.id]?.y ?? node.y,
      };
    }
    for (const connection of connections) {
      if (
        !draggingSelection.has(connection.sourceNodeId) ||
        !draggingSelection.has(connection.targetNodeId)
      ) {
        continue;
      }
      this.groupDragConnectionStates[connection.id] = {
        bendPoints:
          connection.bendPoints?.map((point) => ({
            ...point,
          })) || [],
        labels:
          connection.labels?.map((label) => ({
            id: label.id,
            x: label.x,
            y: label.y,
          })) || [],
      };
    }
  }

  updateNodeDrag(
    nodeId: string,
    deltaX: number,
    deltaY: number,
    selectedNodeIds: Set<string>,
    connections: DiagramConnection[],
  ): void {
    const draggingSelection = selectedNodeIds.has(nodeId) ? selectedNodeIds : new Set([nodeId]);
    for (const selectedNodeId of draggingSelection) {
      const start = this.groupDragStartPositions[selectedNodeId];
      if (!start) continue;
      this.dragPositions[selectedNodeId] = {
        x: start.x + deltaX,
        y: start.y + deltaY,
      };
    }
    for (const connection of connections) {
      const state = this.groupDragConnectionStates[connection.id];
      if (!state) continue;
      connection.bendPoints = state.bendPoints.map((point) => ({
        x: point.x + deltaX,
        y: point.y + deltaY,
      }));
      connection.labels =
        connection.labels?.map((label) => {
          const startLabel = state.labels.find((item) => item.id === label.id);
          if (!startLabel) return label;
          return {
            ...label,
            x: startLabel.x + deltaX,
            y: startLabel.y + deltaY,
          };
        }) || [];
    }
  }

  finishNodeDrag(nodes: DiagramNode[], selectedNodeIds: Set<string>): DiagramNode[] {
    const draggingSelection =
      this.activeDragNodeId && selectedNodeIds.has(this.activeDragNodeId)
        ? selectedNodeIds
        : this.activeDragNodeId
          ? new Set([this.activeDragNodeId])
          : new Set<string>();
    const updatedNodes = nodes.map((node) => {
      if (!draggingSelection.has(node.id)) return node;
      const position = this.dragPositions[node.id];
      if (!position) return node;
      return {
        ...node,
        x: position.x,
        y: position.y,
      };
    });
    for (const nodeId of draggingSelection) {
      delete this.dragPositions[nodeId];
    }
    this.activeDragNodeId = null;
    this.clearRecord(this.groupDragStartPositions);
    this.clearRecord(this.groupDragConnectionStates);
    return updatedNodes;
  }

  cancelNodeDrag(): void {
    for (const nodeId of Object.keys(this.groupDragStartPositions)) {
      delete this.dragPositions[nodeId];
    }
    this.activeDragNodeId = null;
    this.clearRecord(this.groupDragStartPositions);
    this.clearRecord(this.groupDragConnectionStates);
  }

  getNodeDragPosition(node: DiagramNode): DiagramPoint {
    if (this.activeDragNodeId === node.id) {
      return (
        this.groupDragStartPositions[node.id] || {
          x: node.x,
          y: node.y,
        }
      );
    }
    return (
      this.dragPositions[node.id] || {
        x: node.x,
        y: node.y,
      }
    );
  }

  getNodeLivePosition(node: DiagramNode): DiagramPoint {
    return (
      this.dragPositions[node.id] || {
        x: node.x,
        y: node.y,
      }
    );
  }

  setNodePosition(nodeId: string, point: DiagramPoint): void {
    this.dragPositions[nodeId] = {
      ...point,
    };
  }

  clearNodePosition(nodeId: string): void {
    delete this.dragPositions[nodeId];
  }

  clearAllNodePositions(): void {
    this.clearRecord(this.dragPositions);
  }

  startResize(node: DiagramNode, clientX: number, clientY: number): void {
    this.resizeState = {
      nodeId: node.id,
      startX: clientX,
      startY: clientY,
      startWidth: node.width,
      startHeight: node.height,
      startNodeX: node.x,
      startNodeY: node.y,
    };
  }

  updateResize(
    node: DiagramNode,
    clientX: number,
    clientY: number,
    zoom: number,
    minimumWidth: number,
    minimumHeight: number,
    proportional = false,
  ): {
    width: number;
    height: number;
  } | null {
    if (!this.resizeState || this.resizeState.nodeId !== node.id) {
      return null;
    }
    const deltaX = (clientX - this.resizeState.startX) / zoom;
    const deltaY = (clientY - this.resizeState.startY) / zoom;
    if (proportional) {
      const delta = Math.max(deltaX, deltaY);
      const size = Math.max(
        minimumWidth,
        minimumHeight,
        Math.max(this.resizeState.startWidth, this.resizeState.startHeight) + delta,
      );
      return {
        width: size,
        height: size,
      };
    }
    return {
      width: Math.max(minimumWidth, this.resizeState.startWidth + deltaX),
      height: Math.max(minimumHeight, this.resizeState.startHeight + deltaY),
    };
  }

  finishResize(): void {
    this.resizeState = null;
  }

  cancelResize(): void {
    this.resizeState = null;
  }

  isResizing(): boolean {
    return this.resizeState !== null;
  }

  startLabelDrag(
    connectionId: string,
    labelId: string,
    pointer: DiagramPoint,
    labelPosition: DiagramPoint,
  ): void {
    this.labelDragState = {
      connectionId,
      labelId,
      offsetX: pointer.x - labelPosition.x,
      offsetY: pointer.y - labelPosition.y,
    };
  }

  getLabelDragPosition(pointer: DiagramPoint): DiagramPoint | null {
    if (!this.labelDragState) return null;
    return {
      x: pointer.x - this.labelDragState.offsetX,
      y: pointer.y - this.labelDragState.offsetY,
    };
  }

  finishLabelDrag(): void {
    this.labelDragState = null;
  }

  cancelLabelDrag(): void {
    this.labelDragState = null;
  }

  isLabelDragging(): boolean {
    return this.labelDragState !== null;
  }

  startBendDrag(connectionId: string, index: number): void {
    this.bendDragState = {
      connectionId,
      index,
    };
  }

  finishBendDrag(): void {
    this.bendDragState = null;
  }

  cancelBendDrag(): void {
    this.bendDragState = null;
  }

  isBendDragging(): boolean {
    return this.bendDragState !== null;
  }

  startReconnect(connectionId: string, endpoint: DiagramReconnectEndpoint): void {
    this.reconnectState = {
      connectionId,
      endpoint,
    };
  }

  finishReconnect(): void {
    this.reconnectState = null;
  }

  cancelReconnect(): void {
    this.reconnectState = null;
  }

  isReconnecting(): boolean {
    return this.reconnectState !== null;
  }

  reset(): void {
    this.clearAllNodePositions();
    this.clearRecord(this.groupDragStartPositions);
    this.clearRecord(this.groupDragConnectionStates);
    this.activeDragNodeId = null;
    this.resizeState = null;
    this.labelDragState = null;
    this.bendDragState = null;
    this.reconnectState = null;
  }

  private clearRecord(record: Record<string, unknown>): void {
    for (const key of Object.keys(record)) {
      delete record[key];
    }
  }
}
