import { TaskStatus } from './task.model';

export interface TaskStatusDefinition {
  id?: string;
  workspaceId: string;
  name: string;
  color: string;
  order: number;
  isCompleted: boolean;
  legacyValue?: TaskStatus;
  createdAt?: any;
  updatedAt?: any;
}
