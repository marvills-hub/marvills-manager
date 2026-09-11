import { WorkspaceRole, WorkspaceUserType } from './workspace-member.model';

export type WorkspaceUserSource = 'member' | 'client' | 'invitation';
export type WorkspaceUserStatus = 'active' | 'invited' | 'inactive';

export interface WorkspaceUser {
  id: string;
  source: WorkspaceUserSource;
  workspaceId: string;
  userId?: string;
  memberId?: string;
  clientId?: string;
  invitationId?: string;
  displayName: string;
  email: string;
  phone?: string;
  company?: string;
  photoURL?: string;
  photoPath?: string;
  jobTitle?: string;
  role: WorkspaceRole;
  type: WorkspaceUserType;
  status: WorkspaceUserStatus;
}
