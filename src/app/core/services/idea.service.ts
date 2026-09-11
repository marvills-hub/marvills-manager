import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { map, Observable, of, switchMap } from 'rxjs';
import { Idea } from '../models/idea.model';
import { AuthService } from './auth.service';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class IdeaService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);

  getIdeas(): Observable<Idea[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) return of([]);
        const ideasRef = collection(this.firestore, 'ideas');
        const ideasQuery = query(ideasRef, where('workspaceId', '==', workspace.id));
        return collectionData(ideasQuery, { idField: 'id' }) as Observable<Idea[]>;
      }),
      map((ideas) =>
        [...ideas].sort((a, b) => this.getTimestamp(b.createdAt) - this.getTimestamp(a.createdAt)),
      ),
    );
  }

  async createIdea(data: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
  }): Promise<string> {
    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;
    if (!workspace?.id) throw new Error('No workspace selected.');
    if (!user) throw new Error('You must be signed in.');
    const title = data.title.trim();
    if (!title) throw new Error('Idea title is required.');
    const document = await addDoc(collection(this.firestore, 'ideas'), {
      workspaceId: workspace.id,
      title,
      description: data.description?.trim() ?? '',
      status: 'idea',
      priority: 'medium',
      category: data.category?.trim() ?? '',
      tags: data.tags ?? [],
      notes: '',
      targetDate: null,
      boardNoteId: null,
      convertedProjectId: null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return document.id;
  }

  async updateIdea(id: string, data: Partial<Idea>): Promise<void> {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) throw new Error('No workspace selected.');
    const {
      id: ignoredId,
      workspaceId: ignoredWorkspaceId,
      createdBy: ignoredCreatedBy,
      createdAt: ignoredCreatedAt,
      ...updates
    } = data;
    await updateDoc(doc(this.firestore, `ideas/${id}`), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  async linkBoardNote(ideaId: string, boardNoteId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `ideas/${ideaId}`), {
      boardNoteId,
      updatedAt: serverTimestamp(),
    });
  }

  async clearBoardNote(ideaId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `ideas/${ideaId}`), {
      boardNoteId: null,
      updatedAt: serverTimestamp(),
    });
  }

  async convertToProject(idea: Idea): Promise<string> {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) throw new Error('No workspace selected.');
    if (!idea.id) throw new Error('Idea ID is missing.');
    if (idea.workspaceId !== workspace.id)
      throw new Error('Idea does not belong to the current workspace.');
    if (idea.convertedProjectId) throw new Error('This idea has already been converted.');
    const projectRef = doc(collection(this.firestore, 'projects'));
    const ideaRef = doc(this.firestore, `ideas/${idea.id}`);
    const batch = writeBatch(this.firestore);
    batch.set(projectRef, {
      workspaceId: workspace.id,
      name: idea.title,
      description: idea.description ?? '',
      clientName: '',
      status: 'planning',
      priority: idea.priority,
      progress: 0,
      startDate: null,
      dueDate: idea.targetDate ?? null,
      attachments: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(ideaRef, {
      status: 'converted',
      convertedProjectId: projectRef.id,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return projectRef.id;
  }

  async deleteIdea(idea: Idea): Promise<void> {
    if (!idea.id) return;
    const batch = writeBatch(this.firestore);
    batch.delete(doc(this.firestore, `ideas/${idea.id}`));
    if (idea.boardNoteId) {
      batch.delete(doc(this.firestore, `boardNotes/${idea.boardNoteId}`));
    }
    await batch.commit();
  }

  private getTimestamp(value: any): number {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return new Date(value).getTime() || 0;
  }
}
