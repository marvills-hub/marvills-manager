import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { ProjectTask, TaskStatus } from '../../core/models/task.model';
import { Project } from '../../core/models/project.model';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  private fb = inject(FormBuilder);
  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private toast = inject(ToastService);

  tasks: ProjectTask[] = [];
  projects: Project[] = [];

  todo: ProjectTask[] = [];
  inProgress: ProjectTask[] = [];
  review: ProjectTask[] = [];
  completed: ProjectTask[] = [];

  showForm = false;
  editingTask: ProjectTask | null = null;

  taskForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    projectId: [''],
    status: ['todo' as TaskStatus],
    priority: ['medium' as ProjectTask['priority']],
    assignee: ['Marvills'],
    dueDate: [''],
  });

  ngOnInit(): void {
    this.taskService.getTasks().subscribe((tasks) => {
      this.tasks = tasks;
      this.organizeTasks();
    });

    this.projectService.getProjects().subscribe((projects) => {
      this.projects = projects;
    });
  }

  organizeTasks(): void {
    this.todo = this.tasks.filter((task) => task.status === 'todo');

    this.inProgress = this.tasks.filter((task) => task.status === 'in-progress');

    this.review = this.tasks.filter((task) => task.status === 'review');

    this.completed = this.tasks.filter((task) => task.status === 'completed');
  }

  async saveTask(): Promise<void> {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const value = this.taskForm.getRawValue();

    const task: Omit<ProjectTask, 'workspaceId'> = {
      title: value.title,
      description: value.description,

      projectId: value.projectId,

      status: value.status,

      priority: value.priority,

      assignee: value.assignee,
    };

    if (value.dueDate) {
      task.dueDate = new Date(value.dueDate);
    }

    if (this.editingTask?.id) {
      await this.taskService.updateTask(this.editingTask.id, task);

      this.toast.success('Task updated successfully.');
    } else {
      await this.taskService.createTask(task);

      this.toast.success('Task created successfully.');
    }

    this.showForm = false;
    this.editingTask = null;

    this.resetTaskForm();
  }

  async dragEnded(event: CdkDragEnd, task: ProjectTask): Promise<void> {
    const dropX = event.dropPoint.x;

    const columns = Array.from(
      document.querySelectorAll<HTMLElement>('.kanban-column[data-status]'),
    );

    if (!columns.length) {
      event.source.reset();
      return;
    }

    let nearestStatus: TaskStatus = task.status;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const column of columns) {
      const rect = column.getBoundingClientRect();

      let distance = 0;

      if (dropX < rect.left) {
        distance = rect.left - dropX;
      } else if (dropX > rect.right) {
        distance = dropX - rect.right;
      }

      if (distance < nearestDistance) {
        nearestDistance = distance;

        nearestStatus = column.dataset['status'] as TaskStatus;
      }
    }

    event.source.reset();

    if (nearestStatus === task.status) {
      return;
    }

    const previousStatus = task.status;

    task.status = nearestStatus;

    this.organizeTasks();

    if (!task.id) {
      return;
    }

    try {
      await this.taskService.updateTask(task.id, {
        status: nearestStatus,
      });

      this.toast.success(`Task moved to ${this.getStatusLabel(nearestStatus)}.`);
    } catch (error) {
      task.status = previousStatus;

      this.organizeTasks();

      this.toast.error('Unable to update task status.');
    }
  }

  async deleteTask(task: ProjectTask): Promise<void> {
    if (!task.id || !confirm(`Delete "${task.title}"?`)) {
      return;
    }

    await this.taskService.deleteTask(task.id);

    this.toast.success('Task deleted successfully.');
  }

  getProjectName(projectId?: string): string {
    if (!projectId) {
      return 'No Project';
    }

    return this.projects.find((project) => project.id === projectId)?.name || 'Project';
  }

  getStatusLabel(status: TaskStatus): string {
    const labels: Record<TaskStatus, string> = {
      todo: 'To Do',
      'in-progress': 'In Progress',
      review: 'Review',
      completed: 'Completed',
    };

    return labels[status];
  }

  openCreateTask(): void {
    this.editingTask = null;

    this.resetTaskForm();

    this.showForm = true;
  }

  editTask(task: ProjectTask): void {
    this.editingTask = task;

    this.taskForm.patchValue({
      title: task.title,
      description: task.description || '',
      projectId: task.projectId || '',
      status: task.status,
      priority: task.priority,
      assignee: task.assignee || '',
      dueDate: this.formatDate(task.dueDate),
    });

    this.showForm = true;
  }

  private resetTaskForm(): void {
    this.taskForm.reset({
      title: '',
      description: '',
      projectId: '',
      status: 'todo',
      priority: 'medium',
      assignee: 'Marvills',
      dueDate: '',
    });
  }

  private formatDate(value: any): string {
    if (!value) {
      return '';
    }

    const date = value?.toDate ? value.toDate() : new Date(value);

    return date.toISOString().split('T')[0];
  }

  getTaskDueDate(value: any): Date | null {
    if (!value) {
      return null;
    }

    if (value?.toDate) {
      return value.toDate();
    }

    const date = new Date(value);

    return isNaN(date.getTime()) ? null : date;
  }
}
