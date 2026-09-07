import { WorkspaceRole } from './workspace-member.model';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface WorkspaceInvitation {
  id?: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  status: InvitationStatus;
  invitedBy: string;
  invitedByEmail?: string;
  acceptedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
