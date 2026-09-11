import { NoteDesignId, NotePinId } from '../models/borad-note.model';

export interface NoteDesignOption {
  id: NoteDesignId;
  name: string;
  icon: string;
}

export interface NotePinOption {
  id: NotePinId;
  name: string;
  icon: string;
}

export const NOTE_DESIGNS: NoteDesignOption[] = [
  {
    id: 'classic-yellow',
    name: 'Classic Sticky',
    icon: 'fa-regular fa-note-sticky',
  },
  {
    id: 'blue-sticky',
    name: 'Blue Sticky',
    icon: 'fa-regular fa-note-sticky',
  },
  {
    id: 'pink-sticky',
    name: 'Pink Sticky',
    icon: 'fa-regular fa-note-sticky',
  },
  {
    id: 'green-sticky',
    name: 'Green Sticky',
    icon: 'fa-regular fa-note-sticky',
  },
  {
    id: 'clean-paper',
    name: 'Clean Paper',
    icon: 'fa-regular fa-file',
  },
  {
    id: 'lined-paper',
    name: 'Notebook',
    icon: 'fa-regular fa-file-lines',
  },
  {
    id: 'grid-paper',
    name: 'Graph Paper',
    icon: 'fa-solid fa-border-all',
  },
  {
    id: 'kraft-paper',
    name: 'Kraft Paper',
    icon: 'fa-regular fa-file',
  },
  {
    id: 'torn-paper',
    name: 'Torn Paper',
    icon: 'fa-solid fa-scroll',
  },
  {
    id: 'memo-pad',
    name: 'Memo Pad',
    icon: 'fa-regular fa-clipboard',
  },
  {
    id: 'dark-note',
    name: 'Dark Paper',
    icon: 'fa-solid fa-moon',
  },
  {
    id: 'tech-note',
    name: 'Tech Note',
    icon: 'fa-solid fa-microchip',
  },
  {
    id: 'folded-corner',
    name: 'Folded Corner',
    icon: 'fa-regular fa-file',
  },
  {
    id: 'index-card',
    name: 'Index Card',
    icon: 'fa-regular fa-address-card',
  },
  {
    id: 'receipt-paper',
    name: 'Receipt',
    icon: 'fa-solid fa-receipt',
  },
  {
    id: 'letter-paper',
    name: 'Letter Paper',
    icon: 'fa-regular fa-envelope-open',
  },
  {
    id: 'checklist-paper',
    name: 'Checklist',
    icon: 'fa-solid fa-list-check',
  },
  {
    id: 'blueprint-paper',
    name: 'Blueprint',
    icon: 'fa-solid fa-ruler-combined',
  },
  {
    id: 'parchment-paper',
    name: 'Parchment',
    icon: 'fa-solid fa-scroll',
  },
  {
    id: 'polaroid-note',
    name: 'Photo Note',
    icon: 'fa-regular fa-image',
  },
];

export const NOTE_PINS: NotePinOption[] = [
  {
    id: 'red-pin',
    name: 'Red Pin',
    icon: 'fa-solid fa-thumbtack',
  },
  {
    id: 'blue-pin',
    name: 'Blue Pin',
    icon: 'fa-solid fa-thumbtack',
  },
  {
    id: 'tape',
    name: 'Tape',
    icon: 'fa-solid fa-tape',
  },
  {
    id: 'paperclip',
    name: 'Paperclip',
    icon: 'fa-solid fa-paperclip',
  },
];
