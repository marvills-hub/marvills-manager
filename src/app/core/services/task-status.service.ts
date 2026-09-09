import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { firstValueFrom, map, Observable } from 'rxjs';
import { TaskStatusDefinition } from '../models/task-status-definition.model';

@Injectable({
  providedIn: 'root',
})
export class TaskStatusService {
  private readonly firestore = inject(Firestore);

  getStatuses(workspaceId: string): Observable<TaskStatusDefinition[]> {
    const statusesQuery = query(
      collection(this.firestore, 'taskStatuses'),
      where('workspaceId', '==', workspaceId),
    );
    return (
      collectionData(statusesQuery, { idField: 'id' }) as Observable<TaskStatusDefinition[]>
    ).pipe(
      map((statuses) =>
        [...statuses].sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
          const orderB = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
          return orderA - orderB || a.name.localeCompare(b.name);
        }),
      ),
    );
  }

  async getStatusesOnce(workspaceId: string): Promise<TaskStatusDefinition[]> {
    return firstValueFrom(this.getStatuses(workspaceId));
  }

  async ensureDefaultStatuses(workspaceId: string, initialized = false): Promise<void> {
    if (initialized) return;
    const statusesRef = collection(this.firestore, 'taskStatuses');
    const existingQuery = query(statusesRef, where('workspaceId', '==', workspaceId));
    const snapshot = await getDocs(existingQuery);
    const existingNames = new Set(
      snapshot.docs
        .map((item) => (item.data()['name'] as string)?.trim().toLowerCase())
        .filter(Boolean),
    );
    const defaults: Omit<TaskStatusDefinition, 'id'>[] = [
      {
        workspaceId,
        name: 'To Do',
        color: '#7786a6',
        order: 0,
        isCompleted: false,
        legacyValue: 'todo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        workspaceId,
        name: 'In Progress',
        color: '#5e80ff',
        order: 1,
        isCompleted: false,
        legacyValue: 'in-progress',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        workspaceId,
        name: 'Review',
        color: '#a56cff',
        order: 2,
        isCompleted: false,
        legacyValue: 'review',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        workspaceId,
        name: 'Completed',
        color: '#2dbe82',
        order: 3,
        isCompleted: true,
        legacyValue: 'completed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ];
    const missingDefaults = defaults.filter(
      (status) => !existingNames.has(status.name.toLowerCase()),
    );
    if (missingDefaults.length) {
      const highestOrder = snapshot.docs.reduce((highest, item) => {
        const order = item.data()['order'];
        return typeof order === 'number' ? Math.max(highest, order) : highest;
      }, -1);
      const batch = writeBatch(this.firestore);
      missingDefaults.forEach((status, index) => {
        batch.set(doc(statusesRef), {
          ...status,
          order: highestOrder + index + 1,
        });
      });
      await batch.commit();
    }
    await updateDoc(doc(this.firestore, 'workspaces', workspaceId), {
      taskStatusesInitialized: true,
      updatedAt: serverTimestamp(),
    });
  }

  async createStatus(
    workspaceId: string,
    name: string,
    color: string,
    order: number,
    isCompleted = false,
  ): Promise<string> {
    const statusRef = await addDoc(collection(this.firestore, 'taskStatuses'), {
      workspaceId,
      name: name.trim(),
      color,
      order,
      isCompleted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return statusRef.id;
  }

  async updateStatus(
    statusId: string,
    changes: Partial<Pick<TaskStatusDefinition, 'name' | 'color' | 'order' | 'isCompleted'>>,
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'taskStatuses', statusId), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteStatus(statusId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'taskStatuses', statusId));
  }

  async reorderStatuses(statuses: TaskStatusDefinition[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    statuses.forEach((status, index) => {
      if (!status.id) return;
      batch.update(doc(this.firestore, 'taskStatuses', status.id), {
        order: index,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}
