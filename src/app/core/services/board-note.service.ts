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
import { AuthService } from './auth.service';
import { WorkspaceService } from './workspace.service';
import { BoardNote, NoteDesignId, NotePinId } from '../models/borad-note.model';

@Injectable({
  providedIn: 'root',
})
export class BoardNoteService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);

  getNotes(): Observable<BoardNote[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) return of([]);
        const notesRef = collection(this.firestore, 'boardNotes');
        const notesQuery = query(notesRef, where('workspaceId', '==', workspace.id));
        return collectionData(notesQuery, { idField: 'id' }) as Observable<BoardNote[]>;
      }),
      map((notes) => [...notes].sort((a, b) => a.zIndex - b.zIndex)),
    );
  }

  async createNote(data: {
    title?: string;
    content?: string;
    x?: number;
    y?: number;
    design?: NoteDesignId;
    pin?: NotePinId;
  }): Promise<string> {
    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;
    if (!workspace?.id) throw new Error('No workspace selected.');
    if (!user) throw new Error('You must be signed in.');
    const document = await addDoc(collection(this.firestore, 'boardNotes'), {
      workspaceId: workspace.id,
      type: 'note',
      title: data.title?.trim() || 'New Note',
      content: data.content?.trim() ?? '',
      design: data.design ?? 'classic-yellow',
      pin: data.pin ?? 'red-pin',
      x: data.x ?? 40,
      y: data.y ?? 40,
      width: 220,
      height: 200,
      zIndex: Date.now(),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return document.id;
  }

  async createIdeaNote(
    ideaId: string,
    title: string,
    data?: {
      content?: string;
      x?: number;
      y?: number;
      design?: NoteDesignId;
      pin?: NotePinId;
    },
  ): Promise<string> {
    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;
    if (!workspace?.id) throw new Error('No workspace selected.');
    if (!user) throw new Error('You must be signed in.');
    const document = await addDoc(collection(this.firestore, 'boardNotes'), {
      workspaceId: workspace.id,
      type: 'idea',
      ideaId,
      title: title.trim(),
      content: data?.content?.trim() ?? '',
      design: data?.design ?? 'classic-yellow',
      pin: data?.pin ?? 'red-pin',
      x: data?.x ?? 40,
      y: data?.y ?? 40,
      width: 220,
      height: 200,
      zIndex: Date.now(),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return document.id;
  }

  async updateNote(id: string, data: Partial<BoardNote>): Promise<void> {
    const {
      id: ignoredId,
      workspaceId: ignoredWorkspaceId,
      createdBy: ignoredCreatedBy,
      createdAt: ignoredCreatedAt,
      ...updates
    } = data;
    await updateDoc(doc(this.firestore, `boardNotes/${id}`), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  async updatePosition(id: string, x: number, y: number): Promise<void> {
    await updateDoc(doc(this.firestore, `boardNotes/${id}`), {
      x,
      y,
      updatedAt: serverTimestamp(),
    });
  }

  async updateDesign(id: string, design: NoteDesignId, pin: NotePinId): Promise<void> {
    await updateDoc(doc(this.firestore, `boardNotes/${id}`), {
      design,
      pin,
      updatedAt: serverTimestamp(),
    });
  }

  async bringToFront(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, `boardNotes/${id}`), {
      zIndex: Date.now(),
      updatedAt: serverTimestamp(),
    });
  }

  async linkIdea(id: string, ideaId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `boardNotes/${id}`), {
      type: 'idea',
      ideaId,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteNote(note: BoardNote): Promise<void> {
    if (!note.id) return;
    const batch = writeBatch(this.firestore);
    batch.delete(doc(this.firestore, `boardNotes/${note.id}`));
    if (note.ideaId) {
      batch.update(doc(this.firestore, `ideas/${note.ideaId}`), {
        boardNoteId: null,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
