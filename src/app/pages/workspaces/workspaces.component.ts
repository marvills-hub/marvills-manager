import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Workspace } from '../../core/models/workspace.model';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-workspaces',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workspaces.component.html',
  styleUrl: './workspaces.component.scss',
})
export class WorkspacesComponent implements OnInit {
  private fb = inject(FormBuilder);

  workspaceService = inject(WorkspaceService);

  private toast = inject(ToastService);

  workspaces: Workspace[] = [];

  showForm = false;

  saving = false;

  workspaceForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.workspaceService.getWorkspaces().subscribe((workspaces) => {
      this.workspaces = workspaces;

      if (!this.workspaceService.currentWorkspace()) {
        this.workspaceService.restoreWorkspace(workspaces);
      }
    });
  }

  openCreateForm(): void {
    this.workspaceForm.reset({
      name: '',
      description: '',
    });

    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
  }

  selectWorkspace(workspace: Workspace): void {
    this.workspaceService.selectWorkspace(workspace);

    this.toast.success(`Switched to ${workspace.name}.`);
  }

  async createWorkspace(): Promise<void> {
    if (this.workspaceForm.invalid) {
      this.workspaceForm.markAllAsTouched();

      return;
    }

    this.saving = true;

    try {
      const value = this.workspaceForm.getRawValue();

      const document = await this.workspaceService.createWorkspace(
        value.name.trim(),
        value.description.trim(),
      );

      this.toast.success('Workspace created successfully.');

      this.workspaceService.selectWorkspace({
        id: document.id,
        name: value.name.trim(),
        description: value.description.trim(),
        ownerId: '',
      });

      this.closeForm();
    } catch (error) {
      console.error(error);

      this.toast.error('Unable to create workspace.');
    } finally {
      this.saving = false;
    }
  }
}
