import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ProjectTask } from '../models/task.model';
import { query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private firestore = inject(Firestore);

  private tasksRef = collection(this.firestore, 'tasks');

  getTasks(): Observable<ProjectTask[]> {
    return collectionData(this.tasksRef, {
      idField: 'id',
    }) as Observable<ProjectTask[]>;
  }

  createTask(task: ProjectTask) {
    return addDoc(this.tasksRef, {
      ...task,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  updateTask(id: string, task: Partial<ProjectTask>) {
    const taskRef = doc(this.firestore, `tasks/${id}`);

    return updateDoc(taskRef, {
      ...task,
      updatedAt: serverTimestamp(),
    });
  }

  deleteTask(id: string) {
    return deleteDoc(doc(this.firestore, `tasks/${id}`));
  }

  getTasksByProject(projectId: string): Observable<ProjectTask[]> {
    const projectTasksQuery = query(this.tasksRef, where('projectId', '==', projectId));

    return collectionData(projectTasksQuery, {
      idField: 'id',
    }) as Observable<ProjectTask[]>;
  }
}
