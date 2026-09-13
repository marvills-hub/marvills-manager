import { Timestamp } from '@angular/fire/firestore';
export interface TimeEntry {
  id?: string;
  workspaceId: string;
  userId: string;
  projectId: string;
  taskId: string;
  description: string;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  durationSeconds: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
