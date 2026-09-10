import { inject, Injectable } from '@angular/core';
import { deleteObject, getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';

export interface ProjectLogoUpload {
  url: string;
  path: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectLogoService {
  private storage = inject(Storage);
  readonly maxFileSize = 5 * 1024 * 1024;
  readonly allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  validateLogo(file: File): void {
    if (!this.allowedTypes.includes(file.type))
      throw new Error('Project logo must be a JPG, PNG, or WebP image.');
    if (file.size > this.maxFileSize) throw new Error('Project logo must be 5 MB or smaller.');
  }

  async uploadLogo(workspaceId: string, projectId: string, file: File): Promise<ProjectLogoUpload> {
    this.validateLogo(file);
    const optimizedFile = await this.optimizeImage(file);
    const path = `workspaces/${workspaceId}/projects/${projectId}/logo/project-logo.webp`;
    const logoRef = ref(this.storage, path);
    await uploadBytes(logoRef, optimizedFile, {
      contentType: 'image/webp',
      customMetadata: {
        originalName: file.name,
      },
    });
    const url = await getDownloadURL(logoRef);
    return { url, path };
  }

  async deleteLogo(path: string): Promise<void> {
    if (!path) return;
    try {
      await deleteObject(ref(this.storage, path));
    } catch (error) {
      if (!this.isObjectNotFound(error)) throw error;
    }
  }

  createPreview(file: File): string {
    return URL.createObjectURL(file);
  }

  revokePreview(url: string): void {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  private optimizeImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectURL = URL.createObjectURL(file);
      image.onload = () => {
        const maxDimension = 512;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(objectURL);
          reject(new Error('Unable to process project logo.'));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectURL);
            if (!blob) {
              reject(new Error('Unable to optimize project logo.'));
              return;
            }
            resolve(new File([blob], 'project-logo.webp', { type: 'image/webp' }));
          },
          'image/webp',
          0.82,
        );
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectURL);
        reject(new Error('Unable to read project logo.'));
      };
      image.src = objectURL;
    });
  }

  private isObjectNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) return false;
    return (error as { code?: string }).code === 'storage/object-not-found';
  }
}
