import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { Attachment } from '../../core/models/attachment.model';
import { Project } from '../../core/models/project.model';
import { ProjectTask, TaskStatus } from '../../core/models/task.model';
import { TaskStatusDefinition } from '../../core/models/task-status-definition.model';
import { WorkspaceMemberProfile } from '../../core/models/workspace-member-profile.model';
import { AttachmentService } from '../../core/services/attachment.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import { TaskStatusService } from '../../core/services/task-status.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspaceMemberService } from '../../core/services/workspace-member.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ConfirmationDialogComponent } from '../../shared/confirmation-dialog/confirmation-dialog.component';
import { StatusManagerComponent } from './components/status-manager/status-manager.component';
import { KanbanViewComponent, TaskOrderChange } from './kanban-view/kanban-view.component';
import {
  ListViewComponent,
  TaskPriorityUpdate,
  TaskStatusUpdate,
} from './list-view/list-view.component';

type TaskView = 'board' | 'list';
type TaskConfirmationAction =
  | 'remove-attachment'
  | 'save-attachment-changes'
  | 'delete-task'
  | null;

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ConfirmationDialogComponent,
    KanbanViewComponent,
    ListViewComponent,
    StatusManagerComponent,
  ],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private attachmentService = inject(AttachmentService);
  private workspaceService = inject(WorkspaceService);
  private workspaceMemberService = inject(WorkspaceMemberService);
  private taskStatusService = inject(TaskStatusService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private topbarService = inject(TopbarService);
  private workspaceSubscription?: Subscription;
  private statusSubscription?: Subscription;
  private loadedStatusWorkspaceId = '';
  private migratedStatusWorkspaceId = '';
  readonly permissions = inject(WorkspacePermissionService);
  readonly maxAttachments = this.attachmentService.maxFiles;
  readonly maxFileSize = this.attachmentService.maxFileSize;
  tasks: ProjectTask[] = [];
  projects: Project[] = [];
  members: WorkspaceMemberProfile[] = [];
  statuses: TaskStatusDefinition[] = [];
  activeView: TaskView = this.getSavedView();
  selectedProjectId = this.getSavedProjectFilter();
  showForm = false;
  showStatusManager = false;
  editingTask: ProjectTask | null = null;
  selectedFiles: File[] = [];
  pendingAttachmentDeletions: Attachment[] = [];
  isDraggingFiles = false;
  saving = false;
  deletingTask = false;
  updatingOrder = false;
  updatingTaskId: string | null = null;
  loadingStatuses = false;
  confirmationAction: TaskConfirmationAction = null;
  attachmentPendingRemoval: Attachment | null = null;
  taskPendingDeletion: ProjectTask | null = null;
  attachmentGalleryTask: ProjectTask | null = null;
  previewAttachment: Attachment | null = null;
  taskForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    projectId: [''],
    status: [''],
    priority: ['medium' as ProjectTask['priority']],
    assigneeIds: [[] as string[]],
    dueDate: [''],
  });

  constructor() {
    this.topbarService.setPageContext({
      title: 'Tasks',
      icon: 'fa-regular fa-square-check',
    });
  }

  ngOnInit(): void {
    this.taskService.getTasks().subscribe((tasks) => (this.tasks = this.sortTasks(tasks)));
    this.projectService.getProjects().subscribe((projects) => {
      this.projects = projects;
      if (
        this.selectedProjectId !== 'all' &&
        this.selectedProjectId !== 'none' &&
        !projects.some((project) => project.id === this.selectedProjectId)
      )
        this.setProjectFilter('all');
    });
    this.workspaceMemberService.getMembersWithProfiles().subscribe((members) => {
      this.members = members.sort((a, b) =>
        this.getMemberName(a).localeCompare(this.getMemberName(b)),
      );
    });
    this.workspaceSubscription = this.workspaceService.currentWorkspace$.subscribe((workspace) => {
      if (!workspace?.id) {
        this.statusSubscription?.unsubscribe();
        this.statusSubscription = undefined;
        this.statuses = [];
        this.loadedStatusWorkspaceId = '';
        this.migratedStatusWorkspaceId = '';
        this.loadingStatuses = false;
        return;
      }
      if (this.loadedStatusWorkspaceId === workspace.id) return;
      this.statuses = [];
      void this.initializeStatuses(workspace.id, workspace.taskStatusesInitialized ?? false);
    });
  }

  ngOnDestroy(): void {
    this.workspaceSubscription?.unsubscribe();
    this.statusSubscription?.unsubscribe();
    this.topbarService.clearPageContext();
  }

  get filteredTasks(): ProjectTask[] {
    if (this.selectedProjectId === 'all') return this.tasks;
    if (this.selectedProjectId === 'none') return this.tasks.filter((task) => !task.projectId);
    return this.tasks.filter((task) => task.projectId === this.selectedProjectId);
  }

  get selectedProjectName(): string {
    if (this.selectedProjectId === 'all') return 'All Projects';
    if (this.selectedProjectId === 'none') return 'No Project';
    return (
      this.projects.find((project) => project.id === this.selectedProjectId)?.name || 'All Projects'
    );
  }

  get filteredTaskCount(): number {
    return this.filteredTasks.length;
  }

  get unassignedProjectTaskCount(): number {
    return this.tasks.filter((task) => !task.projectId).length;
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

  get currentWorkspaceId(): string {
    return this.workspaceService.currentWorkspace()?.id || '';
  }

  get defaultStatusId(): string {
    return this.statuses[0]?.id || '';
  }

  getMemberName(member: WorkspaceMemberProfile): string {
    return member.displayName?.trim() || member.email;
  }

  getMemberInitial(member: WorkspaceMemberProfile): string {
    return this.getMemberName(member).charAt(0).toUpperCase();
  }

  getAssignees(task: ProjectTask): WorkspaceMemberProfile[] {
    const ids = this.getTaskAssigneeIds(task);
    return ids
      .map((id) => this.members.find((member) => member.userId === id))
      .filter((member): member is WorkspaceMemberProfile => !!member);
  }

  getStatusLabel(statusId: TaskStatus): string {
    return this.statuses.find((status) => status.id === statusId)?.name || 'Unknown Status';
  }

  async openStatusManager(): Promise<void> {
    if (!this.permissions.canManageTaskStatuses()) return;
    const workspace = this.workspaceService.currentWorkspace();
    if (!workspace?.id) {
      this.toast.error('No workspace selected.');
      return;
    }
    if (!this.statuses.length && !this.loadingStatuses)
      await this.initializeStatuses(workspace.id, workspace.taskStatusesInitialized ?? false);
    this.showStatusManager = true;
  }

  closeStatusManager(): void {
    this.showStatusManager = false;
  }

  setView(view: TaskView): void {
    this.activeView = view;
    localStorage.setItem('marvills-task-view', view);
  }

  setProjectFilter(projectId: string): void {
    this.selectedProjectId = projectId;
    localStorage.setItem('marvills-task-project-filter', projectId);
  }

  onProjectFilterChange(event: Event): void {
    this.setProjectFilter((event.target as HTMLSelectElement).value);
  }

  getProjectTaskCount(projectId: string): number {
    return this.tasks.filter((task) => task.projectId === projectId).length;
  }

  async changeTaskOrder(change: TaskOrderChange): Promise<void> {
    if (!this.permissions.canEditTasks() || this.updatingOrder) return;
    const previousTasks = this.tasks.map((task) => ({ ...task }));
    const affectedStatuses = new Set<TaskStatus>([change.previousStatus, change.status]);
    this.tasks = this.applyOrderChange(change);
    this.updatingOrder = true;
    try {
      await this.taskService.updateTaskOrder(
        this.tasks.filter((task) => affectedStatuses.has(task.status)),
      );
    } catch (error) {
      console.error('Unable to update task order:', error);
      this.tasks = previousTasks;
      this.toast.error('Unable to update task position.');
    } finally {
      this.updatingOrder = false;
    }
  }

  openCreateTask(): void {
    if (!this.permissions.canCreateTasks()) return;
    if (!this.statuses.length) {
      this.toast.error('Create a task status before adding tasks.');
      return;
    }
    this.editingTask = null;
    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();
    this.resetTaskForm();
    if (this.selectedProjectId !== 'all' && this.selectedProjectId !== 'none')
      this.taskForm.patchValue({ projectId: this.selectedProjectId });
    this.showForm = true;
  }

  editTask(task: ProjectTask): void {
    if (!this.permissions.canEditTasks()) return;
    this.editingTask = { ...task, attachments: [...(task.attachments ?? [])] };
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
      assigneeIds: this.getTaskAssigneeIds(task),
      dueDate: this.formatDate(task.dueDate),
    });
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.resetFormState();
  }

  saveTask(): void {
    if (!this.canModifyCurrentTask()) return;
    if (this.taskForm.invalid || this.saving) {
      this.taskForm.markAllAsTouched();
      return;
    }
    if (!this.taskForm.controls.status.value) {
      this.toast.error('Select a task status.');
      return;
    }
    if (this.pendingAttachmentDeletions.length) {
      this.confirmationAction = 'save-attachment-changes';
      return;
    }
    void this.performSave();
  }

  confirmSaveAttachmentChanges(): void {
    if (!this.canModifyCurrentTask()) return;
    this.resetConfirmation();
    void this.performSave();
  }

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.canModifyCurrentTask() || !input.files?.length) return;
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canModifyCurrentTask() || this.saving || this.remainingAttachmentSlots <= 0) return;
    this.isDraggingFiles = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canModifyCurrentTask() || this.saving || this.remainingAttachmentSlots <= 0) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      return;
    }
    this.isDraggingFiles = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (related && target.contains(related)) return;
    this.isDraggingFiles = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFiles = false;
    if (
      !this.canModifyCurrentTask() ||
      this.saving ||
      this.remainingAttachmentSlots <= 0 ||
      !event.dataTransfer?.files.length
    )
      return;
    this.addFiles(Array.from(event.dataTransfer.files));
    event.dataTransfer.clearData();
  }

  removeSelectedFile(index: number): void {
    if (!this.canModifyCurrentTask() || this.saving) return;
    this.selectedFiles.splice(index, 1);
  }

  requestRemoveExistingAttachment(attachment: Attachment): void {
    if (!this.permissions.canEditTasks() || this.saving) return;
    this.attachmentPendingRemoval = attachment;
    this.confirmationAction = 'remove-attachment';
  }

  confirmRemoveExistingAttachment(): void {
    if (!this.permissions.canEditTasks()) return;
    const attachment = this.attachmentPendingRemoval;
    if (!attachment || !this.editingTask) {
      this.resetConfirmation();
      return;
    }
    if (!this.pendingAttachmentDeletions.some((item) => item.id === attachment.id))
      this.pendingAttachmentDeletions.push(attachment);
    this.editingTask = {
      ...this.editingTask,
      attachments: (this.editingTask.attachments ?? []).filter((item) => item.id !== attachment.id),
    };
    this.resetConfirmation();
  }

  requestDeleteTask(task: ProjectTask): void {
    if (!this.permissions.canDeleteTasks() || !task.id || this.deletingTask) return;
    this.taskPendingDeletion = task;
    this.confirmationAction = 'delete-task';
  }

  async confirmDeleteTask(): Promise<void> {
    if (!this.permissions.canDeleteTasks()) return;
    const task = this.taskPendingDeletion;
    if (!task?.id || this.deletingTask) return;
    this.deletingTask = true;
    try {
      for (const attachment of task.attachments ?? []) {
        try {
          await this.attachmentService.deleteAttachment(attachment);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error)) throw error;
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
    if (!this.saving && !this.deletingTask) this.resetConfirmation();
  }

  openTaskAttachments(task: ProjectTask, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!task.attachments?.length) return;
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

  getProjectName(projectId?: string): string {
    return projectId
      ? this.projects.find((project) => project.id === projectId)?.name || 'Project'
      : 'No Project';
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
      ['json', 'javascript', 'typescript', 'xml'].some((value) => type.includes(value)) ||
      ['.txt', '.md', '.json', '.html', '.css', '.scss', '.js', '.ts'].some((extension) =>
        name.endsWith(extension),
      )
    );
  }

  getSafeResourceUrl(attachment: Attachment): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(attachment.url);
  }

  getFileTypeLabel(attachment: Attachment): string {
    return attachment.name.includes('.')
      ? attachment.name.split('.').pop()?.toUpperCase() || 'FILE'
      : 'FILE';
  }

  getTaskDueDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  async updateTaskStatus({ task, status }: TaskStatusUpdate): Promise<void> {
    if (
      !this.permissions.canEditTasks() ||
      !task.id ||
      task.status === status ||
      this.updatingTaskId
    )
      return;
    const statusDefinition = this.statuses.find((item) => item.id === status);
    if (!statusDefinition) {
      this.toast.error('Unable to find that task status.');
      return;
    }
    const previousTasks = this.tasks.map((item) => ({ ...item }));
    const targetTasks = this.tasks.filter((item) => item.status === status && item.id !== task.id);
    const nextOrder = targetTasks.length
      ? Math.max(...targetTasks.map((item) => (typeof item.order === 'number' ? item.order : 0))) +
        1000
      : 0;
    this.tasks = this.tasks.map((item) =>
      item.id === task.id ? { ...item, status, order: nextOrder } : item,
    );
    this.updatingTaskId = task.id;
    try {
      await this.taskService.updateTask(task.id, { status, order: nextOrder });
      this.toast.success(`Task moved to ${statusDefinition.name}.`);
    } catch (error) {
      console.error('Unable to update task status:', error);
      this.tasks = previousTasks;
      this.toast.error('Unable to update task status.');
    } finally {
      this.updatingTaskId = null;
    }
  }

  async updateTaskPriority({ task, priority }: TaskPriorityUpdate): Promise<void> {
    if (
      !this.permissions.canEditTasks() ||
      !task.id ||
      task.priority === priority ||
      this.updatingTaskId
    )
      return;
    const previousTasks = this.tasks.map((item) => ({ ...item }));
    this.tasks = this.tasks.map((item) => (item.id === task.id ? { ...item, priority } : item));
    this.updatingTaskId = task.id;
    try {
      await this.taskService.updateTask(task.id, { priority });
      this.toast.success('Task priority updated.');
    } catch (error) {
      console.error('Unable to update task priority:', error);
      this.tasks = previousTasks;
      this.toast.error('Unable to update task priority.');
    } finally {
      this.updatingTaskId = null;
    }
  }

  async updateTaskAssignee({
    task,
    assigneeIds,
  }: {
    task: ProjectTask;
    assigneeIds: string[];
  }): Promise<void> {
    if (!this.permissions.canEditTasks() || !task.id || this.updatingTaskId) return;
    const previousTasks = this.tasks.map((item) => ({ ...item }));
    this.tasks = this.tasks.map((item) =>
      item.id === task.id ? { ...item, assigneeIds, assigneeId: '', assignee: '' } : item,
    );
    this.updatingTaskId = task.id;
    try {
      await this.taskService.updateTask(task.id, {
        assigneeIds,
        assigneeId: '',
        assignee: '',
      });
      this.toast.success(assigneeIds.length ? 'Task assignees updated.' : 'Task unassigned.');
    } catch (error) {
      console.error('Unable to update task assignees:', error);
      this.tasks = previousTasks;
      this.toast.error('Unable to update task assignees.');
    } finally {
      this.updatingTaskId = null;
    }
  }

  private async initializeStatuses(workspaceId: string, initialized = false): Promise<void> {
    if (!workspaceId || this.loadingStatuses) return;
    this.loadingStatuses = true;
    try {
      if (this.permissions.canManageTaskStatuses())
        await this.taskStatusService.ensureDefaultStatuses(workspaceId, initialized);
      this.statusSubscription?.unsubscribe();
      this.statusSubscription = this.taskStatusService.getStatuses(workspaceId).subscribe({
        next: (statuses) => {
          this.statuses = statuses;
          this.loadedStatusWorkspaceId = workspaceId;
          this.loadingStatuses = false;
          if (this.permissions.canEditTasks() && this.migratedStatusWorkspaceId !== workspaceId) {
            this.migratedStatusWorkspaceId = workspaceId;
            void this.migrateLegacyTaskStatuses(workspaceId, statuses);
          }
        },
        error: (error) => {
          console.error('Unable to load task statuses:', error);
          this.statuses = [];
          this.loadingStatuses = false;
          this.toast.error('Unable to load task statuses.');
        },
      });
    } catch (error) {
      console.error('Unable to initialize task statuses:', error);
      this.statuses = [];
      this.loadingStatuses = false;
      this.toast.error('Unable to initialize task statuses.');
    }
  }

  private async migrateLegacyTaskStatuses(
    workspaceId: string,
    statuses: TaskStatusDefinition[],
  ): Promise<void> {
    if (
      !this.permissions.canEditTasks() ||
      !statuses.length ||
      workspaceId !== this.currentWorkspaceId
    )
      return;
    try {
      const migrated = await this.taskService.migrateLegacyStatuses(statuses);
      if (migrated > 0)
        console.info(`Migrated ${migrated} task status${migrated === 1 ? '' : 'es'}.`);
    } catch (error) {
      console.error('Unable to migrate legacy task statuses:', error);
      this.migratedStatusWorkspaceId = '';
      this.toast.error('Unable to migrate existing task statuses.');
    }
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

  private applyOrderChange(change: TaskOrderChange): ProjectTask[] {
    const groups = this.createTaskGroups();
    const source = groups.get(change.previousStatus);
    const destination = groups.get(change.status);
    if (!source || !destination) return this.tasks;
    const sourceIndex = source.findIndex((task) => task.id === change.task.id);
    if (sourceIndex === -1) return this.tasks;
    const [movedTask] = source.splice(sourceIndex, 1);
    movedTask.status = change.status;
    if (this.selectedProjectId === 'all')
      destination.splice(
        Math.max(0, Math.min(change.currentIndex, destination.length)),
        0,
        movedTask,
      );
    else this.insertFilteredTask(destination, movedTask, change.currentIndex);
    this.assignGroupOrder(source);
    if (source !== destination) this.assignGroupOrder(destination);
    const orderedTasks: ProjectTask[] = [];
    this.statuses.forEach((status) => {
      if (!status.id) return;
      orderedTasks.push(...(groups.get(status.id) ?? []));
    });
    const knownStatuses = new Set(this.statuses.map((status) => status.id).filter(Boolean));
    orderedTasks.push(...this.tasks.filter((task) => !knownStatuses.has(task.status)));
    return orderedTasks;
  }

  private insertFilteredTask(
    destination: ProjectTask[],
    movedTask: ProjectTask,
    visibleIndex: number,
  ): void {
    const visible = destination.filter((task) => this.matchesSelectedProject(task));
    if (!visible.length) {
      destination.push(movedTask);
      return;
    }
    if (visibleIndex <= 0) {
      destination.splice(
        Math.max(
          0,
          destination.findIndex((task) => task.id === visible[0].id),
        ),
        0,
        movedTask,
      );
      return;
    }
    if (visibleIndex >= visible.length) {
      destination.splice(
        destination.findIndex((task) => task.id === visible.at(-1)?.id) + 1,
        0,
        movedTask,
      );
      return;
    }
    destination.splice(
      Math.max(
        0,
        destination.findIndex((task) => task.id === visible[visibleIndex].id),
      ),
      0,
      movedTask,
    );
  }

  private matchesSelectedProject(task: ProjectTask): boolean {
    if (this.selectedProjectId === 'all') return true;
    if (this.selectedProjectId === 'none') return !task.projectId;
    return task.projectId === this.selectedProjectId;
  }

  private createTaskGroups(): Map<TaskStatus, ProjectTask[]> {
    const groups = new Map<TaskStatus, ProjectTask[]>();
    this.statuses.forEach((status) => {
      if (!status.id) return;
      groups.set(
        status.id,
        this.tasks.filter((task) => task.status === status.id).map((task) => ({ ...task })),
      );
    });
    return groups;
  }

  private assignGroupOrder(tasks: ProjectTask[]): void {
    tasks.forEach((task, index) => (task.order = index * 1000));
  }

  private sortTasks(tasks: ProjectTask[]): ProjectTask[] {
    return [...tasks].sort((a, b) => {
      const difference =
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
      return difference || this.getCreatedTime(a) - this.getCreatedTime(b);
    });
  }

  private getCreatedTime(task: ProjectTask): number {
    if (!task.createdAt) return 0;
    if (task.createdAt?.toDate) return task.createdAt.toDate().getTime();
    const date = new Date(task.createdAt);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private getSavedView(): TaskView {
    return localStorage.getItem('marvills-task-view') === 'list' ? 'list' : 'board';
  }

  private getSavedProjectFilter(): string {
    return localStorage.getItem('marvills-task-project-filter') || 'all';
  }

  private addFiles(incomingFiles: File[]): void {
    if (!this.canModifyCurrentTask() || this.saving || !incomingFiles.length) return;
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
      if (addedCount >= availableSlots) break;
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
    if (validRequestedCount > availableSlots)
      this.toast.error(
        `Only ${availableSlots} more attachment${availableSlots === 1 ? '' : 's'} can be added.`,
      );
    if (duplicateCount > 0 && !addedCount && !oversizedCount)
      this.toast.error(
        duplicateCount === 1
          ? 'That file is already selected.'
          : 'Those files are already selected.',
      );
  }

  private async performSave(): Promise<void> {
    if (!this.canModifyCurrentTask()) return;
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
    if (!value.status || !this.statuses.some((status) => status.id === value.status)) {
      this.toast.error('Select a valid task status.');
      return;
    }
    const task: Omit<ProjectTask, 'workspaceId'> = {
      title: value.title,
      description: value.description,
      projectId: value.projectId,
      status: value.status,
      priority: value.priority,
      assigneeIds: value.assigneeIds,
    };
    if (value.dueDate) task.dueDate = new Date(value.dueDate);
    if (!this.editingTask) task.order = this.getNextOrder(value.status);
    this.saving = true;
    this.isDraggingFiles = false;
    try {
      let taskId: string;
      if (this.editingTask?.id) {
        taskId = this.editingTask.id;
        if (this.editingTask.status !== value.status) task.order = this.getNextOrder(value.status);
        await this.taskService.updateTask(taskId, task);
      } else {
        taskId = (await this.taskService.createTask(task)).id;
      }
      let finalAttachments = [...existingAttachments];
      if (this.selectedFiles.length)
        finalAttachments.push(
          ...(await this.attachmentService.uploadFiles(
            workspace.id,
            'tasks',
            taskId,
            this.selectedFiles,
            existingAttachments.length,
          )),
        );
      if (this.selectedFiles.length || this.pendingAttachmentDeletions.length)
        await this.taskService.updateTask(taskId, { attachments: finalAttachments });
      for (const attachment of this.pendingAttachmentDeletions) {
        try {
          await this.attachmentService.deleteAttachment(attachment);
        } catch (error) {
          if (!this.isStorageObjectNotFound(error))
            console.error(`Unable to delete attachment "${attachment.name}" from Storage:`, error);
        }
      }
      this.toast.success(
        this.editingTask ? 'Task updated successfully.' : 'Task created successfully.',
      );
      this.resetFormState();
    } catch (error) {
      console.error('Unable to save task:', error);
      this.toast.error(this.getErrorMessage(error));
    } finally {
      this.saving = false;
    }
  }

  private canModifyCurrentTask(): boolean {
    return this.editingTask ? this.permissions.canEditTasks() : this.permissions.canCreateTasks();
  }

  private getNextOrder(status: TaskStatus): number {
    const tasks = this.tasks.filter((task) => task.status === status);
    if (!tasks.length) return 0;
    const orders = tasks
      .map((task) => task.order)
      .filter((order): order is number => typeof order === 'number');
    return orders.length ? Math.max(...orders) + 1000 : tasks.length * 1000;
  }

  private resetFormState(): void {
    this.showForm = false;
    this.editingTask = null;
    this.selectedFiles = [];
    this.pendingAttachmentDeletions = [];
    this.isDraggingFiles = false;
    this.resetConfirmation();
    this.resetTaskForm();
  }

  private resetTaskForm(): void {
    this.taskForm.reset({
      title: '',
      description: '',
      projectId: '',
      status: this.defaultStatusId,
      priority: 'medium',
      assigneeIds: [],
      dueDate: '',
    });
  }

  private resetConfirmation(): void {
    this.confirmationAction = null;
    this.attachmentPendingRemoval = null;
    this.taskPendingDeletion = null;
  }

  private formatDate(value: any): string {
    if (!value) return '';
    const date = value?.toDate ? value.toDate() : new Date(value);
    return date.toISOString().split('T')[0];
  }

  private isStorageObjectNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'storage/object-not-found'
    );
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unable to save task.';
  }
}
