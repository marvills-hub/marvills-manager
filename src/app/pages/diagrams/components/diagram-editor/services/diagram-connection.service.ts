import { Injectable } from '@angular/core';
import {
  DiagramConnection,
  DiagramConnectionLabel,
  DiagramConnectionStyle,
  DiagramConnectionType,
  DiagramConnectorSide,
  DiagramGridSettings,
  DiagramNode,
  DiagramPoint,
} from '../../../../../core/models/diagram.model';
import {
  DIAGRAM_CONNECTION_CONFIG,
  DIAGRAM_CONNECTION_STYLE_CONFIG,
} from '../constants/diagram-connection.constant';
import { DiagramGeometryService } from './diagram-geometry.service';
import { DiagramGridService } from './diagram-grid.service';
@Injectable({
  providedIn: 'root',
})
export class DiagramConnectionService {
  constructor(
    private readonly geometry: DiagramGeometryService,
    private readonly grid: DiagramGridService,
  ) {}
  createConnection(
    sourceNodeId: string,
    targetNodeId: string,
    sourceSide: DiagramConnectorSide,
    targetSide: DiagramConnectorSide,
    type: DiagramConnectionType,
    style: DiagramConnectionStyle = 'solid',
  ): DiagramConnection {
    return {
      id: crypto.randomUUID(),
      sourceNodeId,
      targetNodeId,
      sourceSide,
      targetSide,
      type,
      style,
      color: this.getDefaultColor(type),
      bendPoints: [],
      labels: [],
    };
  }
  normalizeConnection(connection: DiagramConnection): DiagramConnection {
    const labels =
      connection.labels?.map((label) => ({
        ...label,
      })) || [];
    if (connection.label?.trim() && !labels.length) {
      labels.push({
        id: this.getLegacyLabelId(connection),
        text: connection.label,
        x: 0,
        y: 0,
      });
    }
    return {
      ...connection,
      style: connection.style || 'solid',
      color: connection.color || this.getDefaultColor(connection.type),
      bendPoints: connection.bendPoints?.map((point) => ({ ...point })) || [],
      labels,
    };
  }
  normalizeConnections(connections: DiagramConnection[]): DiagramConnection[] {
    return connections.map((connection) => this.normalizeConnection(connection));
  }
  getDefaultColor(type: DiagramConnectionType): string {
    return DIAGRAM_CONNECTION_CONFIG[type].color;
  }
  getStartMarker(type: DiagramConnectionType): string | null {
    return DIAGRAM_CONNECTION_CONFIG[type].startMarker;
  }
  getEndMarker(type: DiagramConnectionType): string | null {
    return DIAGRAM_CONNECTION_CONFIG[type].endMarker;
  }
  getLabel(type: DiagramConnectionType): string {
    return DIAGRAM_CONNECTION_CONFIG[type].label;
  }
  getDashArray(style?: DiagramConnectionStyle): string | null {
    return DIAGRAM_CONNECTION_STYLE_CONFIG[style || 'solid'].dashArray;
  }
  updateType(
    selectedConnectionIds: Set<string>,
    type: DiagramConnectionType,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    if (!selectedConnectionIds.size) return connections;
    return connections.map((connection) => {
      if (!selectedConnectionIds.has(connection.id)) return connection;
      const previousDefaultColor = this.getDefaultColor(connection.type);
      const shouldUpdateColor = !connection.color || connection.color === previousDefaultColor;
      return {
        ...connection,
        type,
        color: shouldUpdateColor ? this.getDefaultColor(type) : connection.color,
      };
    });
  }
  updateStyle(
    selectedConnectionIds: Set<string>,
    style: DiagramConnectionStyle,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    if (!selectedConnectionIds.size) return connections;
    return connections.map((connection) =>
      selectedConnectionIds.has(connection.id)
        ? {
            ...connection,
            style,
          }
        : connection,
    );
  }
  updateColor(
    selectedConnectionIds: Set<string>,
    color: string,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    if (!selectedConnectionIds.size) return connections;
    return connections.map((connection) =>
      selectedConnectionIds.has(connection.id) && connection.color !== color
        ? {
            ...connection,
            color,
          }
        : connection,
    );
  }
  deleteConnections(
    selectedConnectionIds: Set<string>,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    if (!selectedConnectionIds.size) return connections;
    return connections.filter((connection) => !selectedConnectionIds.has(connection.id));
  }
  deleteConnectionsForNodes(
    nodeIds: Set<string>,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    if (!nodeIds.size) return connections;
    return connections.filter(
      (connection) =>
        !nodeIds.has(connection.sourceNodeId) && !nodeIds.has(connection.targetNodeId),
    );
  }
  getConnectionById(
    connectionId: string | null,
    connections: DiagramConnection[],
  ): DiagramConnection | null {
    if (!connectionId) return null;
    return connections.find((connection) => connection.id === connectionId) || null;
  }
  getSelectedConnections(
    selectedConnectionIds: Set<string>,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    return connections.filter((connection) => selectedConnectionIds.has(connection.id));
  }
  addBendPoint(
    connectionId: string,
    point: DiagramPoint,
    connections: DiagramConnection[],
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
    gridSettings?: DiagramGridSettings,
  ): DiagramConnection[] {
    const targetPoint = gridSettings ? this.grid.snapPoint(point, gridSettings) : point;
    return connections.map((connection) => {
      if (connection.id !== connectionId) return connection;
      const points = this.getConnectionPoints(connection, nodes, dragPositions);
      const segmentIndex = this.geometry.getClosestSegmentIndex(points, targetPoint);
      const bendPoints = [...(connection.bendPoints || [])];
      bendPoints.splice(segmentIndex, 0, {
        ...targetPoint,
      });
      return {
        ...connection,
        bendPoints,
      };
    });
  }
  updateBendPoint(
    connectionId: string,
    index: number,
    point: DiagramPoint,
    connections: DiagramConnection[],
    gridSettings?: DiagramGridSettings,
  ): DiagramConnection[] {
    const targetPoint = gridSettings ? this.grid.snapPoint(point, gridSettings) : point;
    return connections.map((connection) => {
      if (connection.id !== connectionId) return connection;
      return {
        ...connection,
        bendPoints:
          connection.bendPoints?.map((bend, bendIndex) =>
            bendIndex === index
              ? {
                  ...targetPoint,
                }
              : bend,
          ) || [],
      };
    });
  }
  deleteBendPoint(
    connectionId: string,
    index: number,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    return connections.map((connection) =>
      connection.id === connectionId
        ? {
            ...connection,
            bendPoints: connection.bendPoints?.filter((_, bendIndex) => bendIndex !== index) || [],
          }
        : connection,
    );
  }
  clearBendPoints(connectionId: string, connections: DiagramConnection[]): DiagramConnection[] {
    return connections.map((connection) =>
      connection.id === connectionId
        ? {
            ...connection,
            bendPoints: [],
          }
        : connection,
    );
  }
  addLabel(
    connectionId: string,
    text: string,
    point: DiagramPoint,
    connections: DiagramConnection[],
  ): {
    connections: DiagramConnection[];
    labelId: string | null;
  } {
    const labelId = crypto.randomUUID();
    let added = false;
    const updated = connections.map((connection) => {
      if (connection.id !== connectionId) return connection;
      added = true;
      const label: DiagramConnectionLabel = {
        id: labelId,
        text,
        x: point.x,
        y: point.y,
      };
      return {
        ...connection,
        labels: [...(connection.labels || []), label],
      };
    });
    return {
      connections: updated,
      labelId: added ? labelId : null,
    };
  }
  updateLabelText(
    connectionId: string,
    labelId: string,
    text: string,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    return connections.map((connection) => {
      if (connection.id !== connectionId) return connection;
      return {
        ...connection,
        labels:
          connection.labels?.map((label) =>
            label.id === labelId
              ? {
                  ...label,
                  text,
                }
              : label,
          ) || [],
      };
    });
  }
  moveLabel(
    connectionId: string,
    labelId: string,
    point: DiagramPoint,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    return connections.map((connection) => {
      if (connection.id !== connectionId) return connection;
      return {
        ...connection,
        labels:
          connection.labels?.map((label) =>
            label.id === labelId
              ? {
                  ...label,
                  x: point.x,
                  y: point.y,
                }
              : label,
          ) || [],
      };
    });
  }
  deleteLabel(
    connectionId: string,
    labelId: string,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    return connections.map((connection) => {
      if (connection.id !== connectionId) return connection;
      return {
        ...connection,
        labels: connection.labels?.filter((label) => label.id !== labelId) || [],
      };
    });
  }
  getLabelById(
    connection: DiagramConnection | null,
    labelId: string | null,
  ): DiagramConnectionLabel | null {
    if (!connection || !labelId) return null;
    return connection.labels?.find((label) => label.id === labelId) || null;
  }
  reconnectSource(
    connectionId: string,
    nodeId: string,
    side: DiagramConnectorSide,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    return connections.map((connection) =>
      connection.id === connectionId
        ? {
            ...connection,
            sourceNodeId: nodeId,
            sourceSide: side,
          }
        : connection,
    );
  }
  reconnectTarget(
    connectionId: string,
    nodeId: string,
    side: DiagramConnectorSide,
    connections: DiagramConnection[],
  ): DiagramConnection[] {
    return connections.map((connection) =>
      connection.id === connectionId
        ? {
            ...connection,
            targetNodeId: nodeId,
            targetSide: side,
          }
        : connection,
    );
  }
  getConnectionPoints(
    connection: DiagramConnection,
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramPoint[] {
    return [
      this.geometry.getConnectionSourcePoint(connection, nodes, dragPositions),
      ...(connection.bendPoints || []).map((point) => ({ ...point })),
      this.geometry.getConnectionTargetPoint(connection, nodes, dragPositions),
    ];
  }
  getConnectionPath(
    connection: DiagramConnection,
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
  ): string {
    const points = this.getConnectionPoints(connection, nodes, dragPositions);
    if (!points.length) return '';
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  }
  getConnectionCenter(
    connection: DiagramConnection,
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramPoint {
    const points = this.getConnectionPoints(connection, nodes, dragPositions);
    if (!points.length) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];
    const totalLength = this.getPolylineLength(points);
    if (!totalLength) return points[0];
    const targetDistance = totalLength / 2;
    let travelled = 0;
    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index];
      const end = points[index + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (travelled + length >= targetDistance) {
        const remaining = targetDistance - travelled;
        const ratio = length ? remaining / length : 0;
        return {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        };
      }
      travelled += length;
    }
    return points.at(-1) || { x: 0, y: 0 };
  }
  hasConnectionBetween(
    sourceNodeId: string,
    targetNodeId: string,
    connections: DiagramConnection[],
  ): boolean {
    return connections.some(
      (connection) =>
        connection.sourceNodeId === sourceNodeId && connection.targetNodeId === targetNodeId,
    );
  }
  isPortConnected(
    nodeId: string,
    side: DiagramConnectorSide,
    connections: DiagramConnection[],
  ): boolean {
    return connections.some(
      (connection) =>
        (connection.sourceNodeId === nodeId && connection.sourceSide === side) ||
        (connection.targetNodeId === nodeId && connection.targetSide === side),
    );
  }
  private getPolylineLength(points: DiagramPoint[]): number {
    let total = 0;
    for (let index = 0; index < points.length - 1; index++) {
      total += Math.hypot(
        points[index + 1].x - points[index].x,
        points[index + 1].y - points[index].y,
      );
    }
    return total;
  }
  private getLegacyLabelId(connection: DiagramConnection): string {
    return `legacy-${connection.id}`;
  }
}
