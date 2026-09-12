import { Injectable } from '@angular/core';
import {
  DiagramGridSettings,
  DiagramNode,
  DiagramNodeType,
  DiagramProjectData,
  DiagramTableData,
} from '../../../../../core/models/diagram.model';
import { DIAGRAM_NODE_CONFIG } from '../constants/diagram-node.constant';
import { DiagramGridService } from './diagram-grid.service';
import { DiagramTableService } from './diagram-table.service';
export interface DiagramNodeSize {
  width: number;
  height: number;
}
@Injectable({
  providedIn: 'root',
})
export class DiagramNodeService {
  constructor(
    private readonly grid: DiagramGridService,
    private readonly table: DiagramTableService,
  ) {}
  createNode(
    type: DiagramNodeType,
    x: number,
    y: number,
    nodes: DiagramNode[],
    gridSettings?: DiagramGridSettings,
  ): DiagramNode {
    const config = DIAGRAM_NODE_CONFIG[type];
    const position = gridSettings ? this.grid.snapPoint({ x, y }, gridSettings) : { x, y };
    const node: DiagramNode = {
      id: crypto.randomUUID(),
      type,
      text: config.text,
      x: position.x,
      y: position.y,
      width: config.width,
      height: config.height,
      background: config.background,
      color: config.color,
      borderColor: config.borderColor,
      zIndex: this.getNextZIndex(nodes),
    };
    if (type === 'table') node.table = this.table.create();
    return node;
  }
  createTableNode(
    x: number,
    y: number,
    nodes: DiagramNode[],
    rows = 3,
    columns = 3,
    gridSettings?: DiagramGridSettings,
  ): DiagramNode {
    const node = this.createNode('table', x, y, nodes, gridSettings);
    return {
      ...node,
      table: this.table.create(rows, columns),
    };
  }
  createProjectNode(
    project: DiagramProjectData,
    x: number,
    y: number,
    nodes: DiagramNode[],
    gridSettings?: DiagramGridSettings,
  ): DiagramNode {
    const node = this.createNode('project', x, y, nodes, gridSettings);
    return {
      ...node,
      text: project.name,
      project: {
        ...project,
      },
    };
  }
  getNextZIndex(nodes: DiagramNode[]): number {
    if (!nodes.length) return 1;
    return Math.max(...nodes.map((node) => node.zIndex || 0)) + 1;
  }
  bringToFront(nodeId: string, nodes: DiagramNode[]): DiagramNode[] {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return nodes;
    const nextZIndex = this.getNextZIndex(nodes);
    return nodes.map((item) =>
      item.id === nodeId
        ? {
            ...item,
            zIndex: nextZIndex,
          }
        : item,
    );
  }
  bringSelectionToFront(selectedNodeIds: Set<string>, nodes: DiagramNode[]): DiagramNode[] {
    if (!selectedNodeIds.size) return nodes;
    let zIndex = this.getNextZIndex(nodes);
    return nodes.map((node) =>
      selectedNodeIds.has(node.id)
        ? {
            ...node,
            zIndex: zIndex++,
          }
        : node,
    );
  }
  updateText(nodeId: string, text: string, nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            text,
          }
        : node,
    );
  }
  updateBorderColor(
    selectedNodeIds: Set<string>,
    color: string,
    nodes: DiagramNode[],
  ): DiagramNode[] {
    return nodes.map((node) => {
      if (
        !selectedNodeIds.has(node.id) ||
        !DIAGRAM_NODE_CONFIG[node.type].canHaveBorder ||
        node.borderColor === color
      )
        return node;
      return {
        ...node,
        borderColor: color,
      };
    });
  }
  updateBackgroundColor(
    selectedNodeIds: Set<string>,
    color: string,
    nodes: DiagramNode[],
  ): DiagramNode[] {
    return nodes.map((node) => {
      if (
        !selectedNodeIds.has(node.id) ||
        !DIAGRAM_NODE_CONFIG[node.type].canHaveBackground ||
        node.background === color
      )
        return node;
      return {
        ...node,
        background: color,
      };
    });
  }
  updateTextColor(
    selectedNodeIds: Set<string>,
    color: string,
    nodes: DiagramNode[],
  ): DiagramNode[] {
    return nodes.map((node) =>
      selectedNodeIds.has(node.id) && node.color !== color
        ? {
            ...node,
            color,
          }
        : node,
    );
  }
  deleteNodes(selectedNodeIds: Set<string>, nodes: DiagramNode[]): DiagramNode[] {
    if (!selectedNodeIds.size) return nodes;
    return nodes.filter((node) => !selectedNodeIds.has(node.id));
  }
  resizeNode(
    nodeId: string,
    width: number,
    height: number,
    nodes: DiagramNode[],
    gridSettings?: DiagramGridSettings,
  ): DiagramNode[] {
    const node = this.getNodeById(nodeId, nodes);
    if (!node) return nodes;
    const config = DIAGRAM_NODE_CONFIG[node.type];
    let nextWidth = Math.max(config.width, width);
    let nextHeight = Math.max(config.height, height);
    if (config.proportionalResize) {
      const size = Math.max(nextWidth, nextHeight);
      nextWidth = size;
      nextHeight = size;
    }
    if (gridSettings) {
      const size = this.grid.snapSize(nextWidth, nextHeight, gridSettings);
      nextWidth = size.width;
      nextHeight = size.height;
      if (config.proportionalResize) {
        const proportionalSize = Math.max(nextWidth, nextHeight);
        nextWidth = proportionalSize;
        nextHeight = proportionalSize;
      }
    }
    return nodes.map((item) =>
      item.id === nodeId
        ? {
            ...item,
            width: nextWidth,
            height: nextHeight,
          }
        : item,
    );
  }
  moveNode(
    nodeId: string,
    x: number,
    y: number,
    nodes: DiagramNode[],
    gridSettings?: DiagramGridSettings,
  ): DiagramNode[] {
    const position = gridSettings ? this.grid.snapPoint({ x, y }, gridSettings) : { x, y };
    return nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            x: position.x,
            y: position.y,
          }
        : node,
    );
  }
  moveNodes(
    positions: Record<string, { x: number; y: number }>,
    nodes: DiagramNode[],
    gridSettings?: DiagramGridSettings,
  ): DiagramNode[] {
    return nodes.map((node) => {
      const position = positions[node.id];
      if (!position) return node;
      const next = gridSettings ? this.grid.snapPoint(position, gridSettings) : position;
      return {
        ...node,
        x: next.x,
        y: next.y,
      };
    });
  }
  updateTable(nodeId: string, table: DiagramTableData, nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            table: this.table.normalize(table),
          }
        : node,
    );
  }
  updateProject(nodeId: string, project: DiagramProjectData, nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            text: project.name,
            project: {
              ...project,
            },
          }
        : node,
    );
  }
  autoGrowNode(
    node: DiagramNode,
    scrollWidth: number,
    scrollHeight: number,
    gridSettings?: DiagramGridSettings,
  ): DiagramNodeSize {
    const config = DIAGRAM_NODE_CONFIG[node.type];
    let width: number;
    let height: number;
    if (config.proportionalResize) {
      const size = Math.max(config.width, config.height, scrollWidth, scrollHeight);
      width = size;
      height = size;
    } else {
      width = Math.max(config.width, scrollWidth);
      height = Math.max(config.height, scrollHeight);
    }
    if (!gridSettings) return { width, height };
    const snapped = this.grid.snapSize(width, height, gridSettings);
    if (!config.proportionalResize) return snapped;
    const size = Math.max(snapped.width, snapped.height);
    return {
      width: size,
      height: size,
    };
  }
  normalizeNode(node: DiagramNode): DiagramNode {
    const config = DIAGRAM_NODE_CONFIG[node.type] || DIAGRAM_NODE_CONFIG.rectangle;
    const normalized: DiagramNode = {
      ...node,
      text: node.text ?? config.text,
      width: node.width || config.width,
      height: node.height || config.height,
      background: node.background ?? config.background,
      color: node.color ?? config.color,
      borderColor: node.borderColor ?? config.borderColor,
      zIndex: node.zIndex || 1,
    };
    if (normalized.type === 'table') normalized.table = this.table.normalize(normalized.table);
    return normalized;
  }
  normalizeNodes(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) => this.normalizeNode(node));
  }
  getMinimumSize(type: DiagramNodeType): DiagramNodeSize {
    const config = DIAGRAM_NODE_CONFIG[type];
    return {
      width: config.width,
      height: config.height,
    };
  }
  isProportionalShape(type: DiagramNodeType): boolean {
    return DIAGRAM_NODE_CONFIG[type].proportionalResize;
  }
  canHaveBackground(type: DiagramNodeType): boolean {
    return DIAGRAM_NODE_CONFIG[type].canHaveBackground;
  }
  canHaveBorder(type: DiagramNodeType): boolean {
    return DIAGRAM_NODE_CONFIG[type].canHaveBorder;
  }
  getSelectedNodes(selectedNodeIds: Set<string>, nodes: DiagramNode[]): DiagramNode[] {
    return nodes.filter((node) => selectedNodeIds.has(node.id));
  }
  getNodeById(nodeId: string | null, nodes: DiagramNode[]): DiagramNode | null {
    if (!nodeId) return null;
    return nodes.find((node) => node.id === nodeId) || null;
  }
  getDefaultWidth(type: DiagramNodeType): number {
    return DIAGRAM_NODE_CONFIG[type].width;
  }
  getDefaultHeight(type: DiagramNodeType): number {
    return DIAGRAM_NODE_CONFIG[type].height;
  }
  getDefaultText(type: DiagramNodeType): string {
    return DIAGRAM_NODE_CONFIG[type].text;
  }
  getDefaultBackground(type: DiagramNodeType): string {
    return DIAGRAM_NODE_CONFIG[type].background;
  }
  getDefaultTextColor(type: DiagramNodeType): string {
    return DIAGRAM_NODE_CONFIG[type].color;
  }
  getDefaultBorderColor(type: DiagramNodeType): string {
    return DIAGRAM_NODE_CONFIG[type].borderColor;
  }
}
