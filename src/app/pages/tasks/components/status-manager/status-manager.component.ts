import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { TaskStatusDefinition } from '../../../../core/models/task-status-definition.model';
import { TaskStatusService } from '../../../../core/services/task-status.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-status-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './status-manager.component.html',
  styleUrl: './status-manager.component.scss',
})
export class StatusManagerComponent {
  private readonly statusService = inject(TaskStatusService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) workspaceId = '';
  @Input() statuses: TaskStatusDefinition[] = [];
  @Output() close = new EventEmitter<void>();

  newStatusName = '';
  newStatusColor = '#5e80ff';
  adding = false;
  savingId: string | null = null;
  deletingId: string | null = null;
  editingId: string | null = null;
  editingName = '';

  async addStatus(): Promise<void> {
    const name = this.newStatusName.trim();
    if (!name || !this.workspaceId || this.adding) return;
    this.adding = true;
    try {
      await this.statusService.createStatus(
        this.workspaceId,
        name,
        this.newStatusColor,
        this.statuses.length,
      );
      this.newStatusName = '';
      this.newStatusColor = '#5e80ff';
      this.toast.success('Status created.');
    } catch (error) {
      console.error('Unable to create status:', error);
      this.toast.error('Unable to create status.');
    } finally {
      this.adding = false;
    }
  }

  startEdit(status: TaskStatusDefinition): void {
    if (!status.id) return;
    this.editingId = status.id;
    this.editingName = status.name;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editingName = '';
  }

  async saveName(status: TaskStatusDefinition): Promise<void> {
    const name = this.editingName.trim();
    if (!status.id || !name || this.savingId) return;
    if (name === status.name) {
      this.cancelEdit();
      return;
    }
    this.savingId = status.id;
    try {
      await this.statusService.updateStatus(status.id, { name });
      this.cancelEdit();
      this.toast.success('Status renamed.');
    } catch (error) {
      console.error('Unable to rename status:', error);
      this.toast.error('Unable to rename status.');
    } finally {
      this.savingId = null;
    }
  }

  async updateColor(status: TaskStatusDefinition, color: string): Promise<void> {
    if (!status.id || this.savingId || color === status.color) return;
    this.savingId = status.id;
    try {
      await this.statusService.updateStatus(status.id, { color });
    } catch (error) {
      console.error('Unable to update status color:', error);
      this.toast.error('Unable to update status color.');
    } finally {
      this.savingId = null;
    }
  }

  async setCompleted(status: TaskStatusDefinition): Promise<void> {
    if (!status.id || status.isCompleted || this.savingId) return;
    this.savingId = status.id;
    try {
      const updates = this.statuses.filter(
        (item) => item.id && item.id !== status.id && item.isCompleted,
      );
      await Promise.all([
        ...updates.map((item) => this.statusService.updateStatus(item.id!, { isCompleted: false })),
        this.statusService.updateStatus(status.id, { isCompleted: true }),
      ]);
      this.toast.success(`${status.name} is now the completed status.`);
    } catch (error) {
      console.error('Unable to update completed status:', error);
      this.toast.error('Unable to update completed status.');
    } finally {
      this.savingId = null;
    }
  }

  async deleteStatus(status: TaskStatusDefinition): Promise<void> {
    if (!status.id || this.deletingId || this.statuses.length <= 1) return;
    if (!window.confirm(`Delete "${status.name}"?`)) return;
    this.deletingId = status.id;
    try {
      await this.statusService.deleteStatus(status.id);
      this.toast.success('Status deleted.');
    } catch (error) {
      console.error('Unable to delete status:', error);
      this.toast.error('Unable to delete status.');
    } finally {
      this.deletingId = null;
    }
  }

  async dropStatus(event: CdkDragDrop<TaskStatusDefinition[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const previous = [...this.statuses];
    const reordered = [...this.statuses];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.statuses = reordered;
    try {
      await this.statusService.reorderStatuses(reordered);
    } catch (error) {
      console.error('Unable to reorder statuses:', error);
      this.statuses = previous;
      this.toast.error('Unable to reorder statuses.');
    }
  }
}
