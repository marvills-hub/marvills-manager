import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BoardNote } from '../../core/models/borad-note.model';
import { Idea, IdeaPriority, IdeaStatus } from '../../core/models/idea.model';
import { BoardNoteService } from '../../core/services/board-note.service';
import { IdeaService } from '../../core/services/idea.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';
import { IdeaBacklogComponent } from './components/idea-backlog/idea-backlog.component';
import { NoteBoardComponent } from './components/note-board/note-board.component';
import {
  NoteEditorComponent,
  NoteEditorValue,
} from './components/note-editor/note-editor.component';
import { NoteViewComponent } from './components/note-view/note-view.component';

type IdeasView = 'board' | 'backlog';
type BoardFilter = 'all' | 'notes' | 'ideas';
type IdeaFilter = 'all' | IdeaStatus;

@Component({
  selector: 'app-ideas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NoteBoardComponent,
    IdeaBacklogComponent,
    NoteEditorComponent,
    NoteViewComponent,
  ],
  templateUrl: './ideas.component.html',
  styleUrl: './ideas.component.scss',
})
export class IdeasComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private boardNoteService = inject(BoardNoteService);
  private ideaService = inject(IdeaService);
  private toast = inject(ToastService);
  private topbarService = inject(TopbarService);
  private router = inject(Router);
  readonly permissions = inject(WorkspacePermissionService);

  private notesSubscription?: Subscription;
  private ideasSubscription?: Subscription;
  private pendingNotePosition: { x: number; y: number } | null = null;

  notes: BoardNote[] = [];
  ideas: Idea[] = [];
  view: IdeasView = 'board';
  boardFilter: BoardFilter = 'all';
  ideaFilter: IdeaFilter = 'all';
  searchTerm = '';
  noteDialogOpen = false;
  editingNote: BoardNote | null = null;
  viewingNote: BoardNote | null = null;
  savingNote = false;
  ideaDialogOpen = false;
  editingIdea: Idea | null = null;
  savingIdea = false;
  deletingNote: BoardNote | null = null;
  deletingIdea: Idea | null = null;
  deleting = false;

  ideaForm = this.fb.group({
    title: this.fb.nonNullable.control('', Validators.required),
    description: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control<IdeaStatus>('idea'),
    priority: this.fb.nonNullable.control<IdeaPriority>('medium'),
    category: this.fb.nonNullable.control(''),
    tags: this.fb.nonNullable.control(''),
    notes: this.fb.nonNullable.control(''),
    targetDate: this.fb.control<string | null>(null),
  });

  get filteredNotes(): BoardNote[] {
    const search = this.searchTerm.trim().toLowerCase();
    return this.notes.filter((note) => {
      const matchesType =
        this.boardFilter === 'all' ||
        (this.boardFilter === 'notes' && note.type === 'note') ||
        (this.boardFilter === 'ideas' && note.type === 'idea');
      const matchesSearch =
        !search ||
        note.title.toLowerCase().includes(search) ||
        (note.content ?? '').toLowerCase().includes(search);
      return matchesType && matchesSearch;
    });
  }

  get filteredIdeas(): Idea[] {
    const search = this.searchTerm.trim().toLowerCase();
    return this.ideas.filter((idea) => {
      const matchesStatus = this.ideaFilter === 'all' || idea.status === this.ideaFilter;
      const matchesSearch =
        !search ||
        idea.title.toLowerCase().includes(search) ||
        (idea.description ?? '').toLowerCase().includes(search) ||
        (idea.category ?? '').toLowerCase().includes(search) ||
        idea.tags.some((tag) => tag.toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }

  get noteCount(): number {
    return this.notes.filter((note) => note.type === 'note').length;
  }

  get boardIdeaCount(): number {
    return this.notes.filter((note) => note.type === 'idea').length;
  }

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Ideas',
      icon: 'fa-regular fa-lightbulb',
    });
    this.notesSubscription = this.boardNoteService.getNotes().subscribe({
      next: (notes) => {
        this.notes = notes;
        if (this.viewingNote?.id) {
          this.viewingNote = notes.find((note) => note.id === this.viewingNote?.id) ?? null;
        }
      },
      error: () => {
        this.toast.error('Unable to load board notes.');
      },
    });
    this.ideasSubscription = this.ideaService.getIdeas().subscribe({
      next: (ideas) => {
        this.ideas = ideas;
      },
      error: () => {
        this.toast.error('Unable to load ideas.');
      },
    });
  }

  ngOnDestroy(): void {
    this.notesSubscription?.unsubscribe();
    this.ideasSubscription?.unsubscribe();
  }

  setView(view: IdeasView): void {
    this.view = view;
    this.searchTerm = '';
  }

  updateSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  setBoardFilter(filter: BoardFilter): void {
    this.boardFilter = filter;
  }

  setIdeaFilter(filter: IdeaFilter): void {
    this.ideaFilter = filter;
  }

  openCreateNote(): void {
    if (!this.permissions.canManageContent()) return;
    this.editingNote = null;
    this.pendingNotePosition = null;
    this.noteDialogOpen = true;
  }

  openCreateNoteAtPosition(position: { x: number; y: number }): void {
    if (!this.permissions.canManageContent()) return;
    this.editingNote = null;
    this.pendingNotePosition = position;
    this.noteDialogOpen = true;
  }

  openEditNote(note: BoardNote): void {
    if (!this.permissions.canManageContent()) return;
    this.viewingNote = null;
    this.editingNote = note;
    this.pendingNotePosition = null;
    this.noteDialogOpen = true;
  }

  closeNoteDialog(): void {
    if (this.savingNote) return;
    this.noteDialogOpen = false;
    this.editingNote = null;
    this.pendingNotePosition = null;
  }

  async saveNote(value: NoteEditorValue): Promise<void> {
    if (!this.permissions.canManageContent() || this.savingNote) return;
    this.savingNote = true;
    try {
      if (this.editingNote?.id) {
        await this.boardNoteService.updateNote(this.editingNote.id, {
          title: value.title,
          content: value.content.trim(),
          design: value.design,
          pin: value.pin,
        });
        this.toast.success('Note updated.');
      } else {
        const x = this.pendingNotePosition?.x ?? 40 + Math.random() * 180;
        const y = this.pendingNotePosition?.y ?? 40 + Math.random() * 100;
        await this.boardNoteService.createNote({
          title: value.title,
          content: value.content.trim(),
          design: value.design,
          pin: value.pin,
          x,
          y,
        });
        this.toast.success('Note added to board.');
      }
      this.noteDialogOpen = false;
      this.editingNote = null;
      this.pendingNotePosition = null;
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to save note.');
    } finally {
      this.savingNote = false;
    }
  }

  openNoteView(note: BoardNote): void {
    this.viewingNote = note;
  }

  closeNoteView(): void {
    this.viewingNote = null;
  }

  openDeleteNoteFromView(note: BoardNote): void {
    this.viewingNote = null;
    this.openDeleteNote(note);
  }

  async convertNoteFromView(note: BoardNote): Promise<void> {
    this.viewingNote = null;
    await this.convertNoteToIdea(note);
  }

  async bringNoteToFront(note: BoardNote): Promise<void> {
    if (!note.id || !this.permissions.canManageContent()) return;
    try {
      await this.boardNoteService.bringToFront(note.id);
    } catch {
      return;
    }
  }

  async updateNotePosition(event: { note: BoardNote; x: number; y: number }): Promise<void> {
    if (!event.note.id || !this.permissions.canManageContent()) return;
    try {
      await this.boardNoteService.updatePosition(event.note.id, event.x, event.y);
    } catch {
      this.toast.error('Unable to save note position.');
    }
  }

  openDeleteNote(note: BoardNote): void {
    if (!this.permissions.canManageContent()) return;
    this.deletingNote = note;
  }

  closeDeleteNote(): void {
    if (this.deleting) return;
    this.deletingNote = null;
  }

  async confirmDeleteNote(): Promise<void> {
    if (!this.deletingNote?.id || !this.permissions.canManageContent() || this.deleting) return;
    this.deleting = true;
    try {
      await this.boardNoteService.deleteNote(this.deletingNote);
      this.deletingNote = null;
      this.viewingNote = null;
      this.toast.success('Note deleted.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to delete note.');
    } finally {
      this.deleting = false;
    }
  }

  async convertNoteToIdea(note: BoardNote): Promise<void> {
    if (!note.id || note.type === 'idea' || !this.permissions.canManageContent()) return;
    try {
      const ideaId = await this.ideaService.createIdea({
        title: note.title,
        description: note.content ?? '',
      });
      await this.boardNoteService.linkIdea(note.id, ideaId);
      await this.ideaService.linkBoardNote(ideaId, note.id);
      this.toast.success('Note converted to an idea.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to convert note.');
    }
  }

  openCreateIdea(): void {
    if (!this.permissions.canManageContent()) return;
    this.editingIdea = null;
    this.ideaForm.reset({
      title: '',
      description: '',
      status: 'idea',
      priority: 'medium',
      category: '',
      tags: '',
      notes: '',
      targetDate: null,
    });
    this.ideaDialogOpen = true;
  }

  openEditIdea(idea: Idea): void {
    if (!this.permissions.canManageContent()) return;
    this.editingIdea = idea;
    this.ideaForm.reset({
      title: idea.title,
      description: idea.description ?? '',
      status: idea.status,
      priority: idea.priority,
      category: idea.category ?? '',
      tags: idea.tags.join(', '),
      notes: idea.notes ?? '',
      targetDate: this.toDateInputValue(idea.targetDate),
    });
    this.ideaDialogOpen = true;
  }

  closeIdeaDialog(): void {
    if (this.savingIdea) return;
    this.ideaDialogOpen = false;
    this.editingIdea = null;
  }

  async saveIdea(): Promise<void> {
    if (!this.permissions.canManageContent() || this.ideaForm.invalid || this.savingIdea) {
      this.ideaForm.markAllAsTouched();
      return;
    }
    const value = this.ideaForm.getRawValue();
    const title = value.title.trim();
    const tags = value.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!title) {
      this.ideaForm.controls.title.setErrors({ required: true });
      return;
    }
    this.savingIdea = true;
    try {
      if (this.editingIdea?.id) {
        await this.ideaService.updateIdea(this.editingIdea.id, {
          title,
          description: value.description.trim(),
          status: value.status,
          priority: value.priority,
          category: value.category.trim(),
          tags,
          notes: value.notes.trim(),
          targetDate: value.targetDate ? new Date(`${value.targetDate}T00:00:00`) : null,
        });
        this.toast.success('Idea updated.');
      } else {
        const ideaId = await this.ideaService.createIdea({
          title,
          description: value.description.trim(),
          category: value.category.trim(),
          tags,
        });
        await this.ideaService.updateIdea(ideaId, {
          status: value.status,
          priority: value.priority,
          notes: value.notes.trim(),
          targetDate: value.targetDate ? new Date(`${value.targetDate}T00:00:00`) : null,
        });
        this.toast.success('Idea created.');
      }
      this.ideaDialogOpen = false;
      this.editingIdea = null;
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to save idea.');
    } finally {
      this.savingIdea = false;
    }
  }

  async pinIdeaToBoard(idea: Idea): Promise<void> {
    if (!idea.id || idea.boardNoteId || !this.permissions.canManageContent()) return;
    try {
      const boardNoteId = await this.boardNoteService.createIdeaNote(idea.id, idea.title, {
        content: idea.description ?? '',
        x: 50 + Math.random() * 220,
        y: 50 + Math.random() * 130,
      });
      await this.ideaService.linkBoardNote(idea.id, boardNoteId);
      this.toast.success('Idea pinned to board.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to pin idea.');
    }
  }

  openDeleteIdea(idea: Idea): void {
    if (!this.permissions.canManageContent()) return;
    this.deletingIdea = idea;
  }

  closeDeleteIdea(): void {
    if (this.deleting) return;
    this.deletingIdea = null;
  }

  async confirmDeleteIdea(): Promise<void> {
    if (!this.deletingIdea?.id || !this.permissions.canManageContent() || this.deleting) return;
    this.deleting = true;
    try {
      await this.ideaService.deleteIdea(this.deletingIdea);
      this.deletingIdea = null;
      this.toast.success('Idea deleted.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to delete idea.');
    } finally {
      this.deleting = false;
    }
  }

  async convertIdeaToProject(idea: Idea): Promise<void> {
    if (!idea.id || idea.convertedProjectId || !this.permissions.canManageContent()) return;
    try {
      const projectId = await this.ideaService.convertToProject(idea);
      this.toast.success('Idea converted to project.');
      await this.router.navigate(['/projects', projectId]);
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to convert idea to project.');
    }
  }

  openConvertedProject(idea: Idea): void {
    if (!idea.convertedProjectId) return;
    this.router.navigate(['/projects', idea.convertedProjectId]);
  }

  async changeIdeaStatusValue(event: { idea: Idea; status: IdeaStatus }): Promise<void> {
    if (!event.idea.id || event.idea.status === 'converted' || !this.permissions.canManageContent())
      return;
    try {
      await this.ideaService.updateIdea(event.idea.id, { status: event.status });
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to update idea status.');
    }
  }

  async changeIdeaPriorityValue(event: { idea: Idea; priority: IdeaPriority }): Promise<void> {
    if (!event.idea.id || !this.permissions.canManageContent()) return;
    try {
      await this.ideaService.updateIdea(event.idea.id, { priority: event.priority });
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to update idea priority.');
    }
  }

  private toDateInputValue(value: any): string | null {
    if (!value) return null;
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
