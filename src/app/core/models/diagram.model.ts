export type DiagramNodeType = 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'text';

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
}

export type DiagramConnectionType =
  | 'arrow'
  | 'line'
  | 'one-to-one'
  | 'one-to-many'
  | 'zero-to-one'
  | 'zero-to-many'
  | 'many-to-many';

export interface DiagramConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: DiagramConnectionType;
}

export interface Diagram {
  id?: string;
  workspaceId: string;
  name: string;
  description?: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}
