import { Component, EventEmitter, inject, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly topbarService = inject(TopbarService);
  readonly permissionService = inject(WorkspacePermissionService);

  @Output() menuToggle = new EventEmitter<void>();

  get user() {
    return this.authService.currentUser;
  }

  get displayName(): string {
    return this.user?.displayName?.trim() || 'Marvills User';
  }

  get initials(): string {
    const name = this.displayName.trim();
    if (!name) return 'MU';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  get workspaceRole(): string {
    const role = this.permissionService.role();
    if (!role) return 'Workspace Member';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  get photoURL(): string {
    return this.user?.photoURL || '';
  }
}
