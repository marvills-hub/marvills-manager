export interface Client {
  id?: string;
  workspaceId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  photoPath?: string;
  createdAt?: any;
  updatedAt?: any;
}
