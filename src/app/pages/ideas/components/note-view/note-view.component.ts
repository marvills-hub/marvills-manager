import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BoardNote } from '../../../../core/models/borad-note.model';

@Component({
  selector: 'app-note-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './note-view.component.html',
  styleUrl: './note-view.component.scss',
})
export class NoteViewComponent {
  @Input() open = false;
  @Input() note: BoardNote | null = null;
  @Input() canManage = false;

  @Output() closed = new EventEmitter<void>();
  @Output() editNote = new EventEmitter<BoardNote>();
  @Output() deleteNote = new EventEmitter<BoardNote>();
  @Output() convertNote = new EventEmitter<BoardNote>();

  close(): void {
    this.closed.emit();
  }

  edit(): void {
    if (!this.note || !this.canManage) return;
    this.editNote.emit(this.note);
  }

  delete(): void {
    if (!this.note || !this.canManage) return;
    this.deleteNote.emit(this.note);
  }

  convert(): void {
    if (!this.note || !this.canManage || this.note.type !== 'note') return;
    this.convertNote.emit(this.note);
  }
}
