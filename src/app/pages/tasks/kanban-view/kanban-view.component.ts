import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CdkDragDrop, CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { Priority, Project } from '../../../core/models/project.model';
import { ProjectTask, TaskStatus } from '../../../core/models/task.model';
import { TaskStatusDefinition } from '../../../core/models/task-status-definition.model';
import { WorkspaceMemberProfile } from '../../../core/models/workspace-member-profile.model';

export interface TaskOrderChange {
  task: ProjectTask;
  previousStatus: TaskStatus;
  status: TaskStatus;
  previousIndex: number;
  currentIndex: number;
}

export interface KanbanTaskStatusUpdate {
  task: ProjectTask;
  status: TaskStatus;
}

export interface KanbanTaskPriorityUpdate {
  task: ProjectTask;
  priority: Priority;
}

export interface KanbanTaskAssigneeUpdate {
  task: ProjectTask;
  assigneeIds: string[];
}

@Component({
  selector: 'app-kanban-view',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './kanban-view.component.html',
  styleUrl: './kanban-view.component.scss',
})
export class KanbanViewComponent {
  @Input() tasks: ProjectTask[] = [];
  @Input() projects: Project[] = [];
  @Input() members: WorkspaceMemberProfile[] = [];
  @Input() statuses: TaskStatusDefinition[] = [];
  @Input() updatingTaskId: string | null = null;
  @Output() edit = new EventEmitter<ProjectTask>();
  @Output() delete = new EventEmitter<ProjectTask>();
  @Output() attachments = new EventEmitter<{ task: ProjectTask; event: MouseEvent }>();
  @Output() orderChange = new EventEmitter<TaskOrderChange>();
  @Output() statusUpdate = new EventEmitter<KanbanTaskStatusUpdate>();
  @Output() priorityUpdate = new EventEmitter<KanbanTaskPriorityUpdate>();
  @Output() assigneeUpdate = new EventEmitter<KanbanTaskAssigneeUpdate>();
  openStatusTaskId: string | null = null;
  openPriorityTaskId: string | null = null;
  openAssigneeTaskId: string | null = null;
  readonly priorities: { value: Priority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  @HostListener('document:click')
  closeInlineMenus(): void {
    this.closeMenus();
  }

  getStatusValue(status: TaskStatusDefinition): TaskStatus {
    return status.id || '';
  }

  getTasksForStatus(status: TaskStatusDefinition): ProjectTask[] {
    return this.getTasksByStatus(this.getStatusValue(status));
  }

  drop(event: CdkDragDrop<ProjectTask[]>, status: TaskStatusDefinition): void {
    const value = this.getStatusValue(status);
    const task = event.item.data as ProjectTask;
    if (!task || task.status !== value) return;
    if (event.previousIndex === event.currentIndex) return;
    this.orderChange.emit({
      task,
      previousStatus: value,
      status: value,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  dragEnded(event: CdkDragEnd, task: ProjectTask): void {
    const cardElement = event.source.element.nativeElement;
    const cardRect = cardElement.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;
    const columns = Array.from(
      document.querySelectorAll<HTMLElement>('.kanban-column[data-status]'),
    );
    if (!columns.length) {
      event.source.reset();
      return;
    }
    let nearestColumn: HTMLElement | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const column of columns) {
      const rect = column.getBoundingClientRect();
      const columnCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenterX - columnCenterX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestColumn = column;
      }
    }
    if (!nearestColumn) {
      event.source.reset();
      return;
    }
    const status = nearestColumn.dataset['status'] as TaskStatus;
    if (!status) {
      event.source.reset();
      return;
    }
    const targetTasks = this.getTasksByStatus(status);
    let currentIndex = targetTasks.length;
    const targetCards = Array.from(
      nearestColumn.querySelectorAll<HTMLElement>('.task-card'),
    ).filter((element) => element !== cardElement);
    for (let index = 0; index < targetCards.length; index++) {
      const rect = targetCards[index].getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      if (cardCenterY < centerY) {
        currentIndex = index;
        break;
      }
    }
    const previousStatus = task.status;
    const previousTasks = this.getTasksByStatus(previousStatus);
    const previousIndex = previousTasks.findIndex((item) => item.id === task.id);
    event.source.reset();
    if (previousStatus === status && previousIndex === currentIndex) return;
    if (previousStatus === status && currentIndex > previousIndex) currentIndex--;
    currentIndex = Math.max(
      0,
      Math.min(
        currentIndex,
        previousStatus === status ? Math.max(0, targetTasks.length - 1) : targetTasks.length,
      ),
    );
    this.orderChange.emit({
      task,
      previousStatus,
      status,
      previousIndex,
      currentIndex,
    });
  }

  toggleStatusMenu(task: ProjectTask, event: MouseEvent): void {
    event.stopPropagation();
    if (!task.id || this.updatingTaskId === task.id) return;
    this.openPriorityTaskId = null;
    this.openAssigneeTaskId = null;
    this.openStatusTaskId = this.openStatusTaskId === task.id ? null : task.id;
  }

  selectStatus(task: ProjectTask, status: TaskStatusDefinition, event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenus();
    const value = this.getStatusValue(status);
    if (value === task.status || this.updatingTaskId === task.id) return;
    this.statusUpdate.emit({ task, status: value });
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
    return this.getAssignees(task).slice(0, 5);
  }

  getAdditionalAssigneeCount(task: ProjectTask): number {
    return Math.max(0, this.getAssignees(task).length - 5);
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

  getStatusLabel(status: TaskStatus): string {
    const definition = this.statuses.find((item) => this.getStatusValue(item) === status);
    return definition?.name || status;
  }

  getStatusColor(status: TaskStatus): string {
    return this.statuses.find((item) => this.getStatusValue(item) === status)?.color || '#7786a6';
  }

  getTaskDueDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
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
