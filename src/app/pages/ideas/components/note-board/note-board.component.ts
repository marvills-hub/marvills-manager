import { CommonModule } from '@angular/common';
import { CdkDragEnd, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { BoardNote } from '../../../../core/models/borad-note.model';

@Component({
  selector: 'app-note-board',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './note-board.component.html',
  styleUrl: './note-board.component.scss',
})
export class NoteBoardComponent implements OnChanges {
  @ViewChild('boardScroll') private boardScroll?: ElementRef<HTMLDivElement>;

  @Input() notes: BoardNote[] = [];
  @Input() totalNotes = 0;
  @Input() canManage = false;

  @Output() createNote = new EventEmitter<void>();
  @Output() createNoteAt = new EventEmitter<{ x: number; y: number }>();
  @Output() editNote = new EventEmitter<BoardNote>();
  @Output() deleteNote = new EventEmitter<BoardNote>();
  @Output() convertNote = new EventEmitter<BoardNote>();
  @Output() viewNote = new EventEmitter<BoardNote>();
  @Output() bringToFront = new EventEmitter<BoardNote>();
  @Output() positionChange = new EventEmitter<{ note: BoardNote; x: number; y: number }>();

  private readonly minimumBoardHeight = 1000;
  private readonly boardBottomSpace = 280;
  private readonly boardExtendThreshold = 180;
  private readonly boardExtendAmount = 400;
  private readonly scrollEdgeSize = 90;
  private readonly scrollSpeed = 22;
  private dragged = false;

  boardHeight = this.minimumBoardHeight;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['notes']) this.syncBoardHeight();
  }

  openCreateNote(): void {
    if (!this.canManage) return;
    this.createNote.emit();
  }

  openCreateNoteAt(event: MouseEvent): void {
    if (!this.canManage || event.detail !== 2) return;
    const target = event.target as HTMLElement;
    if (target.closest('.board-note')) return;
    const board = event.currentTarget as HTMLElement;
    const rect = board.getBoundingClientRect();
    this.createNoteAt.emit({
      x: Math.max(0, event.clientX - rect.left - 110),
      y: Math.max(0, event.clientY - rect.top - 100),
    });
  }

  openNote(note: BoardNote): void {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    this.viewNote.emit(note);
  }

  noteDragStarted(note: BoardNote): void {
    if (!note.id || !this.canManage) return;
    this.dragged = false;
    this.bringToFront.emit(note);
  }

  noteDragMoved(note: BoardNote, event: CdkDragMove): void {
    if (!this.canManage) return;
    this.dragged = true;
    const y = note.y + event.distance.y;
    this.ensureBoardSpace(y + (note.height || 200));
    const scroller = this.boardScroll?.nativeElement;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    if (event.pointerPosition.y > rect.bottom - this.scrollEdgeSize)
      scroller.scrollTop += this.scrollSpeed;
    else if (event.pointerPosition.y < rect.top + this.scrollEdgeSize)
      scroller.scrollTop -= this.scrollSpeed;
  }

  noteDragEnded(note: BoardNote, event: CdkDragEnd): void {
    if (!note.id || !this.canManage) return;
    const position = event.source.getFreeDragPosition();
    this.ensureBoardSpace(position.y + (note.height || 200));
    this.positionChange.emit({
      note,
      x: position.x,
      y: position.y,
    });
    setTimeout(() => {
      this.dragged = false;
    });
  }

  private syncBoardHeight(): void {
    const requiredHeight = this.notes.reduce(
      (height, note) => Math.max(height, note.y + (note.height || 200) + this.boardBottomSpace),
      this.minimumBoardHeight,
    );
    this.boardHeight = Math.max(this.minimumBoardHeight, requiredHeight);
  }

  private ensureBoardSpace(noteBottom: number): void {
    if (noteBottom < this.boardHeight - this.boardExtendThreshold) return;
    this.boardHeight = Math.max(
      this.boardHeight + this.boardExtendAmount,
      noteBottom + this.boardBottomSpace,
    );
  }
}
