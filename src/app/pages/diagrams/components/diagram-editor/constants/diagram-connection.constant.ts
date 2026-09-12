import {
  DiagramConnectionStyle,
  DiagramConnectionType,
  DiagramConnectorSide,
} from '../../../../../core/models/diagram.model';
export interface DiagramConnectionConfig {
  label: string;
  color: string;
  startMarker: string | null;
  endMarker: string | null;
}
export interface DiagramConnectionStyleConfig {
  label: string;
  dashArray: string | null;
}
export const DIAGRAM_CONNECTOR_SIDES: DiagramConnectorSide[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
];
export const DIAGRAM_CONNECTION_CONFIG: Record<DiagramConnectionType, DiagramConnectionConfig> = {
  arrow: { label: 'Arrow', color: '#536fff', startMarker: null, endMarker: 'url(#diagram-arrow)' },
  line: { label: 'Line', color: '#8b95a7', startMarker: null, endMarker: null },
  bidirectional: {
    label: 'Bidirectional',
    color: '#6f7cff',
    startMarker: 'url(#diagram-arrow)',
    endMarker: 'url(#diagram-arrow)',
  },
  'one-to-one': {
    label: 'One to One',
    color: '#36b37e',
    startMarker: 'url(#diagram-one)',
    endMarker: 'url(#diagram-one)',
  },
  'one-to-many': {
    label: 'One to Many',
    color: '#00a8cc',
    startMarker: 'url(#diagram-one)',
    endMarker: 'url(#diagram-many)',
  },
  'zero-to-one': {
    label: 'Zero to One',
    color: '#e5a524',
    startMarker: 'url(#diagram-zero)',
    endMarker: 'url(#diagram-one)',
  },
  'zero-to-many': {
    label: 'Zero to Many',
    color: '#f0783c',
    startMarker: 'url(#diagram-zero)',
    endMarker: 'url(#diagram-many)',
  },
  'many-to-many': {
    label: 'Many to Many',
    color: '#b959ff',
    startMarker: 'url(#diagram-many)',
    endMarker: 'url(#diagram-many)',
  },
};
export const DIAGRAM_CONNECTION_STYLE_CONFIG: Record<
  DiagramConnectionStyle,
  DiagramConnectionStyleConfig
> = {
  solid: { label: 'Solid', dashArray: null },
  dashed: { label: 'Dashed', dashArray: '10 7' },
  dotted: { label: 'Dotted', dashArray: '2 7' },
};
export const DIAGRAM_CONNECTION_TYPES = (
  Object.entries(DIAGRAM_CONNECTION_CONFIG) as [DiagramConnectionType, DiagramConnectionConfig][]
).map(([value, config]) => ({ value, label: config.label }));
export const DIAGRAM_CONNECTION_STYLES = (
  Object.entries(DIAGRAM_CONNECTION_STYLE_CONFIG) as [
    DiagramConnectionStyle,
    DiagramConnectionStyleConfig,
  ][]
).map(([value, config]) => ({ value, label: config.label }));
