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
import { Client } from '../models/client.model';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private firestore = inject(Firestore);

  private clientsRef = collection(this.firestore, 'clients');

  getClients(): Observable<Client[]> {
    return collectionData(this.clientsRef, {
      idField: 'id',
    }) as Observable<Client[]>;
  }

  createClient(client: Client) {
    return addDoc(this.clientsRef, {
      ...client,
      createdAt: serverTimestamp(),
    });
  }

  updateClient(id: string, client: Partial<Client>) {
    return updateDoc(doc(this.firestore, `clients/${id}`), client);
  }

  deleteClient(id: string) {
    return deleteDoc(doc(this.firestore, `clients/${id}`));
  }
}
