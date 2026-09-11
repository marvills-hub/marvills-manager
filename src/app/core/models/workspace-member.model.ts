export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
export type WorkspaceUserType = 'worker' | 'client' | 'contractor' | 'guest';
export type WorkspaceMemberStatus = 'active' | 'invited' | 'inactive';

export interface WorkspaceMember {
  id?: string;
  workspaceId: string;
  userId?: string;
  clientId?: string;
  email: string;
  displayName?: string;
  role: WorkspaceRole;
  type: WorkspaceUserType;
  status: WorkspaceMemberStatus;
  createdAt?: any;
  updatedAt?: any;
}
