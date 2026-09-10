import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Attachment } from '../../core/models/attachment.model';
import { Project } from '../../core/models/project.model';
import { AttachmentService } from '../../core/services/attachment.service';
import { ProjectLogoService } from '../../core/services/project-logo.service';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { ConfirmationDialogComponent } from '../../shared/confirmation-dialog/confirmation-dialog.component';
import { ProjectFormDrawerComponent } from '../../shared/project-form-drawer/project-form-drawer.component';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmationDialogComponent, ProjectFormDrawerComponent],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  private projectLogoService = inject(ProjectLogoService);
  private attachmentService = inject(AttachmentService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private readonly topbarService = inject(TopbarService);

  projects: Project[] = [];
  searchQuery = '';
  statusFilter = 'all';
  drawerOpen = false;
  drawerProject: Project | null = null;
  deletingProject = false;
  projectPendingDeletion: Project | null = null;
  attachmentGalleryProject: Project | null = null;
  previewAttachment: Attachment | null = null;

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Projects',
      description: 'Manage all your active and upcoming projects.',
      icon: 'fa-regular fa-folder',
    });
    this.projectService.getProjects().subscribe((projects) => {
      this.projects = projects;
      this.refreshOpenProject(projects);
    });
  }

  ngOnDestroy(): void {
    this.topbarService.clearPageContext();
  }

  openCreateForm(): void {
    this.drawerProject = null;
    this.drawerOpen = true;
  }

  editProject(project: Project): void {
    this.drawerProject = project;
    this.drawerOpen = true;
  }

  closeProjectDrawer(): void {
    this.drawerOpen = false;
    this.drawerProject = null;
  }

  projectSaved(): void {
    this.closeProjectDrawer();
  }

  requestDeleteProject(project: Project): void {
    if (!project.id || this.deletingProject) return;
    this.projectPendingDeletion = project;
  }

  async confirmDeleteProject(): Promise<void> {
    const project = this.projectPendingDeletion;
    if (!project?.id || this.deletingProject) return;
    this.deletingProject = true;
    try {
      for (const attachment of project.attachments ?? []) {
        try {
          await this.attachmentService.deleteAttachment(attachment);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error)) throw error;
        }
      }
      if (project.logoPath) {
        try {
          await this.projectLogoService.deleteLogo(project.logoPath);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error)) throw error;
        }
      }
      await this.projectService.deleteProject(project.id);
      this.toast.success('Project and its files deleted successfully.');
      this.projectPendingDeletion = null;
    } catch (error) {
      console.error('Unable to delete project:', error);
      this.toast.error(
        'Unable to delete the project completely. The project was kept so you can try again.',
      );
    } finally {
      this.deletingProject = false;
    }
  }

  cancelDeleteProject(): void {
    if (this.deletingProject) return;
    this.projectPendingDeletion = null;
  }

  openProjectAttachments(project: Project): void {
    if (!project.attachments?.length) return;
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

  getSafeResourceUrl(attachment: Attachment): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(attachment.url);
  }

  getFileTypeLabel(attachment: Attachment): string {
    const extension = attachment.name.toLowerCase().split('.').pop();
    return extension && attachment.name.includes('.') ? extension.toUpperCase() : 'FILE';
  }

  formatFileSize(size: number): string {
    return this.attachmentService.formatFileSize(size);
  }

  getFileIcon(attachment: Attachment): string {
    return this.attachmentService.getFileIcon(attachment);
  }

  getProjectDisplayStatus(project: Project): string {
    return this.projectService.getDisplayStatus(project);
  }

  getProjectStatusLabel(project: Project): string {
    return this.projectService.getStatusLabel(project);
  }

  isProjectOverdue(project: Project): boolean {
    return this.projectService.isOverdue(project);
  }

  get filteredProjects(): Project[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.projects.filter((project) => {
      const displayStatus = this.getProjectDisplayStatus(project);
      const statusLabel = this.getProjectStatusLabel(project).toLowerCase();
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        (project.clientName || '').toLowerCase().includes(query) ||
        statusLabel.includes(query) ||
        project.priority.toLowerCase().includes(query);
      const matchesStatus = this.statusFilter === 'all' || displayStatus === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  searchProjects(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  clearProjectSearch(): void {
    this.searchQuery = '';
  }

  changeStatusFilter(event: Event): void {
    this.statusFilter = (event.target as HTMLSelectElement).value;
  }

  private refreshOpenProject(projects: Project[]): void {
    if (!this.drawerProject?.id) return;
    const project = projects.find((item) => item.id === this.drawerProject?.id);
    if (project) this.drawerProject = project;
  }

  private isStorageObjectNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) return false;
    return (error as { code?: string }).code === 'storage/object-not-found';
  }
}
