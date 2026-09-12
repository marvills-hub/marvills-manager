import { Injectable } from '@angular/core';
import {
  DiagramConnection,
  DiagramConnectorSide,
  DiagramNode,
  DiagramPoint,
} from '../../../../../core/models/diagram.model';

export interface DiagramSelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramNearestPort {
  node: DiagramNode;
  side: DiagramConnectorSide;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramGeometryService {
  getNodePosition(
    node: DiagramNode,
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramPoint {
    return (
      dragPositions[node.id] || {
        x: node.x,
        y: node.y,
      }
    );
  }

  getNodeCenter(node: DiagramNode, dragPositions: Record<string, DiagramPoint> = {}): DiagramPoint {
    const position = this.getNodePosition(node, dragPositions);
    return {
      x: position.x + node.width / 2,
      y: position.y + node.height / 2,
    };
  }

  getPortCenter(
    node: DiagramNode,
    side: DiagramConnectorSide,
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramPoint {
    const position = this.getNodePosition(node, dragPositions);
    const left = position.x;
    const top = position.y;
    const right = left + node.width;
    const bottom = top + node.height;
    const centerX = left + node.width / 2;
    const centerY = top + node.height / 2;
    if (node.type === 'rounded') {
      if (side === 'top-left') {
        return {
          x: left - 4,
          y: top,
        };
      }
      if (side === 'top-right') {
        return {
          x: right + 4,
          y: top,
        };
      }
      if (side === 'bottom-right') {
        return {
          x: right + 4,
          y: bottom,
        };
      }
      if (side === 'bottom-left') {
        return {
          x: left,
          y: bottom + 4,
        };
      }
    }
    if (node.type === 'circle') {
      const radiusX = node.width / 2;
      const radiusY = node.height / 2;
      if (side === 'top') {
        return {
          x: centerX,
          y: top - 8,
        };
      }
      if (side === 'right') {
        return {
          x: right + 8,
          y: centerY,
        };
      }
      if (side === 'bottom') {
        return {
          x: centerX,
          y: bottom + 8,
        };
      }
      if (side === 'left') {
        return {
          x: left - 8,
          y: centerY,
        };
      }
      const direction = this.getSideDirection(side);
      const denominator = Math.sqrt(
        (direction.x * direction.x) / (radiusX * radiusX) +
          (direction.y * direction.y) / (radiusY * radiusY),
      );
      const scale = denominator ? 1 / denominator : 0;
      return {
        x: centerX + direction.x * scale + Math.sign(direction.x) * 8,
        y: centerY + direction.y * scale + Math.sign(direction.y) * 8,
      };
    }
    if (node.type === 'diamond') {
      if (side === 'top') {
        return {
          x: centerX,
          y: top - 8,
        };
      }
      if (side === 'right') {
        return {
          x: right + 8,
          y: centerY,
        };
      }
      if (side === 'bottom') {
        return {
          x: centerX,
          y: bottom + 8,
        };
      }
      if (side === 'left') {
        return {
          x: left - 8,
          y: centerY,
        };
      }
      if (side === 'top-left') {
        return {
          x: left + node.width * 0.25 - 8,
          y: top + node.height * 0.25 - 8,
        };
      }
      if (side === 'top-right') {
        return {
          x: left + node.width * 0.75 + 8,
          y: top + node.height * 0.25 - 8,
        };
      }
      if (side === 'bottom-right') {
        return {
          x: left + node.width * 0.75 + 8,
          y: top + node.height * 0.75 + 8,
        };
      }
      return {
        x: left + node.width * 0.25 - 8,
        y: top + node.height * 0.75 + 8,
      };
    }
    if (side === 'top-left') {
      return {
        x: left - 8,
        y: top - 8,
      };
    }
    if (side === 'top') {
      return {
        x: centerX,
        y: top - 8,
      };
    }
    if (side === 'top-right') {
      return {
        x: right + 8,
        y: top - 8,
      };
    }
    if (side === 'right') {
      return {
        x: right + 8,
        y: centerY,
      };
    }
    if (side === 'bottom-right') {
      return {
        x: right + 8,
        y: bottom + 8,
      };
    }
    if (side === 'bottom') {
      return {
        x: centerX,
        y: bottom + 8,
      };
    }
    if (side === 'bottom-left') {
      return {
        x: left - 8,
        y: bottom + 8,
      };
    }
    return {
      x: left - 8,
      y: centerY,
    };
  }

  getSideDirection(side: DiagramConnectorSide): DiagramPoint {
    if (side === 'top-left') {
      return {
        x: -Math.SQRT1_2,
        y: -Math.SQRT1_2,
      };
    }
    if (side === 'top') {
      return {
        x: 0,
        y: -1,
      };
    }
    if (side === 'top-right') {
      return {
        x: Math.SQRT1_2,
        y: -Math.SQRT1_2,
      };
    }
    if (side === 'right') {
      return {
        x: 1,
        y: 0,
      };
    }
    if (side === 'bottom-right') {
      return {
        x: Math.SQRT1_2,
        y: Math.SQRT1_2,
      };
    }
    if (side === 'bottom') {
      return {
        x: 0,
        y: 1,
      };
    }
    if (side === 'bottom-left') {
      return {
        x: -Math.SQRT1_2,
        y: Math.SQRT1_2,
      };
    }
    return {
      x: -1,
      y: 0,
    };
  }

  getBestSide(
    source: DiagramNode,
    target: DiagramNode,
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramConnectorSide {
    const sourceCenter = this.getNodeCenter(source, dragPositions);
    const targetCenter = this.getNodeCenter(target, dragPositions);
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle >= -22.5 && angle < 22.5) return 'right';
    if (angle >= 22.5 && angle < 67.5) return 'bottom-right';
    if (angle >= 67.5 && angle < 112.5) return 'bottom';
    if (angle >= 112.5 && angle < 157.5) return 'bottom-left';
    if (angle >= 157.5 || angle < -157.5) return 'left';
    if (angle >= -157.5 && angle < -112.5) return 'top-left';
    if (angle >= -112.5 && angle < -67.5) return 'top';
    return 'top-right';
  }

  getConnectionSourcePoint(
    connection: DiagramConnection,
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramPoint {
    const source = nodes.find((node) => node.id === connection.sourceNodeId);
    const target = nodes.find((node) => node.id === connection.targetNodeId);
    if (!source) {
      return {
        x: 0,
        y: 0,
      };
    }
    return this.getPortCenter(
      source,
      connection.sourceSide || (target ? this.getBestSide(source, target, dragPositions) : 'right'),
      dragPositions,
    );
  }

  getConnectionTargetPoint(
    connection: DiagramConnection,
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramPoint {
    const source = nodes.find((node) => node.id === connection.sourceNodeId);
    const target = nodes.find((node) => node.id === connection.targetNodeId);
    if (!target) {
      return {
        x: 0,
        y: 0,
      };
    }
    return this.getPortCenter(
      target,
      connection.targetSide || (source ? this.getBestSide(target, source, dragPositions) : 'left'),
      dragPositions,
    );
  }

  getConnectionCenterPoint(
    connection: DiagramConnection,
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
  ): DiagramPoint {
    const bends = connection.bendPoints || [];
    if (bends.length) {
      return {
        ...bends[Math.floor(bends.length / 2)],
      };
    }
    const source = this.getConnectionSourcePoint(connection, nodes, dragPositions);
    const target = this.getConnectionTargetPoint(connection, nodes, dragPositions);
    return {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2,
    };
  }

  moveTowards(from: DiagramPoint, to: DiagramPoint, distance: number): DiagramPoint {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (!length) return from;
    return {
      x: from.x + (dx / length) * distance,
      y: from.y + (dy / length) * distance,
    };
  }

  clientToCanvas(
    canvas: HTMLElement | undefined,
    clientX: number,
    clientY: number,
    zoom: number,
  ): DiagramPoint | null {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }

  getClosestSegmentIndex(points: DiagramPoint[], target: DiagramPoint): number {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length - 1; index++) {
      const distance = this.getPointToSegmentDistance(target, points[index], points[index + 1]);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    return closestIndex;
  }

  getPointToSegmentDistance(point: DiagramPoint, start: DiagramPoint, end: DiagramPoint): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (!dx && !dy) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const t = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
    );
    const x = start.x + t * dx;
    const y = start.y + t * dy;
    return Math.hypot(point.x - x, point.y - y);
  }

  findNearestPort(
    point: DiagramPoint,
    nodes: DiagramNode[],
    connectorSides: DiagramConnectorSide[],
    dragPositions: Record<string, DiagramPoint> = {},
    maximumDistance = 28,
  ): DiagramNearestPort | null {
    let nearest: {
      node: DiagramNode;
      side: DiagramConnectorSide;
      distance: number;
    } | null = null;
    for (const node of nodes) {
      for (const side of connectorSides) {
        const port = this.getPortCenter(node, side, dragPositions);
        const distance = Math.hypot(port.x - point.x, port.y - point.y);
        if (distance <= maximumDistance && (!nearest || distance < nearest.distance)) {
          nearest = {
            node,
            side,
            distance,
          };
        }
      }
    }
    return nearest
      ? {
          node: nearest.node,
          side: nearest.side,
        }
      : null;
  }

  doesNodeIntersectRect(
    node: DiagramNode,
    rect: DiagramSelectionRect,
    dragPositions: Record<string, DiagramPoint> = {},
  ): boolean {
    const position = this.getNodePosition(node, dragPositions);
    const nodeLeft = position.x;
    const nodeTop = position.y;
    const nodeRight = position.x + node.width;
    const nodeBottom = position.y + node.height;
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;
    return (
      nodeLeft <= rectRight && nodeRight >= rect.x && nodeTop <= rectBottom && nodeBottom >= rect.y
    );
  }

  doesConnectionIntersectRect(
    connection: DiagramConnection,
    rect: DiagramSelectionRect,
    nodes: DiagramNode[],
    dragPositions: Record<string, DiagramPoint> = {},
    sourceOverride?: DiagramPoint,
    targetOverride?: DiagramPoint,
  ): boolean {
    const points = [
      sourceOverride || this.getConnectionSourcePoint(connection, nodes, dragPositions),
      ...(connection.bendPoints || []),
      targetOverride || this.getConnectionTargetPoint(connection, nodes, dragPositions),
    ];
    for (const point of points) {
      if (this.isPointInsideRect(point, rect)) return true;
    }
    for (let index = 0; index < points.length - 1; index++) {
      if (this.doesSegmentIntersectRect(points[index], points[index + 1], rect)) {
        return true;
      }
    }
    return false;
  }

  isPointInsideRect(point: DiagramPoint, rect: DiagramSelectionRect): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  doesSegmentIntersectRect(
    start: DiagramPoint,
    end: DiagramPoint,
    rect: DiagramSelectionRect,
  ): boolean {
    if (this.isPointInsideRect(start, rect) || this.isPointInsideRect(end, rect)) {
      return true;
    }
    const topLeft = {
      x: rect.x,
      y: rect.y,
    };
    const topRight = {
      x: rect.x + rect.width,
      y: rect.y,
    };
    const bottomRight = {
      x: rect.x + rect.width,
      y: rect.y + rect.height,
    };
    const bottomLeft = {
      x: rect.x,
      y: rect.y + rect.height,
    };
    return (
      this.doSegmentsIntersect(start, end, topLeft, topRight) ||
      this.doSegmentsIntersect(start, end, topRight, bottomRight) ||
      this.doSegmentsIntersect(start, end, bottomRight, bottomLeft) ||
      this.doSegmentsIntersect(start, end, bottomLeft, topLeft)
    );
  }

  doSegmentsIntersect(
    firstStart: DiagramPoint,
    firstEnd: DiagramPoint,
    secondStart: DiagramPoint,
    secondEnd: DiagramPoint,
  ): boolean {
    const firstX = firstEnd.x - firstStart.x;
    const firstY = firstEnd.y - firstStart.y;
    const secondX = secondEnd.x - secondStart.x;
    const secondY = secondEnd.y - secondStart.y;
    const denominator = firstX * secondY - firstY * secondX;
    if (Math.abs(denominator) < 0.0001) {
      return this.doCollinearSegmentsOverlap(firstStart, firstEnd, secondStart, secondEnd);
    }
    const deltaX = secondStart.x - firstStart.x;
    const deltaY = secondStart.y - firstStart.y;
    const firstPosition = (deltaX * secondY - deltaY * secondX) / denominator;
    const secondPosition = (deltaX * firstY - deltaY * firstX) / denominator;
    return firstPosition >= 0 && firstPosition <= 1 && secondPosition >= 0 && secondPosition <= 1;
  }

  private doCollinearSegmentsOverlap(
    firstStart: DiagramPoint,
    firstEnd: DiagramPoint,
    secondStart: DiagramPoint,
    secondEnd: DiagramPoint,
  ): boolean {
    const cross =
      (secondStart.x - firstStart.x) * (firstEnd.y - firstStart.y) -
      (secondStart.y - firstStart.y) * (firstEnd.x - firstStart.x);
    if (Math.abs(cross) > 0.0001) return false;
    const firstMinX = Math.min(firstStart.x, firstEnd.x);
    const firstMaxX = Math.max(firstStart.x, firstEnd.x);
    const firstMinY = Math.min(firstStart.y, firstEnd.y);
    const firstMaxY = Math.max(firstStart.y, firstEnd.y);
    const secondMinX = Math.min(secondStart.x, secondEnd.x);
    const secondMaxX = Math.max(secondStart.x, secondEnd.x);
    const secondMinY = Math.min(secondStart.y, secondEnd.y);
    const secondMaxY = Math.max(secondStart.y, secondEnd.y);
    return (
      firstMaxX >= secondMinX &&
      secondMaxX >= firstMinX &&
      firstMaxY >= secondMinY &&
      secondMaxY >= firstMinY
    );
  }
}
