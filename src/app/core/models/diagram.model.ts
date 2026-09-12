export type DiagramType =
  | 'blank'
  | 'flowchart'
  | 'mind-map'
  | 'database'
  | 'architecture'
  | 'process'
  | 'custom'
  | 'erd'
  | 'workflow'
  | 'user-flow';
export type DiagramNodeType =
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'diamond'
  | 'text'
  | 'ellipse'
  | 'triangle'
  | 'hexagon'
  | 'parallelogram'
  | 'cylinder'
  | 'document'
  | 'cloud'
  | 'terminator'
  | 'process'
  | 'subprocess'
  | 'note'
  | 'table'
  | 'project';
export type DiagramConnectorSide =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';
export type DiagramConnectionType =
  | 'arrow'
  | 'line'
  | 'bidirectional'
  | 'one-to-one'
  | 'one-to-many'
  | 'zero-to-one'
  | 'zero-to-many'
  | 'many-to-many';
export type DiagramConnectionStyle = 'solid' | 'dashed' | 'dotted';
export interface DiagramPoint {
  x: number;
  y: number;
}
export interface DiagramConnectionLabel {
  id: string;
  text: string;
  x: number;
  y: number;
}
export interface DiagramTableCell {
  id: string;
  value: string;
}
export interface DiagramTableRow {
  id: string;
  cells: DiagramTableCell[];
}
export interface DiagramTableData {
  columns: number;
  rows: DiagramTableRow[];
  headerRow: boolean;
}
export interface DiagramProjectData {
  projectId: string;
  name: string;
  status?: string;
  progress?: number;
}
export interface DiagramNode {
  id: string;
  type: DiagramNodeType;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  background: string;
  color: string;
  borderColor: string;
  zIndex: number;
  table?: DiagramTableData;
  project?: DiagramProjectData;
}
export interface DiagramConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceSide?: DiagramConnectorSide;
  targetSide?: DiagramConnectorSide;
  type: DiagramConnectionType;
  style?: DiagramConnectionStyle;
  color?: string;
  label?: string;
  labels?: DiagramConnectionLabel[];
  bendPoints?: DiagramPoint[];
}
export interface DiagramGridSettings {
  enabled: boolean;
  snap: boolean;
  size: number;
}
export interface Diagram {
  id?: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: DiagramType;
  projectId?: string | null;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  grid?: DiagramGridSettings;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
export type DiagramExportFormat = 'png' | 'svg' | 'pdf';
export interface DiagramExportOptions {
  format: DiagramExportFormat;
  background: boolean;
  scale: number;
}
export interface DiagramVersionSnapshot {
  id?: string;
  diagramId: string;
  workspaceId: string;
  name: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  createdAt?: unknown;
  createdBy?: string;
}
