import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Priority, Project } from '../../../core/models/project.model';
import { ProjectTask, TaskStatus } from '../../../core/models/task.model';
import { TaskStatusDefinition } from '../../../core/models/task-status-definition.model';
import { WorkspaceMemberProfile } from '../../../core/models/workspace-member-profile.model';
import { TaskOrderChange } from '../kanban-view/kanban-view.component';

interface TaskGroup {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: ProjectTask[];
}

export interface TaskStatusUpdate {
  task: ProjectTask;
  status: TaskStatus;
}

export interface TaskPriorityUpdate {
  task: ProjectTask;
  priority: Priority;
}

export interface TaskAssigneeUpdate {
  task: ProjectTask;
  assigneeIds: string[];
}

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './list-view.component.html',
  styleUrl: './list-view.component.scss',
})
export class ListViewComponent {
  @Input() tasks: ProjectTask[] = [];
  @Input() projects: Project[] = [];
  @Input() statuses: TaskStatusDefinition[] = [];
  @Input() updatingTaskId: string | null = null;
  @Input() members: WorkspaceMemberProfile[] = [];
  @Output() assigneeUpdate = new EventEmitter<TaskAssigneeUpdate>();
  @Output() edit = new EventEmitter<ProjectTask>();
  @Output() delete = new EventEmitter<ProjectTask>();
  @Output() attachments = new EventEmitter<{ task: ProjectTask; event: MouseEvent }>();
  @Output() orderChange = new EventEmitter<TaskOrderChange>();
  @Output() statusUpdate = new EventEmitter<TaskStatusUpdate>();
  @Output() priorityUpdate = new EventEmitter<TaskPriorityUpdate>();

  collapsedGroups = new Set<TaskStatus>();
  openStatusTaskId: string | null = null;
  openPriorityTaskId: string | null = null;
  openAssigneeTaskId: string | null = null;

  readonly priorities: { value: Priority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  get connectedDropLists(): string[] {
    return this.statuses
      .filter((status) => !!status.id)
      .map((status) => this.getDropListId(status.id!));
  }

  get groups(): TaskGroup[] {
    return this.statuses
      .filter((status): status is TaskStatusDefinition & { id: string } => !!status.id)
      .map((status) => ({
        status: status.id,
        label: status.name,
        color: status.color,
        tasks: this.getTasksByStatus(status.id),
      }));
  }

  @HostListener('document:click')
  closeInlineMenus(): void {
    this.closeMenus();
  }

  toggleGroup(status: TaskStatus): void {
    if (this.collapsedGroups.has(status)) {
      this.collapsedGroups.delete(status);
      return;
    }
    this.collapsedGroups.add(status);
  }

  isCollapsed(status: TaskStatus): boolean {
    return this.collapsedGroups.has(status);
  }

  getDropListId(status: TaskStatus): string {
    return `list-status-${status}`;
  }

  drop(event: CdkDragDrop<ProjectTask[]>, status: TaskStatus): void {
    const task = event.item.data as ProjectTask;
    if (!task) return;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex)
      return;
    this.orderChange.emit({
      task,
      previousStatus: task.status,
      status,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  toggleStatusMenu(task: ProjectTask, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.id || this.updatingTaskId === task.id) return;
    this.openPriorityTaskId = null;
    this.openAssigneeTaskId = null;
    this.openStatusTaskId = this.openStatusTaskId === task.id ? null : task.id;
  }

  selectStatus(task: ProjectTask, status: TaskStatus, event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenus();
    if (status === task.status || this.updatingTaskId === task.id) return;
    this.statusUpdate.emit({ task, status });
  }

  togglePriorityMenu(task: ProjectTask, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.id || this.updatingTaskId === task.id) return;
    this.openStatusTaskId = null;
    this.openAssigneeTaskId = null;
    this.openPriorityTaskId = this.openPriorityTaskId === task.id ? null : task.id;
  }

  selectPriority(task: ProjectTask, priority: Priority, event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenus();
    if (priority === task.priority || this.updatingTaskId === task.id) return;
    this.priorityUpdate.emit({ task, priority });
  }

  toggleAssigneeMenu(task: ProjectTask, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.id || this.updatingTaskId === task.id) return;
    this.openStatusTaskId = null;
    this.openPriorityTaskId = null;
    this.openAssigneeTaskId = this.openAssigneeTaskId === task.id ? null : task.id;
  }

  toggleTaskAssignee(task: ProjectTask, assigneeId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.id || this.updatingTaskId === task.id) return;
    const currentIds = this.getTaskAssigneeIds(task);
    const assigneeIds = currentIds.includes(assigneeId)
      ? currentIds.filter((id) => id !== assigneeId)
      : [...currentIds, assigneeId];
    this.assigneeUpdate.emit({ task, assigneeIds });
  }

  clearAssignees(task: ProjectTask, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.id || this.updatingTaskId === task.id || !this.getTaskAssigneeIds(task).length)
      return;
    this.assigneeUpdate.emit({ task, assigneeIds: [] });
  }

  getAssignees(task: ProjectTask): WorkspaceMemberProfile[] {
    return this.getTaskAssigneeIds(task)
      .map((id) => this.members.find((member) => member.userId === id))
      .filter((member): member is WorkspaceMemberProfile => !!member);
  }

  getVisibleAssignees(task: ProjectTask): WorkspaceMemberProfile[] {
    return this.getAssignees(task).slice(0, 3);
  }

  getAdditionalAssigneeCount(task: ProjectTask): number {
    return Math.max(0, this.getAssignees(task).length - 3);
  }

  getAssigneeNames(task: ProjectTask): string {
    const assignees = this.getAssignees(task);
    if (!assignees.length) return task.assignee || 'Unassigned';
    return assignees.map((member) => this.getMemberName(member)).join(', ');
  }

  getAssigneeCount(task: ProjectTask): number {
    return this.getTaskAssigneeIds(task).length;
  }

  isAssigned(task: ProjectTask, userId: string): boolean {
    return this.getTaskAssigneeIds(task).includes(userId);
  }

  getMemberName(member: WorkspaceMemberProfile): string {
    return member.displayName?.trim() || member.email;
  }

  getMemberInitial(member: WorkspaceMemberProfile): string {
    return this.getMemberName(member).charAt(0).toUpperCase();
  }

  editTask(task: ProjectTask, event?: MouseEvent): void {
    event?.stopPropagation();
    this.edit.emit(task);
  }

  deleteTask(task: ProjectTask, event?: MouseEvent): void {
    event?.stopPropagation();
    this.delete.emit(task);
  }

  openAttachments(task: ProjectTask, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.attachments?.length) return;
    this.attachments.emit({ task, event });
  }

  getProjectName(projectId?: string): string {
    if (!projectId) return 'No Project';
    return this.projects.find((project) => project.id === projectId)?.name || 'Project';
  }

  getStatus(statusId: TaskStatus): TaskStatusDefinition | undefined {
    return this.statuses.find((status) => status.id === statusId);
  }

  getStatusLabel(statusId: TaskStatus): string {
    return this.getStatus(statusId)?.name || 'Unknown Status';
  }

  getStatusColor(statusId: TaskStatus): string {
    return this.getStatus(statusId)?.color || '#7786a6';
  }

  isCompletedStatus(statusId: TaskStatus): boolean {
    return this.getStatus(statusId)?.isCompleted ?? false;
  }

  getTaskDueDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  isOverdue(task: ProjectTask): boolean {
    if (!task.dueDate || this.isCompletedStatus(task.status)) return false;
    const dueDate = this.getTaskDueDate(task.dueDate);
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
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
    return member ? [member.userId] : [];
  }

  private closeMenus(): void {
    this.openStatusTaskId = null;
    this.openPriorityTaskId = null;
    this.openAssigneeTaskId = null;
  }

  private getTasksByStatus(status: TaskStatus): ProjectTask[] {
    return this.tasks
      .filter((task) => task.status === status)
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  }
}
