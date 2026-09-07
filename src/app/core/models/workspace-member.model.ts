export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceMember {
  id?: string;
  workspaceId: string;
  userId: string;
  email: string;
  displayName?: string;
  role: WorkspaceRole;
  status: 'active';
  createdAt?: any;
  updatedAt?: any;
}
