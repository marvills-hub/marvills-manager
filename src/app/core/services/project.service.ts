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
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Project } from '../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private firestore = inject(Firestore);

  getProjects(): Observable<Project[]> {
    const projectsRef = collection(this.firestore, 'projects');

    const projectsQuery = query(projectsRef);

    return collectionData(projectsQuery, {
      idField: 'id',
    }) as Observable<Project[]>;
  }

  getProject(id: string): Observable<Project> {
    const projectRef = doc(this.firestore, `projects/${id}`);

    return docData(projectRef, {
      idField: 'id',
    }) as Observable<Project>;
  }

  createProject(project: Project) {
    const projectsRef = collection(this.firestore, 'projects');

    const cleanProject = Object.fromEntries(
      Object.entries(project).filter(([, value]) => value !== undefined),
    );

    return addDoc(projectsRef, {
      ...cleanProject,
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
