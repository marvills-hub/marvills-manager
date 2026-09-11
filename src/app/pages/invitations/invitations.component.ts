import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { WorkspaceInvitation } from '../../core/models/workspace-invitation.model';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
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
  private topbarService = inject(TopbarService);
  private toast = inject(ToastService);

  invitations = signal<WorkspaceInvitation[]>([]);
  loading = signal(true);
  processingId = signal<string | null>(null);

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Invitations',
      icon: 'fa-regular fa-envelope-open',
    });
    this.invitationService.getMyInvitations().subscribe({
      next: (invitations) => {
        this.invitations.set(invitations);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Unable to load invitations.');
      },
    });
  }

  async accept(invitation: WorkspaceInvitation): Promise<void> {
    if (!invitation.id || this.processingId()) return;
    this.processingId.set(invitation.id);
    try {
      await this.invitationService.acceptInvitation(invitation);
      this.toast.success(`You joined ${invitation.workspaceName}.`);
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to accept invitation.');
    } finally {
      this.processingId.set(null);
    }
  }

  async decline(invitation: WorkspaceInvitation): Promise<void> {
    if (!invitation.id || this.processingId()) return;
    this.processingId.set(invitation.id);
    try {
      await this.invitationService.declineInvitation(invitation);
      this.toast.success('Invitation declined.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to decline invitation.');
    } finally {
      this.processingId.set(null);
    }
  }

  isProcessing(invitation: WorkspaceInvitation): boolean {
    return this.processingId() === invitation.id;
  }

  getRoleLabel(invitation: WorkspaceInvitation): string {
    const labels = {
      admin: 'Admin',
      manager: 'Manager',
      member: 'Member',
      viewer: 'Viewer',
    };
    return labels[invitation.role];
  }

  getTypeLabel(invitation: WorkspaceInvitation): string {
    const labels = {
      worker: 'Worker',
      client: 'Client',
      contractor: 'Contractor',
      guest: 'Guest',
    };
    return labels[invitation.type || 'worker'];
  }

  getInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}
