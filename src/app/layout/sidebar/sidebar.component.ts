import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Workspace } from '../../core/models/workspace.model';
import { WorkspaceService } from '../../core/services/workspace.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly workspaceService = inject(WorkspaceService);
  readonly permissionService = inject(WorkspacePermissionService);
  workspaces: Workspace[] = [];
  workspaceMenuOpen = false;

  get user() {
    return this.authService.currentUser;
  }

  get displayName(): string {
    return this.user?.displayName?.trim() || 'Marvills User';
  }

  get email(): string {
    return this.user?.email || 'Account';
  }

  get initials(): string {
    const name = this.displayName.trim();
    if (!name) {
      return 'MU';
    }
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  get workspaceRole(): string {
    const role = this.permissionService.role();
    if (!role) {
      return 'Workspace Member';
    }
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  ngOnInit(): void {
    this.workspaceService.getWorkspaces().subscribe((workspaces) => {
      this.workspaces = workspaces;
      if (!this.workspaceService.currentWorkspace()) {
        this.workspaceService.restoreWorkspace(workspaces);
      }
    });
  }

  toggleWorkspaceMenu(): void {
    this.workspaceMenuOpen = !this.workspaceMenuOpen;
  }

  selectWorkspace(workspace: Workspace): void {
    this.workspaceService.selectWorkspace(workspace);
    this.workspaceMenuOpen = false;
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }

  get photoURL(): string {
    return this.user?.photoURL || '';
  }
}
