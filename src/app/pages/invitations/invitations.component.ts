import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceInvitation } from '../../core/models/workspace-invitation.model';
import { ToastService } from '../../core/services/toast.service';
import { WorkspaceInvitationService } from '../../core/services/workspace-invitaion.service';

@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invitations.component.html',
  styleUrl: './invitations.component.scss',
})
export class InvitationsComponent implements OnInit {
  private invitationService = inject(WorkspaceInvitationService);

  private toast = inject(ToastService);

  invitations: WorkspaceInvitation[] = [];

  processingId: string | null = null;

  ngOnInit(): void {
    this.invitationService.getMyInvitations().subscribe((invitations) => {
      this.invitations = invitations;
    });
  }

  async accept(invitation: WorkspaceInvitation): Promise<void> {
    if (!invitation.id || this.processingId) {
      return;
    }

    this.processingId = invitation.id;

    try {
      await this.invitationService.acceptInvitation(invitation);

      this.toast.success(`You joined ${invitation.workspaceName}.`);
    } catch (error) {
      console.error(error);

      const message = error instanceof Error ? error.message : 'Unable to accept invitation.';

      this.toast.error(message);
    } finally {
      this.processingId = null;
    }
  }

  async decline(invitation: WorkspaceInvitation): Promise<void> {
    if (!invitation.id || this.processingId) {
      return;
    }

    this.processingId = invitation.id;

    try {
      await this.invitationService.declineInvitation(invitation);

      this.toast.success('Invitation declined.');
    } catch (error) {
      console.error(error);

      this.toast.error('Unable to decline invitation.');
    } finally {
      this.processingId = null;
    }
  }
}
