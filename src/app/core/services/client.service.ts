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
import { deleteObject, getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';
import { Observable, of, switchMap } from 'rxjs';
import { Client } from '../models/client.model';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private workspaceService = inject(WorkspaceService);
  private readonly maxPhotoSize = 5 * 1024 * 1024;
  private readonly maxPhotoDimension = 512;
  private readonly photoQuality = 0.82;
  private readonly allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

  getClients(): Observable<Client[]> {
    return this.workspaceService.currentWorkspace$.pipe(
      switchMap((workspace) => {
        if (!workspace?.id) return of([]);
        const clientsRef = collection(this.firestore, 'clients');
        const clientsQuery = query(clientsRef, where('workspaceId', '==', workspace.id));
        return collectionData(clientsQuery, { idField: 'id' }) as Observable<Client[]>;
      }),
    );
  }

  createClient(client: Omit<Client, 'workspaceId'>) {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) throw new Error('No workspace selected.');
    const clientsRef = collection(this.firestore, 'clients');
    const cleanClient = Object.fromEntries(
      Object.entries(client).filter(([, value]) => value !== undefined),
    );
    return addDoc(clientsRef, {
      ...cleanClient,
      workspaceId: workspace.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  updateClient(id: string, client: Partial<Client>) {
    const cleanClient = Object.fromEntries(
      Object.entries(client).filter(([, value]) => value !== undefined),
    );
    const clientRef = doc(this.firestore, `clients/${id}`);
    return updateDoc(clientRef, {
      ...cleanClient,
      updatedAt: serverTimestamp(),
    });
  }

  async uploadClientPhoto(
    clientId: string,
    file: File,
  ): Promise<{ photoURL: string; photoPath: string }> {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) throw new Error('No workspace selected.');
    this.validatePhoto(file);
    const optimizedPhoto = await this.optimizePhoto(file);
    const photoPath = `workspaces/${workspace.id}/clients/${clientId}/profile/client-profile.webp`;
    const photoRef = ref(this.storage, photoPath);
    await uploadBytes(photoRef, optimizedPhoto, { contentType: 'image/webp' });
    const photoURL = await getDownloadURL(photoRef);
    await this.updateClient(clientId, { photoURL, photoPath });
    return { photoURL, photoPath };
  }

  async removeClientPhoto(clientId: string, photoPath?: string): Promise<void> {
    if (photoPath) {
      try {
        await deleteObject(ref(this.storage, photoPath));
      } catch (error: any) {
        if (error?.code !== 'storage/object-not-found') throw error;
      }
    }
    await this.updateClient(clientId, {
      photoURL: '',
      photoPath: '',
    });
  }

  async deleteClient(id: string, photoPath?: string): Promise<void> {
    if (photoPath) {
      try {
        await deleteObject(ref(this.storage, photoPath));
      } catch (error: any) {
        if (error?.code !== 'storage/object-not-found') throw error;
      }
    }
    const clientRef = doc(this.firestore, `clients/${id}`);
    await deleteDoc(clientRef);
  }

  createPhotoPreview(file: File): string {
    return URL.createObjectURL(file);
  }

  revokePhotoPreview(url: string): void {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  private validatePhoto(file: File): void {
    if (!this.allowedPhotoTypes.includes(file.type)) {
      throw new Error('Please select a JPG, PNG, or WebP image.');
    }
    if (file.size > this.maxPhotoSize) {
      throw new Error('Client photo must be 5 MB or smaller.');
    }
  }

  private async optimizePhoto(file: File): Promise<File> {
    const image = await this.loadImage(file);
    const scale = Math.min(1, this.maxPhotoDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to process client photo.');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('Unable to process client photo.')),
        'image/webp',
        this.photoQuality,
      );
    });
    return new File([blob], 'client-profile.webp', { type: 'image/webp' });
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Unable to read client photo.'));
      };
      image.src = url;
    });
  }
}
