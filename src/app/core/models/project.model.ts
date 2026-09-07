export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id?: string;
  workspaceId: string;
  name: string;
  description?: string;
  clientName?: string;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  startDate?: Date;
  dueDate?: Date;
  createdAt?: any;
  updatedAt?: any;
}
