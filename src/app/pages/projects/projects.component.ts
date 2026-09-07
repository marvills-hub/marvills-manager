import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Project } from '../../core/models/project.model';
import { ProjectService } from '../../core/services/project.service';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private toast = inject(ToastService);
  projects: Project[] = [];
  showForm = false;
  editingProject: Project | null = null;
  searchQuery = '';

  projectForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    clientName: [''],
    description: [''],
    status: ['planning' as Project['status']],
    priority: ['medium' as Project['priority']],
    progress: [0],
    startDate: [''],
    dueDate: [''],
  });

  ngOnInit(): void {
    this.projectService.getProjects().subscribe((projects) => (this.projects = projects));
  }

  openCreateForm(): void {
    this.editingProject = null;

    this.projectForm.reset({
      name: '',
      clientName: '',
      description: '',
      status: 'planning',
      priority: 'medium',
      progress: 0,
      startDate: '',
      dueDate: '',
    });

    this.showForm = true;
  }

  editProject(project: Project): void {
    this.editingProject = project;

    this.projectForm.patchValue({
      name: project.name,
      clientName: project.clientName || '',
      description: project.description || '',
      status: project.status,
      priority: project.priority,
      progress: project.progress || 0,
      startDate: this.formatDate(project.startDate),
      dueDate: this.formatDate(project.dueDate),
    });

    this.showForm = true;
  }

  async saveProject(): Promise<void> {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const value = this.projectForm.getRawValue();

    const project: Omit<Project, 'workspaceId'> = {
      name: value.name,
      clientName: value.clientName,
      description: value.description,
      status: value.status,
      priority: value.priority,
      progress: Number(value.progress),
    };

    if (value.startDate) {
      project.startDate = new Date(value.startDate);
    }

    if (value.dueDate) {
      project.dueDate = new Date(value.dueDate);
    }

    if (this.editingProject?.id) {
      await this.projectService.updateProject(this.editingProject.id, project);
    } else {
      await this.projectService.createProject(project);
    }

    this.closeForm();
  }

  async removeProject(project: Project): Promise<void> {
    if (!project.id || !confirm(`Delete "${project.name}"?`)) {
      return;
    }

    await this.projectService.deleteProject(project.id);
    this.toast.success('Project deleted successfully.');
  }

  closeForm(): void {
    this.showForm = false;
    this.editingProject = null;
  }

  private formatDate(value: any): string {
    if (!value) {
      return '';
    }

    const date = value?.toDate ? value.toDate() : new Date(value);

    return date.toISOString().split('T')[0];
  }

  get filteredProjects(): Project[] {
    const query = this.searchQuery.trim().toLowerCase();

    if (!query) {
      return this.projects;
    }

    return this.projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.clientName?.toLowerCase().includes(query) ||
        project.status.toLowerCase().includes(query) ||
        project.priority.toLowerCase().includes(query),
    );
  }

  searchProjects(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.searchQuery = input.value;
  }
}
