import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Project } from '../../core/models/project.model';
import { Attachment } from '../../core/models/attachment.model';
import { ProjectService } from '../../core/services/project.service';
import { ProjectLogoService } from '../../core/services/project-logo.service';
import { AttachmentService } from '../../core/services/attachment.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

type ProjectConfirmationAction = 'remove-attachment' | 'save-attachment-changes' | null;

@Component({
  selector: 'app-project-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ConfirmationDialogComponent,
    RichTextEditorComponent,
  ],
  templateUrl: './project-form-drawer.component.html',
  styleUrl: './project-form-drawer.component.scss',
})
export class ProjectFormDrawerComponent implements OnChanges, OnDestroy {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private projectLogoService = inject(ProjectLogoService);
  private attachmentService = inject(AttachmentService);
  private workspaceService = inject(WorkspaceService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  @Input() open = false;
  @Input() project: Project | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Project>();

  editingProject: Project | null = null;
  selectedFiles: File[] = [];
  selectedLogo: File | null = null;
  logoPreview = '';
  removeExistingLogo = false;
  pendingAttachmentDeletions: Attachment[] = [];
  saving = false;
  isDraggingFiles = false;
  richEditorOpen = false;
  confirmationAction: ProjectConfirmationAction = null;
  attachmentPendingRemoval: Attachment | null = null;
  readonly maxAttachments = this.attachmentService.maxFiles;
  readonly maxFileSize = this.attachmentService.maxFileSize;

  projectForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    clientName: [''],
    description: [''],
    status: ['planning' as Project['status']],
    priority: ['medium' as Project['priority']],
    progress: [0, [Validators.min(0), Validators.max(100)]],
    startDate: [''],
    dueDate: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open'] && !changes['project']) return;
    if (!this.open) return;
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.clearLogoSelection();
  }

  close(): void {
    if (this.saving) return;
    this.richEditorOpen = false;
    this.resetState();
    this.closed.emit();
  }

  openRichEditor(): void {
    if (this.saving) return;
    this.richEditorOpen = true;
  }

  closeRichEditor(): void {
    this.richEditorOpen = false;
  }

  updateDescription(value: string): void {
    this.projectForm.controls.description.setValue(value);
    this.projectForm.controls.description.markAsDirty();
  }

  selectLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.saving) return;
    try {
      this.projectLogoService.validateLogo(file);
      this.clearLogoSelection();
      this.selectedLogo = file;
      this.logoPreview = this.projectLogoService.createPreview(file);
      this.removeExistingLogo = false;
    } catch (error) {
      this.toast.error(this.getErrorMessage(error));
    }
  }

  clearSelectedLogo(): void {
    if (this.saving) return;
    this.clearLogoSelection();
  }

  requestRemoveLogo(): void {
    if (this.saving) return;
    this.clearLogoSelection();
    this.removeExistingLogo = true;
  }

  restoreExistingLogo(): void {
    if (this.saving) return;
    this.removeExistingLogo = false;
  }

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.saving || this.remainingAttachmentSlots <= 0) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      return;
    }
    this.isDraggingFiles = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.saving || this.remainingAttachmentSlots <= 0) return;
    this.isDraggingFiles = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const currentTarget = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && currentTarget.contains(relatedTarget)) return;
    this.isDraggingFiles = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFiles = false;
    if (this.saving || this.remainingAttachmentSlots <= 0 || !event.dataTransfer?.files.length)
      return;
    this.addFiles(Array.from(event.dataTransfer.files));
    event.dataTransfer.clearData();
  }

  removeSelectedFile(index: number): void {
    if (this.saving) return;
    this.selectedFiles.splice(index, 1);
  }

  requestRemoveExistingAttachment(attachment: Attachment): void {
    if (this.saving) return;
    this.attachmentPendingRemoval = attachment;
    this.confirmationAction = 'remove-attachment';
  }

  confirmRemoveExistingAttachment(): void {
    const attachment = this.attachmentPendingRemoval;
    if (!attachment || !this.editingProject) {
      this.resetConfirmation();
      return;
    }
    if (!this.pendingAttachmentDeletions.some((item) => item.id === attachment.id))
      this.pendingAttachmentDeletions.push(attachment);
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

  cancelConfirmation(): void {
    if (this.saving) return;
    this.resetConfirmation();
  }

  onProgressSliderChange(event: Event): void {
    this.projectForm.controls.progress.setValue(
      this.clampProgress(Number((event.target as HTMLInputElement).value)),
    );
  }

  onProgressInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = this.clampProgress(Number(input.value));
    this.projectForm.controls.progress.setValue(value);
    input.value = String(value);
  }

  formatFileSize(size: number): string {
    return this.attachmentService.formatFileSize(size);
  }

  getFileIcon(attachment: Attachment): string {
    return this.attachmentService.getFileIcon(attachment);
  }

  getSafeResourceUrl(attachment: Attachment): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(attachment.url);
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

  private initializeForm(): void {
    this.resetState();
    const dates = this.getDefaultDates();
    if (!this.project) {
      this.projectForm.reset({
        name: '',
        clientName: '',
        description: '',
        status: 'planning',
        priority: 'medium',
        progress: 0,
        startDate: dates.startDate,
        dueDate: dates.dueDate,
      });
      return;
    }
    this.editingProject = {
      ...this.project,
      attachments: [...(this.project.attachments ?? [])],
    };
    this.projectForm.reset({
      name: this.project.name,
      clientName: this.project.clientName || '',
      description: this.project.description || '',
      status: this.project.status,
      priority: this.project.priority,
      progress: this.clampProgress(this.project.progress),
      startDate: this.formatDate(this.project.startDate),
      dueDate: this.formatDate(this.project.dueDate),
    });
  }

  private async performSave(): Promise<void> {
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) {
      this.toast.error('No workspace selected.');
      return;
    }
    const existingAttachments = [...(this.editingProject?.attachments ?? [])];
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
    const projectData: Omit<Project, 'workspaceId'> = {
      name: value.name,
      clientName: value.clientName,
      description: value.description,
      status: value.status,
      priority: value.priority,
      progress: this.clampProgress(Number(value.progress)),
    };
    if (value.startDate) projectData.startDate = this.createLocalDate(value.startDate);
    if (value.dueDate) projectData.dueDate = this.createLocalDate(value.dueDate);
    this.saving = true;
    this.isDraggingFiles = false;
    try {
      let projectId: string;
      if (this.editingProject?.id) {
        projectId = this.editingProject.id;
        await this.projectService.updateProject(projectId, projectData);
      } else {
        const reference = await this.projectService.createProject(projectData);
        projectId = reference.id;
      }
      if (this.selectedLogo) {
        if (this.editingProject?.logoPath)
          await this.projectLogoService.deleteLogo(this.editingProject.logoPath);
        const logo = await this.projectLogoService.uploadLogo(
          workspace.id,
          projectId,
          this.selectedLogo,
        );
        await this.projectService.updateProjectLogo(projectId, logo.url, logo.path);
      } else if (this.removeExistingLogo && this.editingProject?.logoPath) {
        await this.projectLogoService.deleteLogo(this.editingProject.logoPath);
        await this.projectService.removeProjectLogo(projectId);
      }
      let finalAttachments = [...existingAttachments];
      if (this.selectedFiles.length) {
        const uploaded = await this.attachmentService.uploadFiles(
          workspace.id,
          'projects',
          projectId,
          this.selectedFiles,
          existingAttachments.length,
        );
        finalAttachments = [...finalAttachments, ...uploaded];
      }
      await this.projectService.updateAttachments(projectId, finalAttachments);
      for (const attachment of this.pendingAttachmentDeletions) {
        try {
          await this.attachmentService.deleteAttachment(attachment);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error))
            console.error(`Unable to delete attachment "${attachment.name}" from Storage:`, error);
        }
      }
      const savedProject: Project = {
        ...(this.project ?? ({} as Project)),
        ...projectData,
        id: projectId,
        workspaceId: workspace.id,
        attachments: finalAttachments,
      };
      if (this.selectedLogo) {
        const refreshedProject = await this.getCurrentProject(projectId);
        if (refreshedProject) Object.assign(savedProject, refreshedProject);
      } else if (this.removeExistingLogo) {
        savedProject.logoURL = '';
        savedProject.logoPath = '';
      }
      this.toast.success(
        this.editingProject ? 'Project updated successfully.' : 'Project created successfully.',
      );
      this.saved.emit(savedProject);
      this.resetState();
      this.closed.emit();
    } catch (error) {
      console.error('Unable to save project:', error);
      this.toast.error(this.getErrorMessage(error));
    } finally {
      this.saving = false;
    }
  }

  private getCurrentProject(projectId: string): Promise<Project | null> {
    return new Promise((resolve) => {
      const subscription = this.projectService.getProject(projectId).subscribe({
        next: (project) => {
          subscription.unsubscribe();
          resolve(project ?? null);
        },
        error: () => {
          subscription.unsubscribe();
          resolve(null);
        },
      });
    });
  }

  private addFiles(incomingFiles: File[]): void {
    if (this.saving || !incomingFiles.length) return;
    const availableSlots =
      this.maxAttachments - this.existingAttachmentCount - this.selectedFiles.length;
    if (availableSlots <= 0) {
      this.toast.error(`A project can have a maximum of ${this.maxAttachments} attachments.`);
      return;
    }
    let addedCount = 0;
    let duplicateCount = 0;
    let oversizedCount = 0;
    for (const file of incomingFiles) {
      if (addedCount >= availableSlots) break;
      const exists = this.selectedFiles.some(
        (selected) =>
          selected.name === file.name &&
          selected.size === file.size &&
          selected.lastModified === file.lastModified,
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
    if (validRequestedCount > availableSlots)
      this.toast.error(
        `Only ${availableSlots} more attachment${availableSlots === 1 ? '' : 's'} can be added.`,
      );
    if (duplicateCount > 0 && addedCount === 0 && oversizedCount === 0)
      this.toast.error(
        duplicateCount === 1
          ? 'That file is already selected.'
          : 'Those files are already selected.',
      );
  }

  private resetState(): void {
    this.editingProject = null;
    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.removeExistingLogo = false;
    this.isDraggingFiles = false;
    this.richEditorOpen = false;
    this.resetConfirmation();
    this.clearLogoSelection();
  }

  private resetConfirmation(): void {
    this.confirmationAction = null;
    this.attachmentPendingRemoval = null;
  }

  private clearLogoSelection(): void {
    if (this.logoPreview) this.projectLogoService.revokePreview(this.logoPreview);
    this.selectedLogo = null;
    this.logoPreview = '';
  }

  private getDefaultDates(): { startDate: string; dueDate: string } {
    const startDate = new Date();
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 7);
    return {
      startDate: this.toDateInputValue(startDate),
      dueDate: this.toDateInputValue(dueDate),
    };
  }

  private createLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatDate(value: any): string {
    if (!value) return '';
    const date = value?.toDate ? value.toDate() : new Date(value);
    return this.toDateInputValue(date);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private clampProgress(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private isStorageObjectNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) return false;
    return (error as { code?: string }).code === 'storage/object-not-found';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Unable to save project.';
  }
}
