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
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { ProjectTask } from '../models/task.model';
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
        if (!workspace?.id) {
          return of([]);
        }

        const tasksRef = collection(this.firestore, 'tasks');

        const tasksQuery = query(tasksRef, where('workspaceId', '==', workspace.id));

        return collectionData(tasksQuery, {
          idField: 'id',
        }) as Observable<ProjectTask[]>;
      }),
    );
  }

  getTasksByProject(projectId: string): Observable<ProjectTask[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) {
          return of([]);
        }

        const tasksRef = collection(this.firestore, 'tasks');

        const tasksQuery = query(
          tasksRef,
          where('workspaceId', '==', workspace.id),
          where('projectId', '==', projectId),
        );

        return collectionData(tasksQuery, {
          idField: 'id',
        }) as Observable<ProjectTask[]>;
      }),
    );
  }

  createTask(task: Omit<ProjectTask, 'workspaceId'>) {
    const workspace = this.workspaceService.currentWorkspace();

    if (!workspace?.id) {
      throw new Error('No workspace selected.');
    }

    const tasksRef = collection(this.firestore, 'tasks');

    const cleanTask = Object.fromEntries(
      Object.entries(task).filter(([, value]) => value !== undefined),
    );

    return addDoc(tasksRef, {
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

    const taskRef = doc(this.firestore, `tasks/${id}`);

    return updateDoc(taskRef, {
      ...cleanTask,
      updatedAt: serverTimestamp(),
    });
  }

  deleteTask(id: string) {
    const taskRef = doc(this.firestore, `tasks/${id}`);

    return deleteDoc(taskRef);
  }
}
