import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
})
export class RichTextEditorComponent implements AfterViewInit, OnChanges {
  @ViewChild('editor') editor?: ElementRef<HTMLDivElement>;

  @Input() value = '';
  @Input() placeholder = 'Write a description...';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  private internalValue = '';
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.internalValue = this.prepareEditorValue(this.value);
    this.syncEditor();
    setTimeout(() => this.editor?.nativeElement.focus());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) return;
    this.internalValue = this.prepareEditorValue(this.value);
    if (this.viewReady) this.syncEditor();
  }

  close(): void {
    this.captureValue();
    this.closed.emit();
  }

  onInput(): void {
    this.captureValue();
  }

  format(command: string, value?: string): void {
    if (this.disabled) return;
    this.editor?.nativeElement.focus();
    document.execCommand(command, false, value);
    this.captureValue();
  }

  setBlock(tag: string): void {
    this.format('formatBlock', tag);
  }

  createLink(): void {
    if (this.disabled) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const url = window.prompt('Enter link URL');
    if (!url?.trim()) return;
    this.format('createLink', this.normalizeUrl(url.trim()));
  }

  removeLink(): void {
    this.format('unlink');
  }

  clearFormatting(): void {
    this.format('removeFormat');
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.close();
  }

  private captureValue(): void {
    if (!this.editor) return;
    const value = this.normalizeValue(this.editor.nativeElement.innerHTML);
    this.internalValue = value;
    this.valueChange.emit(value);
  }

  private syncEditor(): void {
    if (!this.editor) return;
    if (this.editor.nativeElement.innerHTML === this.internalValue) return;
    this.editor.nativeElement.innerHTML = this.internalValue;
  }

  private normalizeValue(value: string): string {
    const cleaned = value.trim();
    if (
      !cleaned ||
      cleaned === '<br>' ||
      cleaned === '<div><br></div>' ||
      cleaned === '<p><br></p>'
    )
      return '';
    return cleaned;
  }

  private normalizeUrl(url: string): string {
    if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
    return `https://${url}`;
  }

  private prepareEditorValue(value: string): string {
    if (!value?.trim()) return '';
    if (this.containsHtml(value)) return value;
    return this.plainTextToHtml(value);
  }

  private containsHtml(value: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(value);
  }

  private plainTextToHtml(value: string): string {
    const escaped = this.escapeHtml(value);
    return escaped
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
