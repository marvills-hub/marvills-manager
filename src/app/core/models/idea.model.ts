export type IdeaStatus = 'idea' | 'evaluating' | 'planned' | 'converted' | 'archived';
export type IdeaPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Idea {
  id?: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: IdeaStatus;
  priority: IdeaPriority;
  category?: string;
  tags: string[];
  notes?: string;
  targetDate?: Date | null;
  boardNoteId?: string | null;
  convertedProjectId?: string | null;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}
