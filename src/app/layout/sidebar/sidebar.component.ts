import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Workspace } from '../../core/models/workspace.model';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  workspaceService = inject(WorkspaceService);
  workspaces: Workspace[] = [];
  workspaceMenuOpen = false;

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
}
