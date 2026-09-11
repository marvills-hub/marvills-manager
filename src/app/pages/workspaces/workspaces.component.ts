import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Workspace } from '../../core/models/workspace.model';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspaceService } from '../../core/services/workspace.service';

type WorkspaceFilter = 'all' | 'owned' | 'member';
type WorkspaceSort = 'name' | 'newest' | 'oldest';

@Component({
  selector: 'app-workspaces',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workspaces.component.html',
  styleUrl: './workspaces.component.scss',
})
export class WorkspacesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private topbarService = inject(TopbarService);
  readonly workspaceService = inject(WorkspaceService);

  workspaces: Workspace[] = [];
  searchTerm = '';
  workspaceFilter: WorkspaceFilter = 'all';
  workspaceSort: WorkspaceSort = 'name';
  showForm = false;
  saving = false;
  editingWorkspace: Workspace | null = null;
  deletingWorkspace: Workspace | null = null;
  deleting = false;

  workspaceForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  get filteredWorkspaces(): Workspace[] {
    const search = this.searchTerm.trim().toLowerCase();
    const filtered = this.workspaces.filter((workspace) => {
      const matchesSearch =
        !search ||
        workspace.name.toLowerCase().includes(search) ||
        (workspace.description ?? '').toLowerCase().includes(search);
      const matchesAccess =
        this.workspaceFilter === 'all' ||
        (this.workspaceFilter === 'owned' && this.isWorkspaceOwner(workspace)) ||
        (this.workspaceFilter === 'member' && !this.isWorkspaceOwner(workspace));
      return matchesSearch && matchesAccess;
    });
    return [...filtered].sort((a, b) => {
      if (this.workspaceSort === 'newest')
        return this.getWorkspaceTime(b) - this.getWorkspaceTime(a);
      if (this.workspaceSort === 'oldest')
        return this.getWorkspaceTime(a) - this.getWorkspaceTime(b);
      return a.name.localeCompare(b.name);
    });
  }

  get ownedWorkspaceCount(): number {
    return this.workspaces.filter((workspace) => this.isWorkspaceOwner(workspace)).length;
  }

  get memberWorkspaceCount(): number {
    return this.workspaces.length - this.ownedWorkspaceCount;
  }

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Workspaces',
      icon: 'fa-solid fa-layer-group',
    });
    this.workspaceService.getWorkspaces().subscribe({
      next: (workspaces) => {
        this.workspaces = workspaces;
        if (!this.workspaceService.currentWorkspace()) {
          this.workspaceService.restoreWorkspace(workspaces);
        }
      },
      error: () => {
        this.toast.error('Unable to load workspaces.');
      },
    });
  }

  updateSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
  }

  setWorkspaceFilter(filter: WorkspaceFilter): void {
    this.workspaceFilter = filter;
  }

  updateSort(event: Event): void {
    this.workspaceSort = (event.target as HTMLSelectElement).value as WorkspaceSort;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.workspaceFilter = 'all';
    this.workspaceSort = 'name';
  }

  openCreateForm(): void {
    if (this.saving) return;
    this.editingWorkspace = null;
    this.workspaceForm.reset({
      name: '',
      description: '',
    });
    this.showForm = true;
  }

  openEditForm(workspace: Workspace): void {
    if (!this.isWorkspaceOwner(workspace) || this.saving) return;
    this.editingWorkspace = workspace;
    this.workspaceForm.reset({
      name: workspace.name,
      description: workspace.description ?? '',
    });
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.showForm = false;
    this.editingWorkspace = null;
  }

  selectWorkspace(workspace: Workspace): void {
    if (this.workspaceService.currentWorkspace()?.id === workspace.id) return;
    this.workspaceService.selectWorkspace(workspace);
    this.toast.success(`Switched to ${workspace.name}.`);
  }

  isWorkspaceOwner(workspace: Workspace): boolean {
    const user = this.authService.currentUser;
    return !!user && workspace.ownerId === user.uid;
  }

  getWorkspaceAccessLabel(workspace: Workspace): string {
    return this.isWorkspaceOwner(workspace) ? 'Owner' : 'Member';
  }

  openDeleteWorkspace(workspace: Workspace): void {
    if (!this.isWorkspaceOwner(workspace) || !workspace.id) return;
    this.deletingWorkspace = workspace;
  }

  closeDeleteWorkspace(): void {
    if (this.deleting) return;
    this.deletingWorkspace = null;
  }

  async saveWorkspace(): Promise<void> {
    if (this.workspaceForm.invalid || this.saving) {
      this.workspaceForm.markAllAsTouched();
      return;
    }
    const value = this.workspaceForm.getRawValue();
    const name = value.name.trim();
    const description = value.description.trim();
    if (!name) {
      this.workspaceForm.controls.name.setErrors({ required: true });
      this.workspaceForm.controls.name.markAsTouched();
      return;
    }
    this.saving = true;
    try {
      if (this.editingWorkspace?.id) {
        await this.workspaceService.updateWorkspace(this.editingWorkspace.id, {
          name,
          description,
        });
        this.workspaces = this.workspaces.map((workspace) =>
          workspace.id === this.editingWorkspace?.id
            ? { ...workspace, name, description }
            : workspace,
        );
        this.toast.success('Workspace updated successfully.');
      } else {
        const user = this.authService.currentUser;
        if (!user) throw new Error('You must be signed in to create a workspace.');
        const document = await this.workspaceService.createWorkspace(name, description);
        this.workspaceService.selectWorkspace({
          id: document.id,
          name,
          description,
          ownerId: user.uid,
          taskStatusesInitialized: false,
        });
        this.toast.success('Workspace created successfully.');
      }
      this.showForm = false;
      this.editingWorkspace = null;
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to save workspace.');
    } finally {
      this.saving = false;
    }
  }

  async confirmDeleteWorkspace(): Promise<void> {
    const workspace = this.deletingWorkspace;
    if (!workspace?.id || !this.isWorkspaceOwner(workspace) || this.deleting) return;
    this.deleting = true;
    try {
      await this.workspaceService.deleteWorkspace(workspace.id);
      const remaining = this.workspaces.filter((item) => item.id !== workspace.id);
      this.workspaces = remaining;
      if (!this.workspaceService.currentWorkspace() && remaining.length) {
        this.workspaceService.selectWorkspace(remaining[0]);
      }
      this.deletingWorkspace = null;
      this.toast.success('Workspace deleted.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to delete workspace.');
    } finally {
      this.deleting = false;
    }
  }

  private getWorkspaceTime(workspace: Workspace): number {
    const value = workspace.createdAt;
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return new Date(value).getTime() || 0;
  }
}
