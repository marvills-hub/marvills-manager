import { CommonModule } from '@angular/common';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DiagramConnection,
  DiagramConnectionType,
  DiagramNode,
  DiagramNodeType,
} from '../../../../core/models/diagram.model';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './diagram-editor.component.html',
  styleUrl: './diagram-editor.component.scss',
})
export class DiagramEditorComponent implements OnChanges {
  @Input() nodes: DiagramNode[] = [];
  @Input() connections: DiagramConnection[] = [];
  @Input() canManage = false;

  @Output() graphChange = new EventEmitter<{
    nodes: DiagramNode[];
    connections: DiagramConnection[];
  }>();

  localNodes: DiagramNode[] = [];
  localConnections: DiagramConnection[] = [];
  selectedNodeId: string | null = null;
  selectedConnectionId: string | null = null;
  connectionSourceId: string | null = null;
  connectionType: DiagramConnectionType = 'arrow';
  zoom = 1;

  readonly connectionTypes: {
    value: DiagramConnectionType;
    label: string;
  }[] = [
    { value: 'arrow', label: 'Arrow' },
    { value: 'line', label: 'Line' },
    { value: 'one-to-one', label: 'One to One' },
    { value: 'one-to-many', label: 'One to Many' },
    { value: 'zero-to-one', label: 'Zero to One' },
    { value: 'zero-to-many', label: 'Zero to Many' },
    { value: 'many-to-many', label: 'Many to Many' },
  ];

  private resizingNodeId: string | null = null;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes']) {
      this.localNodes = this.nodes.map((node) => ({ ...node }));
    }
    if (changes['connections']) {
      this.localConnections = this.connections.map((connection) => ({
        ...connection,
        type: connection.type || 'arrow',
      }));
    }
  }

  addNode(type: DiagramNodeType): void {
    if (!this.canManage) return;
    const count = this.localNodes.length;
    const defaults = this.getNodeDefaults(type);
    const node: DiagramNode = {
      id: crypto.randomUUID(),
      type,
      text: defaults.text,
      x: 90 + (count % 5) * 35,
      y: 80 + (count % 6) * 30,
      width: defaults.width,
      height: defaults.height,
      background: defaults.background,
      color: '#eaf1ff',
      borderColor: '#536fff',
      zIndex: this.getNextZIndex(),
    };
    this.localNodes = [...this.localNodes, node];
    this.selectedNodeId = node.id;
    this.selectedConnectionId = null;
    this.emitChange();
  }

  selectNode(node: DiagramNode, event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedConnectionId = null;
    if (this.connectionSourceId && this.connectionSourceId !== node.id) {
      this.createConnection(this.connectionSourceId, node.id);
      this.connectionSourceId = null;
      this.selectedNodeId = node.id;
      return;
    }
    this.selectedNodeId = node.id;
  }

  selectConnection(connection: DiagramConnection, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedConnectionId = connection.id;
    this.selectedNodeId = null;
    this.connectionSourceId = null;
  }

  deselect(): void {
    this.selectedNodeId = null;
    this.selectedConnectionId = null;
    this.connectionSourceId = null;
  }

  startConnection(node: DiagramNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.canManage) return;
    this.selectedNodeId = node.id;
    this.selectedConnectionId = null;
    this.connectionSourceId = node.id;
  }

  cancelConnection(): void {
    this.connectionSourceId = null;
  }

  nodeDragEnded(node: DiagramNode, event: CdkDragEnd): void {
    if (!this.canManage) return;
    const position = event.source.getFreeDragPosition();
    node.x = Math.max(0, position.x);
    node.y = Math.max(0, position.y);
    node.zIndex = this.getNextZIndex();
    this.localNodes = [...this.localNodes];
    this.emitChange();
  }

  updateNodeText(node: DiagramNode, value: string): void {
    if (!this.canManage) return;
    node.text = value;
    this.emitChange();
  }

  duplicateNode(node: DiagramNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.canManage) return;
    const copy: DiagramNode = {
      ...node,
      id: crypto.randomUUID(),
      x: node.x + 30,
      y: node.y + 30,
      zIndex: this.getNextZIndex(),
    };
    this.localNodes = [...this.localNodes, copy];
    this.selectedNodeId = copy.id;
    this.selectedConnectionId = null;
    this.emitChange();
  }

  deleteNode(node: DiagramNode, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.canManage) return;
    this.localNodes = this.localNodes.filter((item) => item.id !== node.id);
    this.localConnections = this.localConnections.filter(
      (connection) => connection.sourceNodeId !== node.id && connection.targetNodeId !== node.id,
    );
    if (this.selectedNodeId === node.id) this.selectedNodeId = null;
    if (this.connectionSourceId === node.id) this.connectionSourceId = null;
    this.emitChange();
  }

  deleteSelectedConnection(): void {
    if (!this.canManage || !this.selectedConnectionId) return;
    this.localConnections = this.localConnections.filter(
      (connection) => connection.id !== this.selectedConnectionId,
    );
    this.selectedConnectionId = null;
    this.emitChange();
  }

  updateSelectedConnectionType(type: DiagramConnectionType): void {
    if (!this.canManage || !this.selectedConnectionId) return;
    const connection = this.localConnections.find((item) => item.id === this.selectedConnectionId);
    if (!connection) return;
    connection.type = type;
    this.localConnections = [...this.localConnections];
    this.emitChange();
  }

  getSelectedConnection(): DiagramConnection | undefined {
    return this.localConnections.find((connection) => connection.id === this.selectedConnectionId);
  }

  zoomIn(): void {
    this.zoom = Math.min(1.5, Number((this.zoom + 0.1).toFixed(1)));
  }

  zoomOut(): void {
    this.zoom = Math.max(0.5, Number((this.zoom - 0.1).toFixed(1)));
  }

  resetZoom(): void {
    this.zoom = 1;
  }

  startResize(node: DiagramNode, event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage) return;
    this.resizingNodeId = node.id;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartWidth = node.width;
    this.resizeStartHeight = node.height;
    window.addEventListener('pointermove', this.handleResize);
    window.addEventListener('pointerup', this.stopResize);
  }

  getConnectionSource(connection: DiagramConnection): DiagramNode | undefined {
    return this.localNodes.find((node) => node.id === connection.sourceNodeId);
  }

  getConnectionTarget(connection: DiagramConnection): DiagramNode | undefined {
    return this.localNodes.find((node) => node.id === connection.targetNodeId);
  }

  getConnectionStartX(source: DiagramNode, target: DiagramNode): number {
    return this.getConnectionPoint(source, target).x;
  }

  getConnectionStartY(source: DiagramNode, target: DiagramNode): number {
    return this.getConnectionPoint(source, target).y;
  }

  getConnectionEndX(source: DiagramNode, target: DiagramNode): number {
    return this.getConnectionPoint(target, source).x;
  }

  getConnectionEndY(source: DiagramNode, target: DiagramNode): number {
    return this.getConnectionPoint(target, source).y;
  }

  getStartMarker(connection: DiagramConnection): string | null {
    if (connection.type === 'one-to-one') return 'url(#diagram-one)';
    if (connection.type === 'one-to-many') return 'url(#diagram-one)';
    if (connection.type === 'zero-to-one') return 'url(#diagram-zero)';
    if (connection.type === 'zero-to-many') return 'url(#diagram-zero)';
    if (connection.type === 'many-to-many') return 'url(#diagram-many-start)';
    return null;
  }

  getEndMarker(connection: DiagramConnection): string | null {
    if (connection.type === 'arrow') return 'url(#diagram-arrow)';
    if (connection.type === 'one-to-one') return 'url(#diagram-one)';
    if (connection.type === 'one-to-many') return 'url(#diagram-many-end)';
    if (connection.type === 'zero-to-one') return 'url(#diagram-one)';
    if (connection.type === 'zero-to-many') return 'url(#diagram-many-end)';
    if (connection.type === 'many-to-many') return 'url(#diagram-many-end)';
    return null;
  }

  private handleResize = (event: PointerEvent): void => {
    if (!this.resizingNodeId) return;
    const node = this.localNodes.find((item) => item.id === this.resizingNodeId);
    if (!node) return;
    const deltaX = (event.clientX - this.resizeStartX) / this.zoom;
    const deltaY = (event.clientY - this.resizeStartY) / this.zoom;
    node.width = Math.max(80, this.resizeStartWidth + deltaX);
    node.height = Math.max(45, this.resizeStartHeight + deltaY);
    this.localNodes = [...this.localNodes];
  };

  private stopResize = (): void => {
    if (this.resizingNodeId) this.emitChange();
    this.resizingNodeId = null;
    window.removeEventListener('pointermove', this.handleResize);
    window.removeEventListener('pointerup', this.stopResize);
  };

  private createConnection(sourceNodeId: string, targetNodeId: string): void {
    if (!this.canManage || sourceNodeId === targetNodeId) return;
    const exists = this.localConnections.some(
      (connection) =>
        connection.sourceNodeId === sourceNodeId && connection.targetNodeId === targetNodeId,
    );
    if (exists) return;
    const connection: DiagramConnection = {
      id: crypto.randomUUID(),
      sourceNodeId,
      targetNodeId,
      type: this.connectionType,
    };
    this.localConnections = [...this.localConnections, connection];
    this.selectedConnectionId = connection.id;
    this.emitChange();
  }

  private getConnectionPoint(node: DiagramNode, target: DiagramNode): { x: number; y: number } {
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;
    const targetX = target.x + target.width / 2;
    const targetY = target.y + target.height / 2;
    const dx = targetX - centerX;
    const dy = targetY - centerY;

    if (dx === 0 && dy === 0) {
      return {
        x: centerX,
        y: centerY,
      };
    }

    if (node.type === 'circle') {
      const radiusX = node.width / 2;
      const radiusY = node.height / 2;
      const scale =
        1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY));
      return {
        x: centerX + dx * scale,
        y: centerY + dy * scale,
      };
    }

    if (node.type === 'diamond') {
      const halfWidth = node.width / 2;
      const halfHeight = node.height / 2;
      const scale = 1 / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight);
      return {
        x: centerX + dx * scale,
        y: centerY + dy * scale,
      };
    }

    const halfWidth = node.width / 2;
    const halfHeight = node.height / 2;
    const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
    const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);

    return {
      x: centerX + dx * scale,
      y: centerY + dy * scale,
    };
  }

  private getNextZIndex(): number {
    return Math.max(0, ...this.localNodes.map((node) => node.zIndex ?? 0)) + 1;
  }

  private getNodeDefaults(type: DiagramNodeType): {
    text: string;
    width: number;
    height: number;
    background: string;
  } {
    const defaults = {
      rectangle: {
        text: 'Process',
        width: 150,
        height: 70,
        background: '#17243a',
      },
      rounded: {
        text: 'Step',
        width: 150,
        height: 70,
        background: '#17243a',
      },
      circle: {
        text: 'Node',
        width: 100,
        height: 100,
        background: '#17243a',
      },
      diamond: {
        text: 'Decision',
        width: 110,
        height: 110,
        background: '#17243a',
      },
      text: {
        text: 'Text',
        width: 140,
        height: 50,
        background: 'transparent',
      },
    };
    return defaults[type];
  }

  private emitChange(): void {
    this.graphChange.emit({
      nodes: this.localNodes.map((node) => ({ ...node })),
      connections: this.localConnections.map((connection) => ({ ...connection })),
    });
  }
}
