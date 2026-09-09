import { WorkspaceMember } from './workspace-member.model';
export interface WorkspaceMemberProfile extends WorkspaceMember {
  photoURL?: string;
  jobTitle?: string;
}
