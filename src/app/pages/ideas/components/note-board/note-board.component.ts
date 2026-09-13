import { CommonModule } from '@angular/common';
import { CdkDragEnd, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
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
export class NoteBoardComponent implements OnChanges, AfterViewInit, OnDestroy {
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
  private readonly boardRightSpace = 280;
  private readonly boardBottomSpace = 280;
  private readonly boardExtendThreshold = 180;
  private readonly boardExtendAmount = 400;
  private readonly scrollEdgeSize = 90;
  private readonly scrollSpeed = 22;
  private readonly minZoom = 0.4;
  private readonly maxZoom = 1.6;
  private readonly zoomStep = 0.1;
  private dragged = false;
  private resizeObserver?: ResizeObserver;
  boardHeight = this.minimumBoardHeight;
  boardWidth = 1;
  zoom = 1;
  ngAfterViewInit(): void {
    const scroller = this.boardScroll?.nativeElement;
    if (!scroller) return;
    this.syncBoardSize();
    this.resizeObserver = new ResizeObserver(() => this.syncBoardSize());
    this.resizeObserver.observe(scroller);
  }
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['notes']) this.syncBoardSize();
  }
  get zoomPercent(): number {
    return Math.round(this.zoom * 100);
  }
  zoomIn(): void {
    this.setZoom(this.zoom + this.zoomStep);
  }
  zoomOut(): void {
    this.setZoom(this.zoom - this.zoomStep);
  }
  resetZoom(): void {
    this.setZoom(1);
  }
  handleBoardWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    this.setZoom(this.zoom + (event.deltaY < 0 ? this.zoomStep : -this.zoomStep));
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
    const x = Math.max(0, (event.clientX - rect.left) / this.zoom - 110);
    const y = Math.max(0, (event.clientY - rect.top) / this.zoom - 100);
    this.ensureBoardSpace(x + 220, y + 200);
    this.createNoteAt.emit({ x, y });
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
    const x = Math.max(0, note.x + event.distance.x / this.zoom);
    const y = Math.max(0, note.y + event.distance.y / this.zoom);
    event.source.setFreeDragPosition({ x, y });
    this.ensureBoardSpace(x + (note.width || 220), y + (note.height || 200));
    const scroller = this.boardScroll?.nativeElement;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    if (event.pointerPosition.x > rect.right - this.scrollEdgeSize)
      scroller.scrollLeft += this.scrollSpeed;
    else if (event.pointerPosition.x < rect.left + this.scrollEdgeSize)
      scroller.scrollLeft -= this.scrollSpeed;
    if (event.pointerPosition.y > rect.bottom - this.scrollEdgeSize)
      scroller.scrollTop += this.scrollSpeed;
    else if (event.pointerPosition.y < rect.top + this.scrollEdgeSize)
      scroller.scrollTop -= this.scrollSpeed;
  }
  noteDragEnded(note: BoardNote, event: CdkDragEnd): void {
    if (!note.id || !this.canManage) return;
    const x = Math.max(0, note.x + event.distance.x / this.zoom);
    const y = Math.max(0, note.y + event.distance.y / this.zoom);
    event.source.setFreeDragPosition({ x, y });
    this.ensureBoardSpace(x + (note.width || 220), y + (note.height || 200));
    this.positionChange.emit({ note, x, y });
    setTimeout(() => {
      this.dragged = false;
    });
  }
  private setZoom(nextZoom: number): void {
    const zoom = Math.min(this.maxZoom, Math.max(this.minZoom, Number(nextZoom.toFixed(2))));
    if (zoom === this.zoom) return;
    this.zoom = zoom;
    this.syncBoardSize();
  }
  private syncBoardSize(): void {
    const scroller = this.boardScroll?.nativeElement;
    const viewportWidth = scroller ? Math.ceil(scroller.clientWidth / this.zoom) : 0;
    const viewportHeight = scroller ? Math.ceil(scroller.clientHeight / this.zoom) : 0;
    const contentWidth = this.notes.reduce(
      (width, note) => Math.max(width, note.x + (note.width || 220) + this.boardRightSpace),
      0,
    );
    const contentHeight = this.notes.reduce(
      (height, note) => Math.max(height, note.y + (note.height || 200) + this.boardBottomSpace),
      0,
    );
    this.boardWidth = Math.max(this.boardWidth, viewportWidth, contentWidth, 1);
    this.boardHeight = Math.max(
      this.boardHeight,
      this.minimumBoardHeight,
      viewportHeight,
      contentHeight,
    );
  }
  private ensureBoardSpace(noteRight: number, noteBottom: number): void {
    if (noteRight >= this.boardWidth - this.boardExtendThreshold)
      this.boardWidth = Math.max(
        this.boardWidth + this.boardExtendAmount,
        noteRight + this.boardRightSpace,
      );
    if (noteBottom >= this.boardHeight - this.boardExtendThreshold)
      this.boardHeight = Math.max(
        this.boardHeight + this.boardExtendAmount,
        noteBottom + this.boardBottomSpace,
      );
  }
}
