import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NOTE_DESIGNS, NOTE_PINS } from '../../../../core/constants/note-design.constant';
import { BoardNote, NoteDesignId, NotePinId } from '../../../../core/models/borad-note.model';
import { RichTextEditorComponent } from '../../../../shared/rich-text-editor/rich-text-editor.component';

export interface NoteEditorValue {
  title: string;
  content: string;
  design: NoteDesignId;
  pin: NotePinId;
}

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RichTextEditorComponent],
  templateUrl: './note-editor.component.html',
  styleUrl: './note-editor.component.scss',
})
export class NoteEditorComponent implements OnChanges {
  private fb = inject(FormBuilder);

  @Input() open = false;
  @Input() note: BoardNote | null = null;
  @Input() saving = false;
  @Input() canManage = false;

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<NoteEditorValue>();

  readonly noteDesigns = NOTE_DESIGNS;
  readonly notePins = NOTE_PINS;

  richEditorOpen = false;

  noteForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    content: [''],
    design: ['classic-yellow' as NoteDesignId],
    pin: ['red-pin' as NotePinId],
  });

  get editing(): boolean {
    return !!this.note;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['open'] || changes['note']) && this.open) this.loadNote();
    if (changes['open'] && !this.open) this.richEditorOpen = false;
  }

  close(): void {
    if (this.saving) return;
    this.richEditorOpen = false;
    this.closed.emit();
  }

  openRichEditor(): void {
    if (!this.canManage || this.saving) return;
    this.richEditorOpen = true;
  }

  closeRichEditor(): void {
    this.richEditorOpen = false;
  }

  updateContent(content: string): void {
    this.noteForm.controls.content.setValue(content);
    this.noteForm.controls.content.markAsDirty();
  }

  selectDesign(design: NoteDesignId): void {
    this.noteForm.controls.design.setValue(design);
  }

  selectPin(pin: NotePinId): void {
    this.noteForm.controls.pin.setValue(pin);
  }

  submit(): void {
    if (!this.canManage || this.saving || this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }
    const value = this.noteForm.getRawValue();
    const title = value.title.trim();
    if (!title) {
      this.noteForm.controls.title.setErrors({ required: true });
      return;
    }
    this.submitted.emit({
      title,
      content: value.content,
      design: value.design,
      pin: value.pin,
    });
  }

  private loadNote(): void {
    this.richEditorOpen = false;
    this.noteForm.reset({
      title: this.note?.title ?? '',
      content: this.note?.content ?? '',
      design: this.note?.design ?? 'classic-yellow',
      pin: this.note?.pin ?? 'red-pin',
    });
  }
}
