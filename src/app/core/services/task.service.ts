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
import { Observable, of, switchMap } from 'rxjs';
import { ProjectTask, TaskStatus } from '../models/task.model';
import { TaskStatusDefinition } from '../models/task-status-definition.model';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private firestore = inject(Firestore);
  private workspaceService = inject(WorkspaceService);

  getTasks(): Observable<ProjectTask[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) return of([]);
        const tasksQuery = query(
          collection(this.firestore, 'tasks'),
          where('workspaceId', '==', workspace.id),
        );
        return collectionData(tasksQuery, { idField: 'id' }) as Observable<ProjectTask[]>;
      }),
    );
  }

  getTasksByProject(projectId: string): Observable<ProjectTask[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) return of([]);
        const tasksQuery = query(
          collection(this.firestore, 'tasks'),
          where('workspaceId', '==', workspace.id),
          where('projectId', '==', projectId),
        );
        return collectionData(tasksQuery, { idField: 'id' }) as Observable<ProjectTask[]>;
      }),
    );
  }

  createTask(task: Omit<ProjectTask, 'workspaceId'>) {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) throw new Error('No workspace selected.');
    const cleanTask = Object.fromEntries(
      Object.entries(task).filter(([, value]) => value !== undefined),
    );
    return addDoc(collection(this.firestore, 'tasks'), {
      ...cleanTask,
      workspaceId: workspace.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  updateTask(id: string, task: Partial<ProjectTask>) {
    const cleanTask = Object.fromEntries(
      Object.entries(task).filter(([, value]) => value !== undefined),
    );
    return updateDoc(doc(this.firestore, `tasks/${id}`), {
      ...cleanTask,
      updatedAt: serverTimestamp(),
    });
  }

  async updateTaskOrder(tasks: ProjectTask[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    tasks.forEach((task, index) => {
      if (!task.id) return;
      batch.update(doc(this.firestore, `tasks/${task.id}`), {
        status: task.status,
        order: index * 1000,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  async migrateLegacyStatuses(statuses: TaskStatusDefinition[]): Promise<number> {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) return 0;
    const statusMap = new Map<TaskStatus, string>();
    statuses.forEach((status) => {
      if (!status.id) return;
      const legacyValue = this.getLegacyStatusValue(status);
      if (legacyValue) statusMap.set(legacyValue, status.id);
    });
    if (!statusMap.size) return 0;
    const tasksQuery = query(
      collection(this.firestore, 'tasks'),
      where('workspaceId', '==', workspace.id),
    );
    const snapshot = await getDocs(tasksQuery);
    const migrations = snapshot.docs.filter((taskDoc) => {
      const status = taskDoc.data()['status'] as TaskStatus;
      return statusMap.has(status) && statusMap.get(status) !== status;
    });
    if (!migrations.length) return 0;
    let migrated = 0;
    let batch = writeBatch(this.firestore);
    let batchSize = 0;
    for (const taskDoc of migrations) {
      const currentStatus = taskDoc.data()['status'] as TaskStatus;
      const statusId = statusMap.get(currentStatus);
      if (!statusId) continue;
      batch.update(taskDoc.ref, {
        status: statusId,
        updatedAt: serverTimestamp(),
      });
      batchSize++;
      migrated++;
      if (batchSize === 450) {
        await batch.commit();
        batch = writeBatch(this.firestore);
        batchSize = 0;
      }
    }
    if (batchSize) await batch.commit();
    return migrated;
  }

  deleteTask(id: string) {
    return deleteDoc(doc(this.firestore, `tasks/${id}`));
  }

  private getLegacyStatusValue(status: TaskStatusDefinition): TaskStatus | null {
    if (status.legacyValue) return status.legacyValue;
    const name = status.name.trim().toLowerCase();
    if (name === 'to do') return 'todo';
    if (name === 'in progress') return 'in-progress';
    if (name === 'review') return 'review';
    if (name === 'completed') return 'completed';
    return null;
  }
}
