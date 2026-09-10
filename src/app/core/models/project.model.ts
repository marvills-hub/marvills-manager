import { Attachment } from './attachment.model';

export type ProjectStatus = 'planning' | 'in-progress' | 'on-hold' | 'completed';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id?: string;
  workspaceId: string;
  name: string;
  description?: string;
  clientName?: string;
  logoURL?: string;
  logoPath?: string;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  startDate?: Date;
  dueDate?: Date;
  attachments?: Attachment[];
  createdAt?: any;
  updatedAt?: any;
}
