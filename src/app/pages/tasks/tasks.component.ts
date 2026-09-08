import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProjectTask, TaskStatus } from '../../core/models/task.model';
import { Project } from '../../core/models/project.model';
import { Attachment } from '../../core/models/attachment.model';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { AttachmentService } from '../../core/services/attachment.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmationDialogComponent } from '../../shared/confirmation-dialog/confirmation-dialog.component';

type TaskConfirmationAction =
  | 'remove-attachment'
  | 'save-attachment-changes'
  | 'delete-task'
  | null;

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule, ConfirmationDialogComponent],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  private fb = inject(FormBuilder);
  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private attachmentService = inject(AttachmentService);
  private workspaceService = inject(WorkspaceService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  tasks: ProjectTask[] = [];
  projects: Project[] = [];

  todo: ProjectTask[] = [];
  inProgress: ProjectTask[] = [];
  review: ProjectTask[] = [];
  completed: ProjectTask[] = [];

  showForm = false;
  editingTask: ProjectTask | null = null;

  selectedFiles: File[] = [];
  pendingAttachmentDeletions: Attachment[] = [];
  isDraggingFiles = false;
  saving = false;
  deletingTask = false;

  confirmationAction: TaskConfirmationAction = null;
  attachmentPendingRemoval: Attachment | null = null;
  taskPendingDeletion: ProjectTask | null = null;

  attachmentGalleryTask: ProjectTask | null = null;
  previewAttachment: Attachment | null = null;

  readonly maxAttachments = this.attachmentService.maxFiles;
  readonly maxFileSize = this.attachmentService.maxFileSize;

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

  openCreateTask(): void {
    this.editingTask = null;
    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();
    this.resetTaskForm();
    this.showForm = true;
  }

  editTask(task: ProjectTask): void {
    this.editingTask = {
      ...task,
      attachments: [...(task.attachments ?? [])],
    };

    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();

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

  closeForm(): void {
    if (this.saving) {
      return;
    }

    this.showForm = false;
    this.editingTask = null;
    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();
    this.resetTaskForm();
  }

  saveTask(): void {
    if (this.taskForm.invalid || this.saving) {
      this.taskForm.markAllAsTouched();
      return;
    }

    if (this.pendingAttachmentDeletions.length) {
      this.confirmationAction = 'save-attachment-changes';
      return;
    }

    void this.performSave();
  }

  confirmSaveAttachmentChanges(): void {
    this.resetConfirmation();
    void this.performSave();
  }

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.saving || this.remainingAttachmentSlots <= 0) {
      return;
    }

    this.isDraggingFiles = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.saving || this.remainingAttachmentSlots <= 0) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }

      return;
    }

    this.isDraggingFiles = true;

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as Node | null;

    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    this.isDraggingFiles = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingFiles = false;

    if (this.saving || this.remainingAttachmentSlots <= 0 || !event.dataTransfer?.files.length) {
      return;
    }

    this.addFiles(Array.from(event.dataTransfer.files));
    event.dataTransfer.clearData();
  }

  removeSelectedFile(index: number): void {
    if (this.saving) {
      return;
    }

    this.selectedFiles.splice(index, 1);
  }

  requestRemoveExistingAttachment(attachment: Attachment): void {
    if (this.saving) {
      return;
    }

    this.attachmentPendingRemoval = attachment;
    this.confirmationAction = 'remove-attachment';
  }

  confirmRemoveExistingAttachment(): void {
    const attachment = this.attachmentPendingRemoval;

    if (!attachment || !this.editingTask) {
      this.resetConfirmation();
      return;
    }

    const exists = this.pendingAttachmentDeletions.some((item) => item.id === attachment.id);

    if (!exists) {
      this.pendingAttachmentDeletions.push(attachment);
    }

    this.editingTask = {
      ...this.editingTask,
      attachments: (this.editingTask.attachments ?? []).filter((item) => item.id !== attachment.id),
    };

    this.resetConfirmation();
  }

  requestDeleteTask(task: ProjectTask): void {
    if (!task.id || this.deletingTask) {
      return;
    }

    this.taskPendingDeletion = task;
    this.confirmationAction = 'delete-task';
  }

  async confirmDeleteTask(): Promise<void> {
    const task = this.taskPendingDeletion;

    if (!task?.id || this.deletingTask) {
      return;
    }

    this.deletingTask = true;

    try {
      for (const attachment of task.attachments ?? []) {
        try {
          await this.attachmentService.deleteAttachment(attachment);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error)) {
            throw error;
          }
        }
      }

      await this.taskService.deleteTask(task.id);

      this.toast.success('Task and its attachments deleted successfully.');
      this.resetConfirmation();
    } catch (error) {
      console.error('Unable to delete task:', error);
      this.toast.error('Unable to delete the task completely. Please try again.');
    } finally {
      this.deletingTask = false;
    }
  }

  cancelConfirmation(): void {
    if (this.saving || this.deletingTask) {
      return;
    }

    this.resetConfirmation();
  }

  openTaskAttachments(task: ProjectTask, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!task.attachments?.length) {
      return;
    }

    this.attachmentGalleryTask = task;
    this.previewAttachment = null;
  }

  closeTaskAttachments(): void {
    this.attachmentGalleryTask = null;
    this.previewAttachment = null;
  }

  openAttachmentPreview(attachment: Attachment): void {
    this.previewAttachment = attachment;
  }

  closeAttachmentPreview(): void {
    this.previewAttachment = null;
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
    } catch {
      task.status = previousStatus;
      this.organizeTasks();
      this.toast.error('Unable to update task status.');
    }
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

  formatFileSize(size: number): string {
    return this.attachmentService.formatFileSize(size);
  }

  getFileIcon(attachment: Attachment): string {
    return this.attachmentService.getFileIcon(attachment);
  }

  isImage(attachment: Attachment): boolean {
    return attachment.type?.startsWith('image/') ?? false;
  }

  isPdf(attachment: Attachment): boolean {
    return attachment.type === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf');
  }

  isVideo(attachment: Attachment): boolean {
    return attachment.type?.startsWith('video/') ?? false;
  }

  isAudio(attachment: Attachment): boolean {
    return attachment.type?.startsWith('audio/') ?? false;
  }

  isText(attachment: Attachment): boolean {
    const type = attachment.type?.toLowerCase() ?? '';
    const name = attachment.name.toLowerCase();

    return (
      type.startsWith('text/') ||
      type.includes('json') ||
      type.includes('javascript') ||
      type.includes('typescript') ||
      type.includes('xml') ||
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.json') ||
      name.endsWith('.html') ||
      name.endsWith('.css') ||
      name.endsWith('.scss') ||
      name.endsWith('.js') ||
      name.endsWith('.ts')
    );
  }

  getSafeResourceUrl(attachment: Attachment): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(attachment.url);
  }

  getFileTypeLabel(attachment: Attachment): string {
    const parts = attachment.name.split('.');

    if (parts.length > 1) {
      return parts.pop()?.toUpperCase() || 'FILE';
    }

    return 'FILE';
  }

  get existingAttachmentCount(): number {
    return this.editingTask?.attachments?.length ?? 0;
  }

  get totalAttachmentCount(): number {
    return this.existingAttachmentCount + this.selectedFiles.length;
  }

  get remainingAttachmentSlots(): number {
    return Math.max(0, this.maxAttachments - this.totalAttachmentCount);
  }

  get hasPendingAttachmentDeletions(): boolean {
    return this.pendingAttachmentDeletions.length > 0;
  }

  get pendingAttachmentDeletionCount(): number {
    return this.pendingAttachmentDeletions.length;
  }

  get removeAttachmentDialogOpen(): boolean {
    return this.confirmationAction === 'remove-attachment';
  }

  get saveAttachmentChangesDialogOpen(): boolean {
    return this.confirmationAction === 'save-attachment-changes';
  }

  get deleteTaskDialogOpen(): boolean {
    return this.confirmationAction === 'delete-task';
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

  private addFiles(incomingFiles: File[]): void {
    if (this.saving || !incomingFiles.length) {
      return;
    }

    const availableSlots =
      this.maxAttachments - this.existingAttachmentCount - this.selectedFiles.length;

    if (availableSlots <= 0) {
      this.toast.error(`A task can have a maximum of ${this.maxAttachments} attachments.`);

      return;
    }

    let addedCount = 0;
    let duplicateCount = 0;
    let oversizedCount = 0;

    for (const file of incomingFiles) {
      if (addedCount >= availableSlots) {
        break;
      }

      const duplicate = this.selectedFiles.some(
        (selected) =>
          selected.name === file.name &&
          selected.size === file.size &&
          selected.lastModified === file.lastModified,
      );

      if (duplicate) {
        duplicateCount++;
        continue;
      }

      if (file.size > this.maxFileSize && !this.attachmentService.canOptimizeImage(file)) {
        oversizedCount++;

        this.toast.error(
          `"${file.name}" exceeds the ${this.formatFileSize(this.maxFileSize)} limit.`,
        );

        continue;
      }

      this.selectedFiles.push(file);
      addedCount++;
    }

    const validRequestedCount = incomingFiles.length - duplicateCount - oversizedCount;

    if (validRequestedCount > availableSlots) {
      this.toast.error(
        `Only ${availableSlots} more attachment${availableSlots === 1 ? '' : 's'} can be added.`,
      );
    }

    if (duplicateCount > 0 && addedCount === 0 && oversizedCount === 0) {
      this.toast.error(
        duplicateCount === 1
          ? 'That file is already selected.'
          : 'Those files are already selected.',
      );
    }
  }

  private async performSave(): Promise<void> {
    const workspace = this.workspaceService.currentWorkspace();

    if (!workspace?.id) {
      this.toast.error('No workspace selected.');
      return;
    }

    const existingAttachments = this.editingTask?.attachments ?? [];

    try {
      this.attachmentService.validateFileCount(
        this.selectedFiles.length,
        existingAttachments.length,
      );
    } catch (error) {
      this.toast.error(this.getErrorMessage(error));
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

    this.saving = true;
    this.isDraggingFiles = false;

    try {
      let taskId: string;

      if (this.editingTask?.id) {
        taskId = this.editingTask.id;

        await this.taskService.updateTask(taskId, task);
      } else {
        const taskReference = await this.taskService.createTask(task);
        taskId = taskReference.id;
      }

      let finalAttachments = [...existingAttachments];

      if (this.selectedFiles.length) {
        const newAttachments = await this.attachmentService.uploadFiles(
          workspace.id,
          'tasks',
          taskId,
          this.selectedFiles,
          existingAttachments.length,
        );

        finalAttachments = [...finalAttachments, ...newAttachments];
      }

      if (this.selectedFiles.length || this.pendingAttachmentDeletions.length) {
        await this.taskService.updateTask(taskId, {
          attachments: finalAttachments,
        });
      }

      for (const attachment of this.pendingAttachmentDeletions) {
        try {
          await this.attachmentService.deleteAttachment(attachment);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error)) {
            console.error(`Unable to delete attachment "${attachment.name}" from Storage:`, error);
          }
        }
      }

      this.toast.success(
        this.editingTask ? 'Task updated successfully.' : 'Task created successfully.',
      );

      this.closeForm();
    } catch (error) {
      console.error('Unable to save task:', error);
      this.toast.error(this.getErrorMessage(error));
    } finally {
      this.saving = false;
    }
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

  private resetConfirmation(): void {
    this.confirmationAction = null;
    this.attachmentPendingRemoval = null;
    this.taskPendingDeletion = null;
  }

  private formatDate(value: any): string {
    if (!value) {
      return '';
    }

    const date = value?.toDate ? value.toDate() : new Date(value);

    return date.toISOString().split('T')[0];
  }

  private isStorageObjectNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'storage/object-not-found';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to save task.';
  }
}
