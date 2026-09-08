import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { ProjectTask } from '../../core/models/task.model';
import { Attachment } from '../../core/models/attachment.model';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import { AttachmentService } from '../../core/services/attachment.service';
import { TopbarService } from '../../core/services/top-bar.service';

type ProjectTab = 'overview' | 'tasks' | 'attachments';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-details.component.html',
  styleUrl: './project-details.component.scss',
})
export class ProjectDetailsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private attachmentService = inject(AttachmentService);
  private topbarService = inject(TopbarService);

  project: Project | null = null;
  tasks: ProjectTask[] = [];
  loading = true;

  activeTab: ProjectTab = 'overview';

  previewAttachment: Attachment | null = null;

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('id');

    if (!projectId) {
      this.loading = false;
      this.topbarService.clearProjectContext();
      return;
    }

    combineLatest([
      this.projectService.getProject(projectId),
      this.taskService.getTasksByProject(projectId),
    ]).subscribe({
      next: ([project, tasks]) => {
        this.project = project;
        this.tasks = tasks;
        this.loading = false;

        if (project) {
          this.topbarService.setProjectContext({
            name: project.name,
            clientName: project.clientName || 'Personal Project',
            status: project.status,
            priority: project.priority,
          });
        } else {
          this.topbarService.clearProjectContext();
        }
      },
      error: () => {
        this.loading = false;
        this.topbarService.clearProjectContext();
      },
    });
  }

  ngOnDestroy(): void {
    this.topbarService.clearProjectContext();
  }

  get completedTasks(): number {
    return this.tasks.filter((task) => task.status === 'completed').length;
  }

  get inProgressTasks(): number {
    return this.tasks.filter((task) => task.status === 'in-progress').length;
  }

  get taskProgress(): number {
    if (!this.tasks.length) {
      return 0;
    }

    return Math.round((this.completedTasks / this.tasks.length) * 100);
  }

  get attachments(): Attachment[] {
    return this.project?.attachments ?? [];
  }

  get attachmentCount(): number {
    return this.attachments.length;
  }

  openPreview(attachment: Attachment): void {
    this.previewAttachment = attachment;
  }

  closePreview(): void {
    this.previewAttachment = null;
  }

  formatFileSize(size: number): string {
    return this.attachmentService.formatFileSize(size);
  }

  getFileIcon(attachment: Attachment): string {
    return this.attachmentService.getFileIcon(attachment);
  }

  isImage(attachment: Attachment): boolean {
    return attachment.type.startsWith('image/');
  }

  isPdf(attachment: Attachment): boolean {
    return attachment.type === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf');
  }

  isVideo(attachment: Attachment): boolean {
    return attachment.type.startsWith('video/');
  }

  isAudio(attachment: Attachment): boolean {
    return attachment.type.startsWith('audio/');
  }

  isText(attachment: Attachment): boolean {
    const type = attachment.type.toLowerCase();
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

  getFileTypeLabel(attachment: Attachment): string {
    const name = attachment.name.toLowerCase();

    const extension = name.includes('.') ? name.split('.').pop() : '';

    if (extension) {
      return extension.toUpperCase();
    }

    if (attachment.type) {
      return attachment.type;
    }

    return 'FILE';
  }
}
