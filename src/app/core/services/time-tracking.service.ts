import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { TimeEntry } from '../models/time-entry.model';
@Injectable({
  providedIn: 'root',
})
export class TimeTrackingService {
  private firestore = inject(Firestore);
  getEntries(workspaceId: string, userId: string): Observable<TimeEntry[]> {
    const ref = collection(this.firestore, 'timeEntries');
    const q = query(ref, where('workspaceId', '==', workspaceId), where('userId', '==', userId));
    return collectionData(q, { idField: 'id' }) as Observable<TimeEntry[]>;
  }
  async startTimer(data: {
    workspaceId: string;
    userId: string;
    projectId: string;
    taskId: string;
    description: string;
  }): Promise<string> {
    const now = Timestamp.now();
    const ref = await addDoc(collection(this.firestore, 'timeEntries'), {
      ...data,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  }
  async stopTimer(entry: TimeEntry): Promise<void> {
    if (!entry.id || entry.endedAt) return;
    const endedAt = Timestamp.now();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.toMillis() - entry.startedAt.toMillis()) / 1000),
    );
    await updateDoc(doc(this.firestore, `timeEntries/${entry.id}`), {
      endedAt,
      durationSeconds,
      updatedAt: endedAt,
    });
  }
  async updateDescription(entryId: string, description: string): Promise<void> {
    await updateDoc(doc(this.firestore, `timeEntries/${entryId}`), {
      description: description.trim(),
      updatedAt: Timestamp.now(),
    });
  }
  async deleteEntry(entryId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `timeEntries/${entryId}`));
  }
}
