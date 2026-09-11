import { WorkspaceRole, WorkspaceUserType } from './workspace-member.model';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface WorkspaceInvitation {
  id?: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  type: WorkspaceUserType;
  status: InvitationStatus;
  invitedBy: string;
  invitedByEmail?: string;
  acceptedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
