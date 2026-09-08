import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Project } from '../../core/models/project.model';
import { Attachment } from '../../core/models/attachment.model';
import { ProjectService } from '../../core/services/project.service';
import { AttachmentService } from '../../core/services/attachment.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmationDialogComponent } from '../../shared/confirmation-dialog/confirmation-dialog.component';

type ProjectConfirmationAction =
  | 'remove-attachment'
  | 'save-attachment-changes'
  | 'delete-project'
  | null;

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ConfirmationDialogComponent],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private attachmentService = inject(AttachmentService);
  private workspaceService = inject(WorkspaceService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  projects: Project[] = [];
  selectedFiles: File[] = [];
  pendingAttachmentDeletions: Attachment[] = [];

  showForm = false;
  editingProject: Project | null = null;
  originalEditingProject: Project | null = null;

  searchQuery = '';
  saving = false;
  deletingProject = false;
  isDraggingFiles = false;

  confirmationAction: ProjectConfirmationAction = null;
  attachmentPendingRemoval: Attachment | null = null;
  projectPendingDeletion: Project | null = null;

  attachmentGalleryProject: Project | null = null;
  previewAttachment: Attachment | null = null;

  readonly maxAttachments = this.attachmentService.maxFiles;
  readonly maxFileSize = this.attachmentService.maxFileSize;

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
    this.projectService.getProjects().subscribe((projects) => {
      this.projects = projects;
    });
  }

  openCreateForm(): void {
    this.editingProject = null;
    this.originalEditingProject = null;
    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();

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
    this.originalEditingProject = {
      ...project,
      attachments: [...(project.attachments ?? [])],
    };

    this.editingProject = {
      ...project,
      attachments: [...(project.attachments ?? [])],
    };

    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();

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

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    this.addFiles(Array.from(input.files));
    input.value = '';
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

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.saving || this.remainingAttachmentSlots <= 0) {
      return;
    }

    this.isDraggingFiles = true;
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

    if (!attachment || !this.editingProject) {
      this.resetConfirmation();
      return;
    }

    const alreadyPending = this.pendingAttachmentDeletions.some(
      (item) => item.id === attachment.id,
    );

    if (!alreadyPending) {
      this.pendingAttachmentDeletions.push(attachment);
    }

    this.editingProject = {
      ...this.editingProject,
      attachments: (this.editingProject.attachments ?? []).filter(
        (item) => item.id !== attachment.id,
      ),
    };

    this.resetConfirmation();
  }

  saveProject(): void {
    if (this.projectForm.invalid || this.saving) {
      this.projectForm.markAllAsTouched();
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

  requestDeleteProject(project: Project): void {
    if (!project.id || this.deletingProject) {
      return;
    }

    this.projectPendingDeletion = project;
    this.confirmationAction = 'delete-project';
  }

  async confirmDeleteProject(): Promise<void> {
    const project = this.projectPendingDeletion;

    if (!project?.id || this.deletingProject) {
      return;
    }

    this.deletingProject = true;

    try {
      const attachments = project.attachments ?? [];

      for (const attachment of attachments) {
        try {
          await this.attachmentService.deleteAttachment(attachment);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error)) {
            throw error;
          }
        }
      }

      await this.projectService.deleteProject(project.id);

      this.toast.success('Project and its attachments deleted successfully.');

      this.resetConfirmation();
    } catch (error) {
      console.error('Unable to delete project:', error);

      this.toast.error(
        'Unable to delete the project completely. The project was kept so you can try again.',
      );
    } finally {
      this.deletingProject = false;
    }
  }

  openProjectAttachments(project: Project): void {
    if (!project.attachments?.length) {
      return;
    }

    this.attachmentGalleryProject = project;
    this.previewAttachment = null;
  }

  closeProjectAttachments(): void {
    this.attachmentGalleryProject = null;
    this.previewAttachment = null;
  }

  openAttachmentPreview(attachment: Attachment): void {
    this.previewAttachment = attachment;
  }

  closeAttachmentPreview(): void {
    this.previewAttachment = null;
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

  canPreview(attachment: Attachment): boolean {
    return (
      this.isImage(attachment) ||
      this.isPdf(attachment) ||
      this.isVideo(attachment) ||
      this.isAudio(attachment) ||
      this.isText(attachment)
    );
  }

  getSafeResourceUrl(attachment: Attachment): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(attachment.url);
  }

  getFileTypeLabel(attachment: Attachment): string {
    const name = attachment.name.toLowerCase();

    if (name.includes('.')) {
      const extension = name.split('.').pop();

      if (extension) {
        return extension.toUpperCase();
      }
    }

    return 'FILE';
  }

  cancelConfirmation(): void {
    if (this.saving || this.deletingProject) {
      return;
    }

    this.resetConfirmation();
  }

  closeForm(): void {
    if (this.saving) {
      return;
    }

    this.resetForm();
  }

  formatFileSize(size: number): string {
    return this.attachmentService.formatFileSize(size);
  }

  getFileIcon(attachment: Attachment): string {
    return this.attachmentService.getFileIcon(attachment);
  }

  get existingAttachmentCount(): number {
    return this.editingProject?.attachments?.length ?? 0;
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

  get deleteProjectDialogOpen(): boolean {
    return this.confirmationAction === 'delete-project';
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

  private addFiles(incomingFiles: File[]): void {
    if (this.saving || !incomingFiles.length) {
      return;
    }

    const existingCount = this.editingProject?.attachments?.length ?? 0;

    const availableSlots = this.maxAttachments - existingCount - this.selectedFiles.length;

    if (availableSlots <= 0) {
      this.toast.error(`A project can have a maximum of ${this.maxAttachments} attachments.`);

      return;
    }

    let addedCount = 0;
    let duplicateCount = 0;
    let oversizedCount = 0;

    for (const file of incomingFiles) {
      if (addedCount >= availableSlots) {
        break;
      }

      const exists = this.selectedFiles.some(
        (selectedFile) =>
          selectedFile.name === file.name &&
          selectedFile.size === file.size &&
          selectedFile.lastModified === file.lastModified,
      );

      if (exists) {
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

    const existingAttachments = this.editingProject?.attachments ?? [];

    try {
      this.attachmentService.validateFileCount(
        this.selectedFiles.length,
        existingAttachments.length,
      );
    } catch (error) {
      this.toast.error(this.getErrorMessage(error));

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

    this.saving = true;
    this.isDraggingFiles = false;

    try {
      let projectId: string;

      if (this.editingProject?.id) {
        projectId = this.editingProject.id;

        await this.projectService.updateProject(projectId, project);
      } else {
        const projectReference = await this.projectService.createProject(project);

        projectId = projectReference.id;
      }

      let finalAttachments = [...existingAttachments];

      if (this.selectedFiles.length) {
        const newAttachments = await this.attachmentService.uploadFiles(
          workspace.id,
          'projects',
          projectId,
          this.selectedFiles,
          existingAttachments.length,
        );

        finalAttachments = [...finalAttachments, ...newAttachments];
      }

      if (this.selectedFiles.length || this.pendingAttachmentDeletions.length) {
        await this.projectService.updateAttachments(projectId, finalAttachments);
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
        this.editingProject ? 'Project updated successfully.' : 'Project created successfully.',
      );

      this.resetForm();
    } catch (error) {
      console.error('Unable to save project:', error);

      this.toast.error(this.getErrorMessage(error));
    } finally {
      this.saving = false;
    }
  }

  private isStorageObjectNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'storage/object-not-found';
  }

  private resetConfirmation(): void {
    this.confirmationAction = null;
    this.attachmentPendingRemoval = null;
    this.projectPendingDeletion = null;
  }

  private resetForm(): void {
    this.showForm = false;
    this.editingProject = null;
    this.originalEditingProject = null;
    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();

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
  }

  private formatDate(value: any): string {
    if (!value) {
      return '';
    }

    const date = value?.toDate ? value.toDate() : new Date(value);

    return date.toISOString().split('T')[0];
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to save project.';
  }
}
