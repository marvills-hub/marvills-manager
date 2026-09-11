import { inject, Injectable } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { WorkspaceUser } from '../models/workspace-user.model';
import { ClientService } from './client.service';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceInvitationService } from './workspace-invitaion.service';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceUserService {
  private memberService = inject(WorkspaceMemberService);
  private clientService = inject(ClientService);
  private invitationService = inject(WorkspaceInvitationService);

  getUsers(): Observable<WorkspaceUser[]> {
    return combineLatest([
      this.memberService.getMembersWithProfiles(),
      this.clientService.getClients(),
      this.invitationService.getWorkspaceInvitations(),
    ]).pipe(
      map(([members, clients, invitations]) => {
        const memberUsers: WorkspaceUser[] = members.map((member) => ({
          id: `member_${member.id || member.userId || member.email}`,
          source: 'member',
          workspaceId: member.workspaceId,
          userId: member.userId,
          memberId: member.id,
          clientId: member.clientId,
          displayName: member.displayName || member.email,
          email: member.email,
          photoURL: member.photoURL || '',
          jobTitle: member.jobTitle || '',
          role: member.role,
          type: member.type || 'worker',
          status: member.status || 'active',
        }));
        const linkedClientIds = new Set(
          members
            .map((member) => member.clientId)
            .filter((clientId): clientId is string => !!clientId),
        );
        const clientUsers: WorkspaceUser[] = clients
          .filter((client) => !!client.id && !linkedClientIds.has(client.id))
          .map((client) => ({
            id: `client_${client.id}`,
            source: 'client',
            workspaceId: client.workspaceId,
            clientId: client.id,
            displayName: client.name,
            email: client.email || '',
            phone: client.phone || '',
            company: client.company || '',
            photoURL: client.photoURL || '',
            photoPath: client.photoPath || '',
            role: 'viewer',
            type: 'client',
            status: 'active',
          }));
        const memberEmails = new Set(members.map((member) => member.email.trim().toLowerCase()));
        const invitationUsers: WorkspaceUser[] = invitations
          .filter((invitation) => !memberEmails.has(invitation.email.trim().toLowerCase()))
          .map((invitation) => ({
            id: `invitation_${invitation.id || invitation.email}`,
            source: 'invitation',
            workspaceId: invitation.workspaceId,
            invitationId: invitation.id,
            displayName: invitation.email,
            email: invitation.email,
            role: invitation.role,
            type: invitation.type || 'worker',
            status: 'invited',
          }));
        return [...memberUsers, ...clientUsers, ...invitationUsers].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        );
      }),
    );
  }
}
