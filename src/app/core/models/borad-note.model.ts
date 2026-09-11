export type BoardNoteType = 'note' | 'idea';

export type NoteDesignId =
  | 'classic-yellow'
  | 'blue-sticky'
  | 'pink-sticky'
  | 'green-sticky'
  | 'clean-paper'
  | 'lined-paper'
  | 'grid-paper'
  | 'kraft-paper'
  | 'torn-paper'
  | 'memo-pad'
  | 'dark-note'
  | 'tech-note'
  | 'folded-corner'
  | 'index-card'
  | 'receipt-paper'
  | 'letter-paper'
  | 'checklist-paper'
  | 'blueprint-paper'
  | 'parchment-paper'
  | 'polaroid-note';

export type NotePinId = 'red-pin' | 'blue-pin' | 'tape' | 'paperclip';

export interface BoardNote {
  id?: string;
  workspaceId: string;
  type: BoardNoteType;
  title: string;
  content?: string;
  design: NoteDesignId;
  pin: NotePinId;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  ideaId?: string;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}
