import { Injectable } from '@angular/core';
import { DiagramConnection, DiagramNode } from '../../../../../core/models/diagram.model';

export interface DiagramDuplicateResult {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  duplicatedNodeIds: string[];
  duplicatedConnectionIds: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DiagramClipboardService {
  duplicateSelection(
    nodes: DiagramNode[],
    connections: DiagramConnection[],
    selectedNodeIds: Set<string>,
    selectedConnectionIds: Set<string>,
    offset = 30,
  ): DiagramDuplicateResult {
    const selectedNodes = nodes.filter((node) => selectedNodeIds.has(node.id));
    if (!selectedNodes.length && !selectedConnectionIds.size) {
      return {
        nodes,
        connections,
        duplicatedNodeIds: [],
        duplicatedConnectionIds: [],
      };
    }
    const nodeIdMap = new Map<string, string>();
    const baseZIndex = this.getNextZIndex(nodes);
    const duplicatedNodes = selectedNodes.map((node, index) => {
      const id = crypto.randomUUID();
      nodeIdMap.set(node.id, id);
      return {
        ...node,
        id,
        x: node.x + offset,
        y: node.y + offset,
        zIndex: baseZIndex + index,
      };
    });
    const connectionsToDuplicate = connections.filter(
      (connection) =>
        selectedConnectionIds.has(connection.id) ||
        (selectedNodeIds.has(connection.sourceNodeId) &&
          selectedNodeIds.has(connection.targetNodeId)),
    );
    const duplicatedConnections = connectionsToDuplicate.map((connection) =>
      this.duplicateConnection(connection, nodeIdMap, selectedNodes.length > 0 ? offset : 0),
    );
    return {
      nodes: [...nodes, ...duplicatedNodes],
      connections: [...connections, ...duplicatedConnections],
      duplicatedNodeIds: duplicatedNodes.map((node) => node.id),
      duplicatedConnectionIds: duplicatedConnections.map((connection) => connection.id),
    };
  }

  duplicateNode(node: DiagramNode, nodes: DiagramNode[], offset = 30): DiagramNode {
    return {
      ...node,
      id: crypto.randomUUID(),
      x: node.x + offset,
      y: node.y + offset,
      zIndex: this.getNextZIndex(nodes),
    };
  }

  cloneNodes(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) => ({
      ...node,
    }));
  }

  cloneConnections(connections: DiagramConnection[]): DiagramConnection[] {
    return connections.map((connection) => this.cloneConnection(connection));
  }

  private duplicateConnection(
    connection: DiagramConnection,
    nodeIdMap: Map<string, string>,
    offset: number,
  ): DiagramConnection {
    return {
      ...connection,
      id: crypto.randomUUID(),
      sourceNodeId: nodeIdMap.get(connection.sourceNodeId) || connection.sourceNodeId,
      targetNodeId: nodeIdMap.get(connection.targetNodeId) || connection.targetNodeId,
      bendPoints:
        connection.bendPoints?.map((point) => ({
          x: point.x + offset,
          y: point.y + offset,
        })) || [],
      labels:
        connection.labels?.map((label) => ({
          ...label,
          id: crypto.randomUUID(),
          x: label.x + offset,
          y: label.y + offset,
        })) || [],
    };
  }

  private cloneConnection(connection: DiagramConnection): DiagramConnection {
    return {
      ...connection,
      bendPoints:
        connection.bendPoints?.map((point) => ({
          ...point,
        })) || [],
      labels:
        connection.labels?.map((label) => ({
          ...label,
        })) || [],
    };
  }

  private getNextZIndex(nodes: DiagramNode[]): number {
    if (!nodes.length) return 1;
    return Math.max(...nodes.map((node) => node.zIndex || 0)) + 1;
  }
}
