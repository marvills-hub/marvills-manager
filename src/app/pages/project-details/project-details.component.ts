import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Attachment } from '../../core/models/attachment.model';
import { Project } from '../../core/models/project.model';
import { TaskStatusDefinition } from '../../core/models/task-status-definition.model';
import { ProjectTask } from '../../core/models/task.model';
import { WorkspaceMemberProfile } from '../../core/models/workspace-member-profile.model';
import { AttachmentService } from '../../core/services/attachment.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskStatusService } from '../../core/services/task-status.service';
import { TaskService } from '../../core/services/task.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspaceMemberService } from '../../core/services/workspace-member.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ProjectFormDrawerComponent } from '../../shared/project-form-drawer/project-form-drawer.component';

type ProjectTab = 'overview' | 'tasks' | 'attachments';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, RouterLink, ProjectFormDrawerComponent],
  templateUrl: './project-details.component.html',
  styleUrl: './project-details.component.scss',
})
export class ProjectDetailsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private taskStatusService = inject(TaskStatusService);
  private workspaceMemberService = inject(WorkspaceMemberService);
  private attachmentService = inject(AttachmentService);
  private workspaceService = inject(WorkspaceService);
  private topbarService = inject(TopbarService);
  private sanitizer = inject(DomSanitizer);
  private subscriptions = new Subscription();

  project: Project | null = null;
  tasks: ProjectTask[] = [];
  statuses: TaskStatusDefinition[] = [];
  members: WorkspaceMemberProfile[] = [];
  loading = true;
  tasksLoading = true;
  activeTab: ProjectTab = 'overview';
  previewAttachment: Attachment | null = null;
  projectDrawerOpen = false;

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (!projectId) {
      this.loading = false;
      this.tasksLoading = false;
      this.topbarService.clearProjectContext();
      return;
    }
    this.loadProject(projectId);
    this.loadTasks(projectId);
    this.loadWorkspaceData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.topbarService.clearProjectContext();
  }

  setActiveTab(tab: ProjectTab): void {
    this.activeTab = tab;
  }

  openProjectEditor(): void {
    if (!this.project?.id) return;
    this.projectDrawerOpen = true;
  }

  closeProjectEditor(): void {
    this.projectDrawerOpen = false;
  }

  projectSaved(): void {
    this.projectDrawerOpen = false;
  }

  get completedTasks(): number {
    return this.tasks.filter((task) => this.isTaskCompleted(task)).length;
  }

  get inProgressTasks(): number {
    return this.tasks.length - this.completedTasks;
  }

  get taskProgress(): number {
    if (!this.tasks.length) return 0;
    return Math.round((this.completedTasks / this.tasks.length) * 100);
  }

  get attachments(): Attachment[] {
    if (!Array.isArray(this.project?.attachments)) return [];
    return this.project.attachments;
  }

  get attachmentCount(): number {
    return this.attachments.length;
  }

  get projectStatus(): string {
    if (!this.project) return '';
    return this.projectService.getDisplayStatus(this.project);
  }

  get projectStatusLabel(): string {
    if (!this.project) return '';
    return this.projectService.getStatusLabel(this.project);
  }

  get projectProgress(): number {
    if (!this.project) return 0;
    return this.clampProgress(this.project.progress);
  }

  get projectDuration(): number {
    if (!this.project?.startDate || !this.project?.dueDate) return 0;
    const startDate = this.toDate(this.project.startDate);
    const dueDate = this.toDate(this.project.dueDate);
    if (!startDate || !dueDate) return 0;
    startDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((dueDate.getTime() - startDate.getTime()) / 86400000));
  }

  isProjectOverdue(): boolean {
    if (!this.project) return false;
    return this.projectService.isOverdue(this.project);
  }

  getProjectStatusLabel(project: Project): string {
    return this.projectService.getStatusLabel(project);
  }

  getTaskStatus(task: ProjectTask): TaskStatusDefinition | undefined {
    return this.statuses.find((status) => status.id === task.status);
  }

  getTaskStatusName(task: ProjectTask): string {
    const status = this.getTaskStatus(task);
    if (status) return status.name;
    return this.getLegacyStatusName(task.status);
  }

  getTaskStatusColor(task: ProjectTask): string {
    const status = this.getTaskStatus(task);
    if (status) return status.color;
    return this.getLegacyStatusColor(task.status);
  }

  isTaskCompleted(task: ProjectTask): boolean {
    const status = this.getTaskStatus(task);
    if (status) return status.isCompleted;
    return task.status === 'completed';
  }

  getTaskAssignees(task: ProjectTask): WorkspaceMemberProfile[] {
    const assigneeIds = this.getTaskAssigneeIds(task);
    return assigneeIds
      .map((userId) => this.members.find((member) => member.userId === userId))
      .filter((member): member is WorkspaceMemberProfile => !!member);
  }

  getTaskAssigneeLabel(task: ProjectTask): string {
    const assignees = this.getTaskAssignees(task);
    if (assignees.length) {
      return assignees.map((member) => member.displayName?.trim() || member.email).join(', ');
    }
    if (task.assignee?.trim()) return task.assignee.trim();
    return 'Unassigned';
  }

  getTaskAssigneeInitials(member: WorkspaceMemberProfile): string {
    const name = member.displayName?.trim() || member.email.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  getSafeResourceUrl(attachment: Attachment): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(attachment.url);
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

  getFileTypeLabel(attachment: Attachment): string {
    const name = attachment.name.toLowerCase();
    if (name.includes('.')) {
      const extension = name.split('.').pop();
      if (extension) return extension.toUpperCase();
    }
    return 'FILE';
  }

  formatDate(value: any): string {
    const date = this.toDate(value);
    if (!date) return 'Not specified';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private loadProject(projectId: string): void {
    const subscription = this.projectService.getProject(projectId).subscribe({
      next: (project) => {
        this.project = project;
        this.loading = false;
        if (!project) {
          this.topbarService.clearProjectContext();
          return;
        }
        this.topbarService.setProjectContext({
          name: project.name,
          clientName: project.clientName || 'Personal Project',
          status: this.getProjectStatusLabel(project),
          priority: project.priority,
        });
      },
      error: (error) => {
        console.error('Unable to load project:', error);
        this.project = null;
        this.loading = false;
        this.topbarService.clearProjectContext();
      },
    });
    this.subscriptions.add(subscription);
  }

  private loadTasks(projectId: string): void {
    const subscription = this.taskService.getTasksByProject(projectId).subscribe({
      next: (tasks) => {
        this.tasks = [...tasks].sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
          const orderB = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        });
        this.tasksLoading = false;
      },
      error: (error) => {
        console.error('Unable to load project tasks:', error);
        this.tasks = [];
        this.tasksLoading = false;
      },
    });
    this.subscriptions.add(subscription);
  }

  private loadWorkspaceData(): void {
    const workspaceSubscription = this.workspaceService.currentWorkspace$.subscribe((workspace) => {
      if (!workspace?.id) {
        this.statuses = [];
        return;
      }
      const statusSubscription = this.taskStatusService.getStatuses(workspace.id).subscribe({
        next: (statuses) => {
          this.statuses = statuses;
        },
        error: (error) => {
          console.error('Unable to load task statuses:', error);
          this.statuses = [];
        },
      });
      this.subscriptions.add(statusSubscription);
    });
    const memberSubscription = this.workspaceMemberService.getMembersWithProfiles().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: (error) => {
        console.error('Unable to load workspace members:', error);
        this.members = [];
      },
    });
    this.subscriptions.add(workspaceSubscription);
    this.subscriptions.add(memberSubscription);
  }

  private getTaskAssigneeIds(task: ProjectTask): string[] {
    if (Array.isArray(task.assigneeIds)) return [...task.assigneeIds];
    if (task.assigneeId) return [task.assigneeId];
    const legacyName = task.assignee?.trim().toLowerCase();
    if (!legacyName) return [];
    const member = this.members.find(
      (item) =>
        item.displayName?.trim().toLowerCase() === legacyName ||
        item.email.trim().toLowerCase() === legacyName,
    );
    return member?.userId ? [member.userId] : [];
  }

  private getLegacyStatusName(status: string): string {
    if (status === 'todo') return 'To Do';
    if (status === 'in-progress') return 'In Progress';
    if (status === 'review') return 'Review';
    if (status === 'completed') return 'Completed';
    return 'Unknown Status';
  }

  private getLegacyStatusColor(status: string): string {
    if (status === 'todo') return '#7786a6';
    if (status === 'in-progress') return '#5e80ff';
    if (status === 'review') return '#a56cff';
    if (status === 'completed') return '#2dbe82';
    return '#7786a6';
  }

  private clampProgress(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
