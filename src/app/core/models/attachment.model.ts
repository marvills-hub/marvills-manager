export interface Attachment {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  size: number;
  type: string;
  uploadedBy?: string;
  uploadedAt?: Date;
}
