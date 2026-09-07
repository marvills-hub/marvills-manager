import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { Project } from '../models/project.model';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private firestore = inject(Firestore);
  private workspaceService = inject(WorkspaceService);

  getProjects(): Observable<Project[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) {
          return of([]);
        }

        const projectsRef = collection(this.firestore, 'projects');

        const projectsQuery = query(projectsRef, where('workspaceId', '==', workspace.id));

        return collectionData(projectsQuery, {
          idField: 'id',
        }) as Observable<Project[]>;
      }),
    );
  }

  getProject(id: string): Observable<Project> {
    const projectRef = doc(this.firestore, `projects/${id}`);

    return docData(projectRef, {
      idField: 'id',
    }) as Observable<Project>;
  }

  createProject(project: Omit<Project, 'workspaceId'>) {
    const workspace = this.workspaceService.currentWorkspace();

    if (!workspace?.id) {
      throw new Error('No workspace selected.');
    }

    const projectsRef = collection(this.firestore, 'projects');

    const cleanProject = Object.fromEntries(
      Object.entries(project).filter(([, value]) => value !== undefined),
    );

    return addDoc(projectsRef, {
      ...cleanProject,
      workspaceId: workspace.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  updateProject(id: string, project: Partial<Project>) {
    const cleanProject = Object.fromEntries(
      Object.entries(project).filter(([, value]) => value !== undefined),
    );

    const projectRef = doc(this.firestore, `projects/${id}`);

    return updateDoc(projectRef, {
      ...cleanProject,
      updatedAt: serverTimestamp(),
    });
  }

  deleteProject(id: string) {
    const projectRef = doc(this.firestore, `projects/${id}`);

    return deleteDoc(projectRef);
  }
}
