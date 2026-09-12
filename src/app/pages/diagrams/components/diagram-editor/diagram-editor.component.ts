import { CommonModule } from '@angular/common';
import { CdkDragEnd, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  DiagramConnection,
  DiagramConnectionLabel,
  DiagramConnectionStyle,
  DiagramConnectionType,
  DiagramConnectorSide,
  DiagramExportFormat,
  DiagramGridSettings,
  DiagramNode,
  DiagramNodeType,
  DiagramPoint,
  DiagramProjectData,
  DiagramTableData,
  DiagramVersionSnapshot,
} from '../../../../core/models/diagram.model';
import {
  DIAGRAM_CONNECTION_STYLES,
  DIAGRAM_CONNECTION_TYPES,
  DIAGRAM_CONNECTOR_SIDES,
} from './constants/diagram-connection.constant';
import { DIAGRAM_GRID_DEFAULTS, DIAGRAM_GRID_SIZES } from './constants/diagram-grid.constant';
import { DIAGRAM_NODE_CONFIG, DIAGRAM_NODE_TYPES } from './constants/diagram-node.constant';
import { DiagramClipboardService } from './services/diagram-clipboard.service';
import { DiagramConnectionService } from './services/diagram-connection.service';
import { DiagramDragService } from './services/diagram-drag.service';
import { DiagramGeometryService } from './services/diagram-geometry.service';
import { DiagramGridService } from './services/diagram-grid.service';
import { DiagramHistoryService, DiagramHistorySnapshot } from './services/diagram-history.service';
import { DiagramNodeService } from './services/diagram-node.service';
import { DiagramSelectionService } from './services/diagram-selection.service';
import { DiagramTableService } from './services/diagram-table.service';
import { DiagramVersionService } from './services/diagram-version.service';
import { DiagramExportService } from './services/diagram.export.service';
type ConnectionEndpoint = 'source' | 'target';
@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './diagram-editor.component.html',
  styleUrl: './diagram-editor.component.scss',
})
export class DiagramEditorComponent implements OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly geometry = inject(DiagramGeometryService);
  readonly history = inject(DiagramHistoryService);
  readonly selection = inject(DiagramSelectionService);
  readonly clipboard = inject(DiagramClipboardService);
  readonly drag = inject(DiagramDragService);
  readonly nodeService = inject(DiagramNodeService);
  readonly connectionService = inject(DiagramConnectionService);
  readonly grid = inject(DiagramGridService);
  readonly tableService = inject(DiagramTableService);
  readonly exportService = inject(DiagramExportService);
  readonly versionService = inject(DiagramVersionService);
  readonly connectorSides = DIAGRAM_CONNECTOR_SIDES;
  readonly connectionTypes = DIAGRAM_CONNECTION_TYPES;
  readonly connectionStyles = DIAGRAM_CONNECTION_STYLES;
  readonly nodeTypes = DIAGRAM_NODE_TYPES;
  readonly gridSizes = DIAGRAM_GRID_SIZES;
  @ViewChild('diagramCanvas') diagramCanvas?: ElementRef<HTMLElement>;
  @ViewChild('canvasScroll') canvasScroll?: ElementRef<HTMLElement>;
  @Input() nodes: DiagramNode[] = [];
  @Input() connections: DiagramConnection[] = [];
  @Input() canManage = false;
  @Input() diagramId = '';
  @Input() workspaceId = '';
  @Input() diagramName = 'Diagram';
  @Input() currentUserId = '';
  @Input() projects: DiagramProjectData[] = [];
  @Output() graphChange = new EventEmitter<{
    nodes: DiagramNode[];
    connections: DiagramConnection[];
  }>();
  @Output() saveRequest = new EventEmitter<void>();
  @Output() gridChange = new EventEmitter<DiagramGridSettings>();
  localNodes: DiagramNode[] = [];
  localConnections: DiagramConnection[] = [];
  editingNodeId: string | null = null;
  connectionSourceId: string | null = null;
  connectionSourceSide: DiagramConnectorSide | null = null;
  connectionType: DiagramConnectionType = 'arrow';
  connectionStyle: DiagramConnectionStyle = 'solid';
  gridSettings: DiagramGridSettings = { ...DIAGRAM_GRID_DEFAULTS };
  versions: DiagramVersionSnapshot[] = [];
  versionsLoading = false;
  previewX = 0;
  previewY = 0;
  zoom = 1;
  readonly baseCanvasWidth = 2400;
  readonly baseCanvasHeight = 1600;
  canvasWidth = this.baseCanvasWidth;
  canvasHeight = this.baseCanvasHeight;
  connectorToolActive = false;
  connectorDraftStart: DiagramPoint | null = null;
  connectorDraftEnd: DiagramPoint | null = null;
  connectorDraftSourceNodeId: string | null = null;
  connectorDraftSourceSide: DiagramConnectorSide | null = null;
  connectorDraftTargetNodeId: string | null = null;
  connectorDraftTargetSide: DiagramConnectorSide | null = null;
  spacePressed = false;
  isPanning = false;
  contextMenu: DiagramPoint | null = null;
  reconnectPreview: DiagramPoint | null = null;
  reconnectingConnectionId: string | null = null;
  reconnectingEndpoint: ConnectionEndpoint | null = null;
  private readonly dragStartSnapshots: Record<string, DiagramHistorySnapshot> = {};
  private suppressNextNodeClick = false;
  private suppressNextCanvasClick = false;
  private lastEmptyCanvasPointerDownAt = 0;
  private lastEmptyCanvasPointerDownX = 0;
  private lastEmptyCanvasPointerDownY = 0;
  private lastEmittedSignature = '';
  private textEditStartSnapshot: DiagramHistorySnapshot | null = null;
  private resizeStartSnapshot: DiagramHistorySnapshot | null = null;
  private reconnectStartSnapshot: DiagramHistorySnapshot | null = null;
  private bendStartSnapshot: DiagramHistorySnapshot | null = null;
  private labelDragStartSnapshot: DiagramHistorySnapshot | null = null;
  private connectionLabelEditStartSnapshot: DiagramHistorySnapshot | null = null;
  private bendingConnectionId: string | null = null;
  private bendingPointIndex: number | null = null;
  private draggingLabelConnectionId: string | null = null;
  private draggingLabelId: string | null = null;
  private labelDragOffsetX = 0;
  private labelDragOffsetY = 0;
  private panStartClientX = 0;
  private panStartClientY = 0;
  private panStartScrollLeft = 0;
  private panStartScrollTop = 0;
  private panMoved = false;
  private draggingConnectorDraftEndpoint: ConnectionEndpoint | null = null;
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diagramId'] && this.diagramId) this.loadVersions();
    if (!changes['nodes'] && !changes['connections']) return;
    const previous = this.snapshot();
    const nextNodes = this.nodes.map((node) => this.normalizeNode(node));
    const nextConnections = this.connectionService.normalizeConnections(this.connections);
    const incoming = {
      nodes: this.history.cloneNodes(nextNodes),
      connections: this.history.cloneConnections(nextConnections),
    };
    const signature = this.history.signature(incoming);
    const ownEmission = !!this.lastEmittedSignature && signature === this.lastEmittedSignature;
    this.localNodes = incoming.nodes;
    this.localConnections = incoming.connections;
    if (ownEmission) {
      this.lastEmittedSignature = '';
      return;
    }
    if (signature !== this.history.signature(previous)) {
      this.history.reset();
      this.clearTransientState();
    }
  }
  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.contextMenu) return this.closeContextMenu();
    if (this.connectionSourceId || this.connectorToolActive) {
      this.cancelConnection();
      this.connectorToolActive = false;
      this.connectorDraftStart = null;
      this.connectorDraftEnd = null;
      return;
    }
    this.cancelReconnect();
    this.editingNodeId = null;
    this.selection.clearAll();
  }
  @HostListener('document:click', ['$event'])
  closeToolbarDropdownsOnOutsideClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target || !this.host.nativeElement.contains(target)) {
      this.closeToolbarDropdowns();
      return;
    }
    const element = event.target as Element | null;
    if (!element?.closest('.toolbar-dropdown')) this.closeToolbarDropdowns();
    if (!element?.closest('.diagram-context-menu')) this.closeContextMenu();
  }
  private closeToolbarDropdowns(): void {
    const dropdowns = this.host.nativeElement.querySelectorAll(
      '.toolbar-dropdown[open]',
    ) as NodeListOf<HTMLDetailsElement>;
    dropdowns.forEach((dropdown) => dropdown.removeAttribute('open'));
  }
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (!this.canManage) return;
    const element = event.target as HTMLElement | null;
    const tag = element?.tagName?.toLowerCase();
    const typing =
      tag === 'input' || tag === 'textarea' || tag === 'select' || element?.isContentEditable;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === 's') {
      event.preventDefault();
      this.emitChange();
      this.saveRequest.emit();
      return;
    }
    if (typing) return;
    if (modifier && key === 'a') {
      event.preventDefault();
      this.selection.selectAll(this.localNodes, this.localConnections);
      return;
    }
    if (modifier && key === 'z') {
      event.preventDefault();
      event.shiftKey ? this.redo() : this.undo();
      return;
    }
    if (modifier && key === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }
    if (modifier && key === 'd') {
      event.preventDefault();
      this.duplicateSelection();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selection.getSelectionCount() || this.selection.selectedConnectionLabelId) {
        event.preventDefault();
        this.deleteSelection();
      }
      return;
    }
    if (!modifier && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.zoomIn();
    } else if (!modifier && event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    } else if (!modifier && event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    }
  }
  @HostListener('document:keydown', ['$event'])
  handleSpaceDown(event: KeyboardEvent): void {
    if (event.code !== 'Space') return;
    const element = event.target as HTMLElement | null;
    const tag = element?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || element?.isContentEditable)
      return;
    event.preventDefault();
    this.spacePressed = true;
  }
  @HostListener('document:keyup', ['$event'])
  handleSpaceUp(event: KeyboardEvent): void {
    if (event.code !== 'Space') return;
    this.spacePressed = false;
  }
  @HostListener('window:blur')
  handleWindowBlur(): void {
    this.spacePressed = false;
  }
  undo(): void {
    if (!this.canManage) return;
    const snapshot = this.history.undo(this.localNodes, this.localConnections);
    if (!snapshot) return;
    this.localNodes = snapshot.nodes;
    this.localConnections = snapshot.connections;
    this.clearTransientState();
    this.emitChange();
  }
  redo(): void {
    if (!this.canManage) return;
    const snapshot = this.history.redo(this.localNodes, this.localConnections);
    if (!snapshot) return;
    this.localNodes = snapshot.nodes;
    this.localConnections = snapshot.connections;
    this.clearTransientState();
    this.emitChange();
  }
  addNode(type: DiagramNodeType): void {
    if (!this.canManage) return;
    const before = this.snapshot();
    const count = this.localNodes.length;
    const node = this.nodeService.createNode(
      type,
      90 + (count % 5) * 35,
      80 + (count % 6) * 30,
      this.localNodes,
      this.gridSettings,
    );
    this.localNodes = [...this.localNodes, node];
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.commit(before);
  }
  selectNode(node: DiagramNode, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.suppressNextNodeClick) {
      this.suppressNextNodeClick = false;
      return;
    }
    this.selection.selectedConnectionLabelId = null;
    if (this.connectorToolActive && !this.connectionSourceId) {
      this.beginConnectorFromNode(node, event);
      return;
    }
    if (this.connectionSourceId && this.connectionSourceId !== node.id) {
      const source = this.localNodes.find((item) => item.id === this.connectionSourceId);
      if (!source) return this.cancelConnection();
      this.createConnection(
        this.connectionSourceId,
        node.id,
        this.connectionSourceSide ||
          this.geometry.getBestSide(source, node, this.drag.dragPositions),
        this.geometry.getBestSide(node, source, this.drag.dragPositions),
      );
      this.cancelConnection();
      if (this.connectorToolActive) this.finishConnectorToolUse();
      this.selection.selectOnlyNode(node.id);
      return;
    }
    if (event?.shiftKey) {
      this.selection.toggleNode(node.id);
      return;
    }
    if (this.selection.isNodeSelected(node.id) && this.selection.getSelectionCount() > 1) {
      this.selection.selectOnlyNode(node.id);
      this.selection.clearConnectionSelection();
      return;
    }
    if (!this.selection.isNodeSelected(node.id)) {
      this.selection.clearConnectionSelection();
      this.selection.selectOnlyNode(node.id);
    }
  }
  selectConnection(connection: DiagramConnection, event: MouseEvent): void {
    event.stopPropagation();
    this.selection.selectedConnectionLabelId = null;
    this.editingNodeId = null;
    this.cancelConnection();
    if (event.shiftKey) return this.selection.toggleConnection(connection.id);
    this.selection.selectOnlyConnection(connection.id);
  }
  canvasClick(event: MouseEvent): void {
    if (this.suppressNextCanvasClick) {
      this.suppressNextCanvasClick = false;
      return;
    }
    if (event.target === event.currentTarget) {
      this.selection.clearAll();
      this.editingNodeId = null;
      this.cancelConnection();
    }
  }
  startCanvasPointer(event: PointerEvent): void {
    if (this.connectionSourceId) return;
    const target = event.target as Element | null;
    if (
      target?.closest(
        '.diagram-node, .connection, .connection-label-group, .connection-controls-layer, .diagram-context-menu, button, input, textarea, select',
      )
    )
      return;
    if (event.button === 1 || (event.button === 0 && this.spacePressed)) {
      this.startCanvasPan(event);
      return;
    }
    if (event.button === 0 && this.isDoubleCanvasPress(event)) {
      this.startCanvasPan(event);
      return;
    }
    if (event.button === 0) this.startMarqueeSelection(event);
  }
  private isDoubleCanvasPress(event: PointerEvent): boolean {
    const now = performance.now();
    const elapsed = now - this.lastEmptyCanvasPointerDownAt;
    const distance = Math.hypot(
      event.clientX - this.lastEmptyCanvasPointerDownX,
      event.clientY - this.lastEmptyCanvasPointerDownY,
    );
    const isDoublePress = elapsed > 0 && elapsed <= 360 && distance <= 12;
    this.lastEmptyCanvasPointerDownAt = isDoublePress ? 0 : now;
    this.lastEmptyCanvasPointerDownX = event.clientX;
    this.lastEmptyCanvasPointerDownY = event.clientY;
    return isDoublePress;
  }
  private startCanvasPan(event: PointerEvent): void {
    const scroll = this.canvasScroll?.nativeElement;
    if (!scroll) return;
    event.preventDefault();
    this.isPanning = true;
    this.panMoved = false;
    this.panStartClientX = event.clientX;
    this.panStartClientY = event.clientY;
    this.panStartScrollLeft = scroll.scrollLeft;
    this.panStartScrollTop = scroll.scrollTop;
    this.editingNodeId = null;
    this.closeContextMenu();
    window.addEventListener('pointermove', this.handleCanvasPanMove);
    window.addEventListener('pointerup', this.handleCanvasPanEnd);
  }
  startMarqueeSelection(event: PointerEvent): void {
    if (event.button !== 0 || this.connectionSourceId) return;
    const target = event.target as Element | null;
    if (
      target?.closest(
        '.diagram-node, .connection, .connection-label-group, .connection-controls-layer, button, input, textarea, select',
      )
    )
      return;
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    this.selection.startMarquee(point, event.shiftKey);
    this.editingNodeId = null;
    window.addEventListener('pointermove', this.handleMarqueeMove);
    window.addEventListener('pointerup', this.handleMarqueeEnd);
  }
  startNodeTextEdit(node: DiagramNode, event: PointerEvent): void {
    event.stopPropagation();
    if (!this.canManage) return;
    if (this.editingNodeId !== node.id) this.textEditStartSnapshot = this.snapshot();
    this.editingNodeId = node.id;
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    requestAnimationFrame(() =>
      this.syncNodeTextLayout(node, event.currentTarget as HTMLTextAreaElement),
    );
  }
  endNodeTextEdit(node: DiagramNode): void {
    if (this.editingNodeId !== node.id) return;
    this.editingNodeId = null;
    if (this.textEditStartSnapshot) this.commit(this.textEditStartSnapshot);
    this.textEditStartSnapshot = null;
  }
  updateNodeText(node: DiagramNode, value: string, textarea: HTMLTextAreaElement): void {
    if (!this.canManage) return;
    node.text = value;
    this.syncNodeTextLayout(node, textarea);
  }
  activateConnectorTool(type: DiagramConnectionType): void {
    if (!this.canManage) return;
    this.connectionType = type;
    this.connectorToolActive = true;
    this.cancelConnection();
    this.resetConnectorDraftAttachments();
    this.showConnectorDraft();
    this.editingNodeId = null;
    this.selection.clearAll();
    this.closeContextMenu();
  }
  private resetConnectorDraftAttachments(): void {
    this.connectorDraftSourceNodeId = null;
    this.connectorDraftSourceSide = null;
    this.connectorDraftTargetNodeId = null;
    this.connectorDraftTargetSide = null;
  }
  private showConnectorDraft(): void {
    const scroll = this.canvasScroll?.nativeElement;
    const canvas = this.diagramCanvas?.nativeElement;
    if (!scroll || !canvas) {
      this.connectorDraftStart = { x: 260, y: 220 };
      this.connectorDraftEnd = { x: 440, y: 220 };
      return;
    }
    const rect = scroll.getBoundingClientRect();
    const center = this.toCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const x = center?.x ?? 350;
    const y = center?.y ?? 250;
    this.connectorDraftStart = this.grid.snapPoint({ x: x - 90, y }, this.gridSettings);
    this.connectorDraftEnd = this.grid.snapPoint({ x: x + 90, y }, this.gridSettings);
  }
  startConnectorDraftEndpointDrag(endpoint: ConnectionEndpoint, event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage || !this.connectorToolActive) return;
    this.draggingConnectorDraftEndpoint = endpoint;
    if (endpoint === 'source') {
      this.connectorDraftSourceNodeId = null;
      this.connectorDraftSourceSide = null;
    } else {
      this.connectorDraftTargetNodeId = null;
      this.connectorDraftTargetSide = null;
    }
    window.addEventListener('pointermove', this.handleConnectorDraftMove);
    window.addEventListener('pointerup', this.handleConnectorDraftEnd);
  }
  private handleConnectorDraftMove = (event: PointerEvent): void => {
    if (!this.draggingConnectorDraftEndpoint) return;
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return;
    const snapped = this.grid.snapPoint(point, this.gridSettings);
    if (this.draggingConnectorDraftEndpoint === 'source') this.connectorDraftStart = snapped;
    else this.connectorDraftEnd = snapped;
  };
  private handleConnectorDraftEnd = (): void => {
    const endpoint = this.draggingConnectorDraftEndpoint;
    const point = endpoint === 'source' ? this.connectorDraftStart : this.connectorDraftEnd;
    if (!endpoint || !point) return this.stopConnectorDraftDrag();
    const nearest = this.geometry.findNearestPort(
      point,
      this.localNodes,
      this.connectorSides,
      this.drag.dragPositions,
      42,
    );
    if (nearest) {
      const port = this.geometry.getPortCenter(nearest.node, nearest.side, this.drag.dragPositions);
      if (endpoint === 'source') {
        this.connectorDraftSourceNodeId = nearest.node.id;
        this.connectorDraftSourceSide = nearest.side;
        this.connectorDraftStart = port;
      } else {
        this.connectorDraftTargetNodeId = nearest.node.id;
        this.connectorDraftTargetSide = nearest.side;
        this.connectorDraftEnd = port;
      }
    }
    this.stopConnectorDraftDrag();
    this.finishToolbarConnectorIfReady();
  };
  private finishToolbarConnectorIfReady(): void {
    if (
      !this.connectorDraftSourceNodeId ||
      !this.connectorDraftTargetNodeId ||
      !this.connectorDraftSourceSide ||
      !this.connectorDraftTargetSide ||
      this.connectorDraftSourceNodeId === this.connectorDraftTargetNodeId
    )
      return;
    this.createConnection(
      this.connectorDraftSourceNodeId,
      this.connectorDraftTargetNodeId,
      this.connectorDraftSourceSide,
      this.connectorDraftTargetSide,
    );
    this.finishConnectorToolUse();
  }
  private finishConnectorToolUse(): void {
    this.stopConnectorDraftDrag();
    this.connectorToolActive = false;
    this.connectorDraftStart = null;
    this.connectorDraftEnd = null;
    this.resetConnectorDraftAttachments();
    this.cancelConnection();
  }
  private stopConnectorDraftDrag(): void {
    this.draggingConnectorDraftEndpoint = null;
    window.removeEventListener('pointermove', this.handleConnectorDraftMove);
    window.removeEventListener('pointerup', this.handleConnectorDraftEnd);
  }
  private beginConnectorFromNode(node: DiagramNode, event?: MouseEvent): void {
    if (!this.canManage) return;
    this.connectorDraftStart = null;
    this.connectorDraftEnd = null;
    const side = this.getNearestNodeSide(node, event);
    const point = this.geometry.getPortCenter(node, side, this.drag.dragPositions);
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.connectionSourceId = node.id;
    this.connectionSourceSide = side;
    this.previewX = point.x;
    this.previewY = point.y;
  }
  private getNearestNodeSide(node: DiagramNode, event?: MouseEvent): DiagramConnectorSide {
    if (!event) return 'right';
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return 'right';
    let closest: DiagramConnectorSide = 'right';
    let distance = Number.POSITIVE_INFINITY;
    for (const side of this.connectorSides) {
      const port = this.geometry.getPortCenter(node, side, this.drag.dragPositions);
      const current = Math.hypot(port.x - point.x, port.y - point.y);
      if (current < distance) {
        distance = current;
        closest = side;
      }
    }
    return closest;
  }
  startConnectionFromHandle(
    node: DiagramNode,
    side: DiagramConnectorSide,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage) return;
    if (this.connectionSourceId) {
      if (this.connectionSourceId === node.id) {
        this.connectionSourceSide = side;
        this.selection.selectOnlyNode(node.id);
        return;
      }
      this.createConnection(
        this.connectionSourceId,
        node.id,
        this.connectionSourceSide || 'right',
        side,
      );
      this.cancelConnection();
      this.selection.selectOnlyNode(node.id);
      return;
    }
    const point = this.geometry.getPortCenter(node, side, this.drag.dragPositions);
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.connectionSourceId = node.id;
    this.connectionSourceSide = side;
    this.previewX = point.x;
    this.previewY = point.y;
  }
  cancelConnection(): void {
    this.connectionSourceId = null;
    this.connectionSourceSide = null;
  }
  canvasMouseMove(event: MouseEvent): void {
    if (!this.connectionSourceId) return;
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return;
    this.previewX = point.x;
    this.previewY = point.y;
  }
  nodeDragMoved(node: DiagramNode, event: CdkDragMove): void {
    if (!this.canManage || this.editingNodeId === node.id) return;
    if (!this.drag.activeDragNodeId) {
      if (!this.selection.isNodeSelected(node.id)) {
        this.selection.selectOnlyNode(node.id);
        this.selection.clearConnectionSelection();
      }
      this.dragStartSnapshots[node.id] = this.snapshot();
      this.drag.startNodeDrag(
        node.id,
        this.localNodes,
        this.selection.selectedNodeIds,
        this.localConnections,
      );
    }
    if (this.drag.activeDragNodeId !== node.id) return;
    const worldDeltaX = event.distance.x / this.zoom;
    const worldDeltaY = event.distance.y / this.zoom;
    this.drag.updateNodeDrag(
      node.id,
      worldDeltaX,
      worldDeltaY,
      this.selection.selectedNodeIds,
      this.localConnections,
    );
    this.localNodes = [...this.localNodes];
    this.localConnections = [...this.localConnections];
  }
  nodeDragEnded(node: DiagramNode, _event: CdkDragEnd): void {
    if (!this.canManage || this.editingNodeId === node.id) return;
    if (this.drag.activeDragNodeId && this.drag.activeDragNodeId !== node.id) return;
    const before = this.dragStartSnapshots[node.id] || this.snapshot();
    const movedNodes = this.drag.finishNodeDrag(this.localNodes, this.selection.selectedNodeIds);
    const leader = movedNodes.find((item) => item.id === node.id);
    let snappedNodes = movedNodes;
    if (leader && this.gridSettings.snap) {
      const snappedLeader = this.grid.snapPoint({ x: leader.x, y: leader.y }, this.gridSettings);
      const offsetX = snappedLeader.x - leader.x;
      const offsetY = snappedLeader.y - leader.y;
      snappedNodes = movedNodes.map((item) =>
        this.selection.selectedNodeIds.has(item.id)
          ? { ...item, x: item.x + offsetX, y: item.y + offsetY }
          : item,
      );
    }
    this.localNodes = snappedNodes.map((item) =>
      item.id === node.id
        ? { ...item, zIndex: this.nodeService.getNextZIndex(snappedNodes) }
        : item,
    );
    delete this.dragStartSnapshots[node.id];
    this.suppressNextNodeClick = true;
    this.commit(before);
  }
  duplicateNode(node: DiagramNode, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.canManage) return;
    const before = this.snapshot();
    const copy = this.clipboard.duplicateNode(node, this.localNodes);
    this.localNodes = [...this.localNodes, copy];
    this.selection.selectOnlyNode(copy.id);
    this.selection.clearConnectionSelection();
    this.commit(before);
  }
  duplicateSelection(): void {
    if (!this.canManage) return;
    const before = this.snapshot();
    const result = this.clipboard.duplicateSelection(
      this.localNodes,
      this.localConnections,
      this.selection.selectedNodeIds,
      this.selection.selectedConnectionIds,
    );
    if (!result.duplicatedNodeIds.length && !result.duplicatedConnectionIds.length) return;
    this.localNodes = result.nodes;
    this.localConnections = result.connections;
    this.selection.replaceNodeSelection(result.duplicatedNodeIds);
    this.selection.replaceConnectionSelection(result.duplicatedConnectionIds);
    this.selection.selectedConnectionLabelId = null;
    this.editingNodeId = null;
    this.commit(before);
  }
  deleteNode(node: DiagramNode, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.canManage) return;
    const before = this.snapshot();
    const removedConnections = new Set(
      this.localConnections
        .filter(
          (connection) =>
            connection.sourceNodeId === node.id || connection.targetNodeId === node.id,
        )
        .map((connection) => connection.id),
    );
    this.localNodes = this.localNodes.filter((item) => item.id !== node.id);
    this.localConnections = this.localConnections.filter(
      (connection) => !removedConnections.has(connection.id),
    );
    this.selection.selectedNodeIds.delete(node.id);
    this.selection.replaceNodeSelection(this.selection.selectedNodeIds);
    for (const id of removedConnections) this.selection.selectedConnectionIds.delete(id);
    this.selection.replaceConnectionSelection(this.selection.selectedConnectionIds);
    if (this.editingNodeId === node.id) this.editingNodeId = null;
    if (this.connectionSourceId === node.id) this.cancelConnection();
    this.commit(before);
  }
  deleteSelection(): void {
    if (!this.canManage) return;
    if (this.selection.selectedConnectionLabelId) return this.deleteSelectedConnectionLabel();
    if (!this.selection.getSelectionCount()) return;
    const before = this.snapshot();
    const nodeIds = new Set(this.selection.selectedNodeIds);
    const connectionIds = new Set(this.selection.selectedConnectionIds);
    this.localNodes = this.localNodes.filter((node) => !nodeIds.has(node.id));
    this.localConnections = this.localConnections.filter(
      (connection) =>
        !connectionIds.has(connection.id) &&
        !nodeIds.has(connection.sourceNodeId) &&
        !nodeIds.has(connection.targetNodeId),
    );
    if (this.connectionSourceId && nodeIds.has(this.connectionSourceId)) this.cancelConnection();
    this.selection.clearAll();
    this.editingNodeId = null;
    this.commit(before);
  }
  updateSelectedConnectionType(type: DiagramConnectionType): void {
    if (!this.canManage || !this.selection.selectedConnectionIds.size) return;
    this.mutateConnections(
      this.connectionService.updateType(
        this.selection.selectedConnectionIds,
        type,
        this.localConnections,
      ),
    );
  }
  updateSelectedConnectionStyle(style: DiagramConnectionStyle): void {
    if (!this.canManage || !this.selection.selectedConnectionIds.size) return;
    this.mutateConnections(
      this.connectionService.updateStyle(
        this.selection.selectedConnectionIds,
        style,
        this.localConnections,
      ),
    );
  }
  updateSelectedConnectionColor(color: string): void {
    if (!this.canManage || !this.selection.selectedConnectionIds.size) return;
    this.mutateConnections(
      this.connectionService.updateColor(
        this.selection.selectedConnectionIds,
        color,
        this.localConnections,
      ),
    );
  }
  addConnectionBendAtPoint(connection: DiagramConnection, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage) return;
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return;
    const before = this.snapshot();
    this.selection.selectOnlyConnection(connection.id);
    this.localConnections = this.connectionService.addBendPoint(
      connection.id,
      point,
      this.localConnections,
      this.localNodes,
      this.drag.dragPositions,
      this.gridSettings,
    );
    this.commit(before);
  }
  addSelectedConnectionBend(): void {
    const connection = this.selectedConnection;
    if (!this.canManage || !connection) return;
    const before = this.snapshot();
    const point = this.grid.snapPoint(this.connectionCenter(connection), this.gridSettings);
    connection.bendPoints = [...(connection.bendPoints || []), point];
    this.localConnections = [...this.localConnections];
    this.commit(before);
  }
  deleteConnectionBend(connection: DiagramConnection, index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.canManage) return;
    const before = this.snapshot();
    connection.bendPoints = (connection.bendPoints || []).filter(
      (_, currentIndex) => currentIndex !== index,
    );
    this.localConnections = [...this.localConnections];
    this.commit(before);
  }
  resetSelectedConnectionBends(): void {
    const connection = this.selectedConnection;
    if (!this.canManage || !connection) return;
    const before = this.snapshot();
    connection.bendPoints = [];
    this.localConnections = [...this.localConnections];
    this.commit(before);
  }
  addSelectedConnectionLabel(): void {
    const connection = this.selectedConnection;
    if (!this.canManage || !connection) return;
    const before = this.snapshot();
    const result = this.connectionService.addLabel(
      connection.id,
      'Label',
      this.connectionCenter(connection),
      this.localConnections,
    );
    this.localConnections = result.connections;
    this.selection.selectedConnectionLabelId = result.labelId;
    this.commit(before);
  }
  selectConnectionLabel(
    connection: DiagramConnection,
    label: DiagramConnectionLabel,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    this.selection.selectOnlyConnection(connection.id);
    this.selection.selectedConnectionLabelId = label.id;
  }
  beginConnectionLabelEdit(): void {
    if (this.canManage) this.connectionLabelEditStartSnapshot = this.snapshot();
  }
  updateSelectedConnectionLabel(value: string): void {
    const label = this.selectedConnectionLabel;
    if (!this.canManage || !label) return;
    label.text = value;
    this.localConnections = [...this.localConnections];
  }
  endConnectionLabelEdit(): void {
    if (!this.connectionLabelEditStartSnapshot) return;
    this.commit(this.connectionLabelEditStartSnapshot);
    this.connectionLabelEditStartSnapshot = null;
  }
  deleteSelectedConnectionLabel(): void {
    const connection = this.selectedConnection;
    const labelId = this.selection.selectedConnectionLabelId;
    if (!this.canManage || !connection || !labelId) return;
    const before = this.snapshot();
    connection.labels = (connection.labels || []).filter((label) => label.id !== labelId);
    this.selection.selectedConnectionLabelId = null;
    this.localConnections = [...this.localConnections];
    this.commit(before);
  }
  updateSelectedNodeBorderColor(color: string): void {
    if (!this.canManage || !this.selection.selectedNodeIds.size) return;
    this.mutateNodes(
      this.nodeService.updateBorderColor(this.selection.selectedNodeIds, color, this.localNodes),
    );
  }
  updateSelectedNodeBackgroundColor(color: string): void {
    if (!this.canManage || !this.selection.selectedNodeIds.size) return;
    this.mutateNodes(
      this.nodeService.updateBackgroundColor(
        this.selection.selectedNodeIds,
        color,
        this.localNodes,
      ),
    );
  }
  updateSelectedNodeTextColor(color: string): void {
    if (!this.canManage || !this.selection.selectedNodeIds.size) return;
    this.mutateNodes(
      this.nodeService.updateTextColor(this.selection.selectedNodeIds, color, this.localNodes),
    );
  }
  startConnectionReconnect(
    connection: DiagramConnection,
    endpoint: ConnectionEndpoint,
    event: PointerEvent,
  ): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage) return;
    this.reconnectStartSnapshot = this.snapshot();
    this.reconnectingConnectionId = connection.id;
    this.reconnectingEndpoint = endpoint;
    this.reconnectPreview =
      endpoint === 'source'
        ? this.geometry.getConnectionSourcePoint(
            connection,
            this.localNodes,
            this.drag.dragPositions,
          )
        : this.geometry.getConnectionTargetPoint(
            connection,
            this.localNodes,
            this.drag.dragPositions,
          );
    window.addEventListener('pointermove', this.handleReconnectMove);
    window.addEventListener('pointerup', this.handleReconnectEnd);
  }
  startConnectionBend(connection: DiagramConnection, index: number, event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage) return;
    this.bendStartSnapshot = this.snapshot();
    this.bendingConnectionId = connection.id;
    this.bendingPointIndex = index;
    window.addEventListener('pointermove', this.handleBendMove);
    window.addEventListener('pointerup', this.handleBendEnd);
  }
  startConnectionLabelDrag(
    connection: DiagramConnection,
    label: DiagramConnectionLabel,
    event: PointerEvent,
  ): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage) return;
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return;
    this.labelDragStartSnapshot = this.snapshot();
    this.selection.selectOnlyConnection(connection.id);
    this.selection.selectedConnectionLabelId = label.id;
    this.draggingLabelConnectionId = connection.id;
    this.draggingLabelId = label.id;
    this.labelDragOffsetX = point.x - label.x;
    this.labelDragOffsetY = point.y - label.y;
    window.addEventListener('pointermove', this.handleLabelMove);
    window.addEventListener('pointerup', this.handleLabelEnd);
  }
  startResize(node: DiagramNode, event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.canManage) return;
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.resizeStartSnapshot = this.snapshot();
    this.drag.startResize(node, event.clientX, event.clientY);
    window.addEventListener('pointermove', this.handleResize);
    window.addEventListener('pointerup', this.stopResize);
  }
  toggleGrid(): void {
    this.gridSettings = {
      ...this.gridSettings,
      enabled: !this.gridSettings.enabled,
    };
    this.gridChange.emit({ ...this.gridSettings });
  }
  toggleSnap(): void {
    this.gridSettings = {
      ...this.gridSettings,
      snap: !this.gridSettings.snap,
    };
    this.gridChange.emit({ ...this.gridSettings });
  }
  setGridSize(size: number): void {
    this.gridSettings = this.grid.normalize({
      ...this.gridSettings,
      size,
    });
    this.gridChange.emit({ ...this.gridSettings });
  }
  addTableNode(rows = 3, columns = 3): void {
    if (!this.canManage) return;
    const before = this.snapshot();
    const count = this.localNodes.length;
    const node = this.nodeService.createTableNode(
      90 + (count % 5) * 35,
      80 + (count % 6) * 30,
      this.localNodes,
      rows,
      columns,
      this.gridSettings,
    );
    this.localNodes = [...this.localNodes, node];
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.commit(before);
  }
  addProjectNode(project: DiagramProjectData): void {
    if (!this.canManage) return;
    const before = this.snapshot();
    const count = this.localNodes.length;
    const node = this.nodeService.createProjectNode(
      project,
      90 + (count % 5) * 35,
      80 + (count % 6) * 30,
      this.localNodes,
      this.gridSettings,
    );
    this.localNodes = [...this.localNodes, node];
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.commit(before);
  }
  addTableRow(node: DiagramNode): void {
    if (!this.canManage || node.type !== 'table' || !node.table) return;
    this.updateTableNode(node, this.tableService.addRow(node.table));
  }
  deleteTableRow(node: DiagramNode, rowIndex: number): void {
    if (!this.canManage || node.type !== 'table' || !node.table) return;
    this.updateTableNode(node, this.tableService.deleteRow(node.table, rowIndex));
  }
  addTableColumn(node: DiagramNode): void {
    if (!this.canManage || node.type !== 'table' || !node.table) return;
    this.updateTableNode(node, this.tableService.addColumn(node.table));
  }
  deleteTableColumn(node: DiagramNode, columnIndex: number): void {
    if (!this.canManage || node.type !== 'table' || !node.table) return;
    this.updateTableNode(node, this.tableService.deleteColumn(node.table, columnIndex));
  }
  updateTableCell(node: DiagramNode, rowIndex: number, columnIndex: number, value: string): void {
    if (!this.canManage || node.type !== 'table' || !node.table) return;
    this.updateTableNode(
      node,
      this.tableService.updateCell(node.table, rowIndex, columnIndex, value),
    );
  }
  toggleTableHeader(node: DiagramNode): void {
    if (!this.canManage || node.type !== 'table' || !node.table) return;
    this.updateTableNode(node, this.tableService.toggleHeader(node.table));
  }
  async exportDiagram(format: DiagramExportFormat): Promise<void> {
    const element = this.diagramCanvas?.nativeElement;
    if (!element) return;
    await this.exportService.export(element, this.diagramName, {
      format,
      background: true,
      scale: 2,
    });
  }
  async createVersion(name?: string): Promise<void> {
    if (!this.canManage || !this.diagramId || !this.workspaceId) return;
    await this.versionService.createVersion(
      this.diagramId,
      this.workspaceId,
      name?.trim() || `Version ${new Date().toLocaleString()}`,
      this.localNodes,
      this.localConnections,
      this.currentUserId || undefined,
    );
    this.loadVersions();
  }
  restoreVersion(version: DiagramVersionSnapshot): void {
    if (!this.canManage) return;
    const before = this.snapshot();
    const restored = this.versionService.restoreVersion(version);
    this.localNodes = this.nodeService.normalizeNodes(restored.nodes);
    this.localConnections = this.connectionService.normalizeConnections(restored.connections);
    this.clearTransientState();
    this.commit(before);
  }
  async deleteVersion(version: DiagramVersionSnapshot): Promise<void> {
    if (!this.canManage || !this.diagramId || !version.id) return;
    await this.versionService.deleteVersion(this.diagramId, version.id);
    this.loadVersions();
  }
  zoomIn(): void {
    this.setZoom(Math.min(2, Number((this.zoom + 0.1).toFixed(2))));
  }
  zoomOut(): void {
    this.setZoom(Math.max(0.25, Number((this.zoom - 0.1).toFixed(2))));
  }
  resetZoom(): void {
    this.setZoom(1);
  }
  handleCanvasWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.1 : -0.1;
    const nextZoom = Math.min(2, Math.max(0.25, Number((this.zoom + step).toFixed(2))));
    this.setZoom(nextZoom, event.clientX, event.clientY);
  }
  private setZoom(nextZoom: number, anchorClientX?: number, anchorClientY?: number): void {
    if (this.zoom === nextZoom) return;
    const scroll = this.canvasScroll?.nativeElement;
    if (!scroll) {
      this.zoom = nextZoom;
      return;
    }
    const rect = scroll.getBoundingClientRect();
    const anchorX = anchorClientX == null ? rect.width / 2 : anchorClientX - rect.left;
    const anchorY = anchorClientY == null ? rect.height / 2 : anchorClientY - rect.top;
    const worldX = (scroll.scrollLeft + anchorX) / this.zoom;
    const worldY = (scroll.scrollTop + anchorY) / this.zoom;
    this.zoom = nextZoom;
    requestAnimationFrame(() => {
      scroll.scrollLeft = worldX * nextZoom - anchorX;
      scroll.scrollTop = worldY * nextZoom - anchorY;
    });
  }
  private getDiagramContentBounds(): { width: number; height: number } {
    const padding = 240;
    const nodeRight = this.localNodes.reduce((max, node) => Math.max(max, node.x + node.width), 0);
    const nodeBottom = this.localNodes.reduce(
      (max, node) => Math.max(max, node.y + node.height),
      0,
    );
    const connectionPoints = this.localConnections.flatMap((connection) => [
      ...(connection.bendPoints || []),
      ...(connection.labels || []).map((label) => ({ x: label.x, y: label.y })),
    ]);
    const connectionRight = connectionPoints.reduce((max, point) => Math.max(max, point.x), 0);
    const connectionBottom = connectionPoints.reduce((max, point) => Math.max(max, point.y), 0);
    return {
      width: Math.max(800, nodeRight + padding, connectionRight + padding),
      height: Math.max(600, nodeBottom + padding, connectionBottom + padding),
    };
  }
  openNodeContextMenu(node: DiagramNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.selection.isNodeSelected(node.id)) {
      this.selection.clearConnectionSelection();
      this.selection.selectOnlyNode(node.id);
    }
    this.openContextMenu(event);
  }
  openConnectionContextMenu(connection: DiagramConnection, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.selection.selectOnlyConnection(connection.id);
    this.selection.selectedConnectionLabelId = null;
    this.editingNodeId = null;
    this.cancelConnection();
    this.openContextMenu(event);
  }
  openCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if ((event.target as Element | null)?.closest('.diagram-context-menu')) return;
    if (event.target === event.currentTarget) {
      this.selection.clearAll();
      this.editingNodeId = null;
      this.cancelConnection();
    }
    this.openContextMenu(event);
  }
  closeContextMenu(): void {
    this.contextMenu = null;
  }
  addNodeAtContext(type: DiagramNodeType): void {
    if (!this.canManage || !this.contextMenu) return;
    const before = this.snapshot();
    const node = this.nodeService.createNode(
      type,
      this.contextMenu.x,
      this.contextMenu.y,
      this.localNodes,
      this.gridSettings,
    );
    this.localNodes = [...this.localNodes, node];
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.commit(before);
  }
  addTableAtContext(): void {
    if (!this.canManage || !this.contextMenu) return;
    const before = this.snapshot();
    const node = this.nodeService.createTableNode(
      this.contextMenu.x,
      this.contextMenu.y,
      this.localNodes,
      3,
      3,
      this.gridSettings,
    );
    this.localNodes = [...this.localNodes, node];
    this.selection.selectOnlyNode(node.id);
    this.selection.clearConnectionSelection();
    this.commit(before);
  }
  private openContextMenu(event: MouseEvent): void {
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return;
    this.closeToolbarDropdowns();
    this.contextMenu = point;
  }
  get selectedNode(): DiagramNode | undefined {
    return this.localNodes.find((node) => node.id === this.selection.selectedNodeId);
  }
  get selectedConnection(): DiagramConnection | undefined {
    return this.localConnections.find(
      (connection) => connection.id === this.selection.selectedConnectionId,
    );
  }
  get selectedConnectionLabel(): DiagramConnectionLabel | undefined {
    return this.selectedConnection?.labels?.find(
      (label) => label.id === this.selection.selectedConnectionLabelId,
    );
  }
  get connectionPreviewSource(): DiagramNode | undefined {
    return this.localNodes.find((node) => node.id === this.connectionSourceId);
  }
  get marqueeRect() {
    return this.selection.marqueeRect;
  }
  getColorInputValue(value: string | undefined, fallback: string): string {
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }
  getPortColor(nodeId: string, side: DiagramConnectorSide): string {
    const node = this.localNodes.find((item) => item.id === nodeId);
    if (this.selection.isNodeSelected(nodeId)) return node?.borderColor || 'var(--primary)';
    const connection = this.localConnections.find(
      (item) =>
        (item.sourceNodeId === nodeId && item.sourceSide === side) ||
        (item.targetNodeId === nodeId && item.targetSide === side),
    );
    return connection?.color || node?.borderColor || 'var(--primary)';
  }
  connectionPath(connection: DiagramConnection): string {
    const points = this.connectionService.getConnectionPoints(
      connection,
      this.localNodes,
      this.drag.dragPositions,
    );
    if (
      this.reconnectingConnectionId === connection.id &&
      this.reconnectPreview &&
      this.reconnectingEndpoint
    ) {
      if (this.reconnectingEndpoint === 'source') points[0] = this.reconnectPreview;
      else points[points.length - 1] = this.reconnectPreview;
    }
    return this.buildRoundedConnectionPath(points);
  }
  private buildRoundedConnectionPath(points: DiagramPoint[]): string {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2)
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    const commands = [`M ${points[0].x} ${points[0].y}`];
    const maximumRadius = 24;
    for (let index = 1; index < points.length - 1; index++) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
      const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
      if (incomingLength < 1 || outgoingLength < 1) {
        commands.push(`L ${current.x} ${current.y}`);
        continue;
      }
      const radius = Math.min(maximumRadius, incomingLength / 3, outgoingLength / 3);
      const incomingPoint = {
        x: current.x - ((current.x - previous.x) / incomingLength) * radius,
        y: current.y - ((current.y - previous.y) / incomingLength) * radius,
      };
      const outgoingPoint = {
        x: current.x + ((next.x - current.x) / outgoingLength) * radius,
        y: current.y + ((next.y - current.y) / outgoingLength) * radius,
      };
      commands.push(`L ${incomingPoint.x} ${incomingPoint.y}`);
      commands.push(`Q ${current.x} ${current.y} ${outgoingPoint.x} ${outgoingPoint.y}`);
    }
    const last = points[points.length - 1];
    commands.push(`L ${last.x} ${last.y}`);
    return commands.join(' ');
  }
  private handleCanvasPanMove = (event: PointerEvent): void => {
    const scroll = this.canvasScroll?.nativeElement;
    if (!scroll || !this.isPanning) return;
    const deltaX = event.clientX - this.panStartClientX;
    const deltaY = event.clientY - this.panStartClientY;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) this.panMoved = true;
    scroll.scrollLeft = this.panStartScrollLeft - deltaX;
    scroll.scrollTop = this.panStartScrollTop - deltaY;
  };
  private handleCanvasPanEnd = (): void => {
    if (this.panMoved) this.suppressNextCanvasClick = true;
    this.isPanning = false;
    this.panMoved = false;
    window.removeEventListener('pointermove', this.handleCanvasPanMove);
    window.removeEventListener('pointerup', this.handleCanvasPanEnd);
  };
  private handleMarqueeMove = (event: PointerEvent): void => {
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point || !this.selection.isMarqueeActive()) return;
    this.selection.updateMarquee(
      point,
      this.localNodes,
      this.localConnections,
      this.drag.dragPositions,
    );
  };
  private handleMarqueeEnd = (): void => {
    if (!this.selection.isMarqueeActive()) return;
    this.selection.finishMarquee();
    this.suppressNextCanvasClick = true;
    window.removeEventListener('pointermove', this.handleMarqueeMove);
    window.removeEventListener('pointerup', this.handleMarqueeEnd);
  };
  private handleResize = (event: PointerEvent): void => {
    const state = this.drag.resizeState;
    if (!state) return;
    const node = this.localNodes.find((item) => item.id === state.nodeId);
    if (!node) return;
    const minimum = this.nodeService.getMinimumSize(node.type);
    const size = this.drag.updateResize(
      node,
      event.clientX,
      event.clientY,
      this.zoom,
      node.type === 'text' ? 80 : minimum.width,
      node.type === 'text' ? 45 : minimum.height,
      this.nodeService.isProportionalShape(node.type),
    );
    if (!size) return;
    const snappedSize = this.grid.snapSize(size.width, size.height, this.gridSettings);
    const proportional = this.nodeService.isProportionalShape(node.type);
    if (proportional) {
      const value = Math.max(snappedSize.width, snappedSize.height);
      node.width = value;
      node.height = value;
    } else {
      node.width = snappedSize.width;
      node.height = snappedSize.height;
    }
    this.localNodes = [...this.localNodes];
  };
  private stopResize = (): void => {
    if (this.drag.resizeState && this.resizeStartSnapshot) this.commit(this.resizeStartSnapshot);
    this.resizeStartSnapshot = null;
    this.drag.finishResize();
    window.removeEventListener('pointermove', this.handleResize);
    window.removeEventListener('pointerup', this.stopResize);
  };
  private handleReconnectMove = (event: PointerEvent): void => {
    const point = this.toCanvas(event.clientX, event.clientY);
    if (point) this.reconnectPreview = point;
  };
  private handleReconnectEnd = (): void => {
    const connection = this.localConnections.find(
      (item) => item.id === this.reconnectingConnectionId,
    );
    if (!connection || !this.reconnectingEndpoint || !this.reconnectPreview)
      return this.cancelReconnect();
    const nearest = this.geometry.findNearestPort(
      this.reconnectPreview,
      this.localNodes,
      this.connectorSides,
      this.drag.dragPositions,
    );
    if (nearest) {
      const otherNodeId =
        this.reconnectingEndpoint === 'source' ? connection.targetNodeId : connection.sourceNodeId;
      if (nearest.node.id !== otherNodeId) {
        if (this.reconnectingEndpoint === 'source') {
          connection.sourceNodeId = nearest.node.id;
          connection.sourceSide = nearest.side;
        } else {
          connection.targetNodeId = nearest.node.id;
          connection.targetSide = nearest.side;
        }
        this.localConnections = [...this.localConnections];
        if (this.reconnectStartSnapshot) this.commit(this.reconnectStartSnapshot);
      }
    }
    this.reconnectStartSnapshot = null;
    this.cancelReconnect();
  };
  private cancelReconnect(): void {
    this.reconnectingConnectionId = null;
    this.reconnectingEndpoint = null;
    this.reconnectPreview = null;
    this.reconnectStartSnapshot = null;
    window.removeEventListener('pointermove', this.handleReconnectMove);
    window.removeEventListener('pointerup', this.handleReconnectEnd);
  }
  private handleBendMove = (event: PointerEvent): void => {
    if (this.bendingConnectionId === null || this.bendingPointIndex === null) return;
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point) return;
    const connection = this.localConnections.find((item) => item.id === this.bendingConnectionId);
    if (!connection?.bendPoints?.[this.bendingPointIndex]) return;
    connection.bendPoints[this.bendingPointIndex] = this.grid.snapPoint(point, this.gridSettings);
    this.localConnections = [...this.localConnections];
  };
  private handleBendEnd = (): void => {
    if (this.bendingConnectionId && this.bendStartSnapshot) this.commit(this.bendStartSnapshot);
    this.bendStartSnapshot = null;
    this.bendingConnectionId = null;
    this.bendingPointIndex = null;
    window.removeEventListener('pointermove', this.handleBendMove);
    window.removeEventListener('pointerup', this.handleBendEnd);
  };
  private handleLabelMove = (event: PointerEvent): void => {
    const point = this.toCanvas(event.clientX, event.clientY);
    if (!point || !this.draggingLabelConnectionId || !this.draggingLabelId) return;
    const label = this.localConnections
      .find((item) => item.id === this.draggingLabelConnectionId)
      ?.labels?.find((item) => item.id === this.draggingLabelId);
    if (!label) return;
    label.x = point.x - this.labelDragOffsetX;
    label.y = point.y - this.labelDragOffsetY;
    this.localConnections = [...this.localConnections];
  };
  private handleLabelEnd = (): void => {
    if (this.draggingLabelConnectionId && this.labelDragStartSnapshot)
      this.commit(this.labelDragStartSnapshot);
    this.labelDragStartSnapshot = null;
    this.draggingLabelConnectionId = null;
    this.draggingLabelId = null;
    window.removeEventListener('pointermove', this.handleLabelMove);
    window.removeEventListener('pointerup', this.handleLabelEnd);
  };
  private createConnection(
    sourceNodeId: string,
    targetNodeId: string,
    sourceSide: DiagramConnectorSide,
    targetSide: DiagramConnectorSide,
  ): void {
    if (!this.canManage || sourceNodeId === targetNodeId) return;
    const exists = this.localConnections.some(
      (connection) =>
        connection.sourceNodeId === sourceNodeId &&
        connection.targetNodeId === targetNodeId &&
        connection.sourceSide === sourceSide &&
        connection.targetSide === targetSide,
    );
    if (exists) return;
    const before = this.snapshot();
    const connection = this.connectionService.createConnection(
      sourceNodeId,
      targetNodeId,
      sourceSide,
      targetSide,
      this.connectionType,
      this.connectionStyle,
    );
    this.localConnections = [...this.localConnections, connection];
    this.selection.selectOnlyConnection(connection.id);
    this.commit(before);
  }
  private updateTableNode(node: DiagramNode, table: DiagramTableData): void {
    const before = this.snapshot();
    this.localNodes = this.nodeService.updateTable(node.id, table, this.localNodes);
    this.commit(before);
  }
  private async loadVersions(): Promise<void> {
    if (!this.diagramId) {
      this.versions = [];
      return;
    }
    this.versionsLoading = true;
    try {
      this.versions = await firstValueFrom(this.versionService.getVersions(this.diagramId));
    } catch {
      this.versions = [];
    } finally {
      this.versionsLoading = false;
    }
  }
  private normalizeNode(node: DiagramNode): DiagramNode {
    const normalized = this.nodeService.normalizeNode(node);
    const defaults = DIAGRAM_NODE_CONFIG[normalized.type];
    return {
      ...normalized,
      background: normalized.background === '#17243a' ? defaults.background : normalized.background,
      color: normalized.color === '#eaf1ff' ? defaults.color : normalized.color || defaults.color,
      borderColor:
        normalized.borderColor === '#536fff' || normalized.borderColor === 'var(--primary)'
          ? defaults.borderColor
          : normalized.borderColor || defaults.borderColor,
    };
  }
  private syncNodeTextLayout(node: DiagramNode, textarea: HTMLTextAreaElement): void {
    const config = DIAGRAM_NODE_CONFIG[node.type];
    const styles = getComputedStyle(textarea);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return;
    context.font = styles.font;
    const lines = (node.text || '').split('\n');
    const words = (node.text || '').split(/\s+/).filter(Boolean);
    const naturalWidth = Math.max(
      0,
      ...lines.map((line) => context.measureText(line || ' ').width),
      ...words.map((word) => context.measureText(word).width),
    );
    const ratio = Math.max(0.1, config.textWidthRatio || 1);
    const minContent = config.width * ratio;
    const maxContent =
      node.type === 'circle'
        ? 220
        : node.type === 'diamond'
          ? 210
          : node.type === 'text'
            ? 320
            : 300;
    const contentWidth = Math.min(maxContent, Math.max(minContent, naturalWidth + 18));
    let width = Math.max(
      node.width,
      node.type === 'text'
        ? contentWidth + 8
        : node.type === 'circle' || node.type === 'diamond'
          ? contentWidth / ratio
          : contentWidth + 12,
    );
    const measuredHeight = this.measureTextHeight(
      node,
      textarea,
      node.type === 'circle' || node.type === 'diamond'
        ? width * ratio
        : node.type === 'text'
          ? width - 8
          : width - 12,
    );
    const heightRatio = Math.max(0.1, config.textHeightRatio || 1);
    let height = Math.max(
      node.height,
      node.type === 'text'
        ? measuredHeight + 8
        : node.type === 'circle' || node.type === 'diamond'
          ? (measuredHeight + 8) / heightRatio
          : measuredHeight + 12,
    );
    if (config.proportionalResize) width = height = Math.max(width, height);
    const snappedSize = this.grid.snapSize(width, height, this.gridSettings);
    width = snappedSize.width;
    height = snappedSize.height;
    if (config.proportionalResize) width = height = Math.max(width, height);
    if (width !== node.width || height !== node.height) {
      node.width = width;
      node.height = height;
      this.localNodes = [...this.localNodes];
    }
  }
  private measureTextHeight(
    node: DiagramNode,
    textarea: HTMLTextAreaElement,
    width: number,
  ): number {
    const styles = getComputedStyle(textarea);
    const probe = document.createElement('div');
    Object.assign(probe.style, {
      position: 'absolute',
      left: '-99999px',
      top: '-99999px',
      visibility: 'hidden',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      width: `${Math.max(1, width)}px`,
      padding: '5px',
      border: '0',
      font: styles.font,
      fontSize: styles.fontSize,
      fontFamily: styles.fontFamily,
      fontWeight: styles.fontWeight,
      fontStyle: styles.fontStyle,
      lineHeight: styles.lineHeight,
      letterSpacing: styles.letterSpacing,
      textAlign: styles.textAlign,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    });
    probe.textContent = `${node.text || ''}\u200b`;
    document.body.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  }
  private connectionCenter(connection: DiagramConnection): DiagramPoint {
    const bends = connection.bendPoints || [];
    if (bends.length) return { ...bends[Math.floor(bends.length / 2)] };
    const source = this.geometry.getConnectionSourcePoint(
      connection,
      this.localNodes,
      this.drag.dragPositions,
    );
    const target = this.geometry.getConnectionTargetPoint(
      connection,
      this.localNodes,
      this.drag.dragPositions,
    );
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  }
  private toCanvas(clientX: number, clientY: number): DiagramPoint | null {
    const world = this.diagramCanvas?.nativeElement;
    if (!world) return null;
    const rect = world.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.zoom,
      y: (clientY - rect.top) / this.zoom,
    };
  }
  private snapshot(): DiagramHistorySnapshot {
    return this.history.capture(this.localNodes, this.localConnections);
  }
  private commit(before: DiagramHistorySnapshot): void {
    if (this.history.commit(before, this.localNodes, this.localConnections)) this.emitChange();
  }
  private mutateNodes(nodes: DiagramNode[]): void {
    const before = this.snapshot();
    if (
      this.history.signature({ nodes, connections: this.localConnections }) ===
      this.history.signature(before)
    )
      return;
    this.localNodes = nodes;
    this.commit(before);
  }
  private mutateConnections(connections: DiagramConnection[]): void {
    const before = this.snapshot();
    if (
      this.history.signature({ nodes: this.localNodes, connections }) ===
      this.history.signature(before)
    )
      return;
    this.localConnections = connections;
    this.commit(before);
  }
  private clearTransientState(): void {
    this.stopConnectorDraftDrag();
    this.selection.clearAll();
    this.connectorToolActive = false;
    this.connectorDraftStart = null;
    this.connectorDraftEnd = null;
    this.spacePressed = false;
    this.isPanning = false;
    window.removeEventListener('pointermove', this.handleCanvasPanMove);
    window.removeEventListener('pointerup', this.handleCanvasPanEnd);
    this.drag.reset();
    this.editingNodeId = null;
    this.cancelConnection();
    this.cancelReconnect();
    this.bendingConnectionId = null;
    this.bendingPointIndex = null;
    this.draggingLabelConnectionId = null;
    this.draggingLabelId = null;
    this.suppressNextNodeClick = false;
    this.suppressNextCanvasClick = false;
    window.removeEventListener('pointermove', this.handleResize);
    window.removeEventListener('pointerup', this.stopResize);
    window.removeEventListener('pointermove', this.handleBendMove);
    window.removeEventListener('pointerup', this.handleBendEnd);
    window.removeEventListener('pointermove', this.handleLabelMove);
    window.removeEventListener('pointerup', this.handleLabelEnd);
    window.removeEventListener('pointermove', this.handleMarqueeMove);
    window.removeEventListener('pointerup', this.handleMarqueeEnd);
  }
  private emitChange(): void {
    const snapshot = this.snapshot();
    this.lastEmittedSignature = this.history.signature(snapshot);
    this.graphChange.emit({
      nodes: this.history.cloneNodes(snapshot.nodes),
      connections: this.history.cloneConnections(snapshot.connections),
    });
  }
}
