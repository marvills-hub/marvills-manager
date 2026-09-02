import { Priority } from './project.model';

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'completed';

export interface ProjectTask {
  id?: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: string;
  dueDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
