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
import { Client } from '../models/client.model';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private firestore = inject(Firestore);
  private workspaceService = inject(WorkspaceService);

  getClients(): Observable<Client[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) {
          return of([]);
        }

        const clientsRef = collection(this.firestore, 'clients');

        const clientsQuery = query(clientsRef, where('workspaceId', '==', workspace.id));

        return collectionData(clientsQuery, {
          idField: 'id',
        }) as Observable<Client[]>;
      }),
    );
  }

  createClient(client: Omit<Client, 'workspaceId'>) {
    const workspace = this.workspaceService.currentWorkspace();

    if (!workspace?.id) {
      throw new Error('No workspace selected.');
    }

    const clientsRef = collection(this.firestore, 'clients');

    const cleanClient = Object.fromEntries(
      Object.entries(client).filter(([, value]) => value !== undefined),
    );

    return addDoc(clientsRef, {
      ...cleanClient,
      workspaceId: workspace.id,
      createdAt: serverTimestamp(),
    });
  }

  updateClient(id: string, client: Partial<Client>) {
    const cleanClient = Object.fromEntries(
      Object.entries(client).filter(([, value]) => value !== undefined),
    );

    const clientRef = doc(this.firestore, `clients/${id}`);

    return updateDoc(clientRef, cleanClient);
  }

  deleteClient(id: string) {
    const clientRef = doc(this.firestore, `clients/${id}`);

    return deleteDoc(clientRef);
  }
}
