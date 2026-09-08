import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { deleteObject, getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';
import { Attachment } from '../models/attachment.model';

export type AttachmentEntityType = 'projects' | 'tasks';

export interface PreparedAttachmentFile {
  file: File;
  originalName: string;
  originalSize: number;
  optimized: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AttachmentService {
  private storage = inject(Storage);
  private auth = inject(Auth);

  readonly maxFileSize = 10 * 1024 * 1024;

  readonly maxFiles = 10;

  readonly maxImageDimension = 1920;

  readonly imageQuality = 0.82;

  async uploadFiles(
    workspaceId: string,
    entityType: AttachmentEntityType,
    entityId: string,
    files: File[],
    existingAttachmentCount = 0,
  ): Promise<Attachment[]> {
    this.validateFileCount(files.length, existingAttachmentCount);

    const attachments: Attachment[] = [];

    for (const originalFile of files) {
      const prepared = await this.prepareFile(originalFile);

      const file = prepared.file;

      this.validateFileSize(file);

      const id = crypto.randomUUID();

      const safeFileName = this.createSafeFileName(file.name);

      const storagePath = [
        'workspaces',
        workspaceId,
        entityType,
        entityId,
        'attachments',
        `${id}-${safeFileName}`,
      ].join('/');

      const storageReference = ref(this.storage, storagePath);

      await uploadBytes(storageReference, file, {
        contentType: file.type || 'application/octet-stream',
      });

      const url = await getDownloadURL(storageReference);

      attachments.push({
        id,
        name: file.name,
        url,
        storagePath,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedBy: this.auth.currentUser?.uid,
        uploadedAt: new Date(),
      });
    }

    return attachments;
  }

  async prepareFile(file: File): Promise<PreparedAttachmentFile> {
    const originalSize = file.size;

    if (!this.canOptimizeImage(file)) {
      this.validateFileSize(file);

      return {
        file,
        originalName: file.name,
        originalSize,
        optimized: false,
      };
    }

    try {
      const optimizedFile = await this.optimizeImage(file);

      if (optimizedFile.size >= file.size) {
        this.validateFileSize(file);

        return {
          file,
          originalName: file.name,
          originalSize,
          optimized: false,
        };
      }

      this.validateFileSize(optimizedFile);

      return {
        file: optimizedFile,
        originalName: file.name,
        originalSize,
        optimized: true,
      };
    } catch (error) {
      console.warn(`Unable to optimize ${file.name}. Using original file.`, error);

      this.validateFileSize(file);

      return {
        file,
        originalName: file.name,
        originalSize,
        optimized: false,
      };
    }
  }

  validateFileCount(selectedFileCount: number, existingAttachmentCount = 0): void {
    const total = selectedFileCount + existingAttachmentCount;

    if (total > this.maxFiles) {
      throw new Error(`A maximum of ${this.maxFiles} attachments is allowed per project or task.`);
    }
  }

  validateFileSize(file: File): void {
    if (file.size > this.maxFileSize) {
      throw new Error(
        `"${file.name}" exceeds the ${this.formatFileSize(this.maxFileSize)} attachment limit.`,
      );
    }
  }

  canOptimizeImage(file: File): boolean {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  }

  async deleteAttachment(attachment: Attachment): Promise<void> {
    const storageReference = ref(this.storage, attachment.storagePath);

    await deleteObject(storageReference);
  }

  formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  getFileIcon(attachment: Attachment): string {
    const type = attachment.type.toLowerCase();

    const name = attachment.name.toLowerCase();

    if (type.startsWith('image/')) {
      return 'fa-regular fa-image';
    }

    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return 'fa-regular fa-file-pdf';
    }

    if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
      return 'fa-regular fa-file-word';
    }

    if (
      type.includes('excel') ||
      type.includes('spreadsheet') ||
      name.endsWith('.xls') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.csv')
    ) {
      return 'fa-regular fa-file-excel';
    }

    if (
      type.includes('zip') ||
      name.endsWith('.zip') ||
      name.endsWith('.rar') ||
      name.endsWith('.7z')
    ) {
      return 'fa-regular fa-file-zipper';
    }

    if (type.startsWith('video/')) {
      return 'fa-regular fa-file-video';
    }

    if (type.startsWith('audio/')) {
      return 'fa-regular fa-file-audio';
    }

    if (
      name.endsWith('.html') ||
      name.endsWith('.css') ||
      name.endsWith('.scss') ||
      name.endsWith('.js') ||
      name.endsWith('.ts') ||
      name.endsWith('.json')
    ) {
      return 'fa-regular fa-file-code';
    }

    return 'fa-regular fa-file';
  }

  private async optimizeImage(file: File): Promise<File> {
    const image = await this.loadImage(file);

    const dimensions = this.calculateImageDimensions(image.width, image.height);

    const canvas = document.createElement('canvas');

    canvas.width = dimensions.width;

    canvas.height = dimensions.height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to create image canvas.');
    }

    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    const blob = await this.canvasToBlob(canvas, 'image/webp', this.imageQuality);

    const optimizedName = this.createOptimizedImageName(file.name);

    return new File([blob], optimizedName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);

        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);

        reject(new Error(`Unable to read image "${file.name}".`));
      };

      image.src = objectUrl;
    });
  }

  private calculateImageDimensions(
    width: number,
    height: number,
  ): {
    width: number;
    height: number;
  } {
    if (width <= this.maxImageDimension && height <= this.maxImageDimension) {
      return {
        width,
        height,
      };
    }

    const scale = Math.min(this.maxImageDimension / width, this.maxImageDimension / height);

    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Unable to optimize image.'));

            return;
          }

          resolve(blob);
        },
        type,
        quality,
      );
    });
  }

  private createOptimizedImageName(name: string): string {
    const lastDot = name.lastIndexOf('.');

    const baseName = lastDot > 0 ? name.substring(0, lastDot) : name;

    return `${baseName}.webp`;
  }

  private createSafeFileName(name: string): string {
    return name
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-');
  }
}
