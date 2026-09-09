import { Attachment } from './attachment.model';
import { Priority } from './project.model';

export type TaskStatus = string;

export interface ProjectTask {
  id?: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: Date;
  order?: number;
  attachments?: Attachment[];
  createdAt?: any;
  updatedAt?: any;
}
