import { Priority } from './project.model';

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'completed';

export interface ProjectTask {
  id?: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: string;
  dueDate?: Date;
  createdAt?: any;
  updatedAt?: any;
}
