import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { ProjectTask } from '../../core/models/task.model';
import { TimeEntry } from '../../core/models/time-entry.model';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import { TimeTrackingService } from '../../core/services/time-tracking.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './time-tracking.component.html',
  styleUrl: './time-tracking.component.scss',
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private timeTrackingService = inject(TimeTrackingService);
  private subscriptions = new Subscription();
  private entriesSubscription?: Subscription;
  private clock?: ReturnType<typeof setInterval>;
  projects: Project[] = [];
  tasks: ProjectTask[] = [];
  entries: TimeEntry[] = [];
  selectedProjectId = '';
  selectedTaskId = '';
  description = '';
  loading = true;
  saving = false;
  now = Date.now();

  ngOnInit(): void {
    this.subscriptions.add(
      this.projectService.getProjects().subscribe({
        next: (projects) => {
          this.projects = projects;
          this.loading = false;
          if (
            this.selectedProjectId &&
            !projects.some((project) => project.id === this.selectedProjectId)
          ) {
            this.selectedProjectId = '';
            this.selectedTaskId = '';
          }
        },
        error: (error) => {
          console.error('Unable to load projects for time tracking:', error);
          this.loading = false;
        },
      }),
    );
    this.subscriptions.add(
      this.taskService.getTasks().subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.loading = false;
          if (this.selectedTaskId && !tasks.some((task) => task.id === this.selectedTaskId)) {
            this.selectedTaskId = '';
          }
        },
        error: (error) => {
          console.error('Unable to load tasks for time tracking:', error);
          this.loading = false;
        },
      }),
    );
    this.subscriptions.add(
      this.workspaceService.currentWorkspace$.subscribe((workspace) => {
        this.entriesSubscription?.unsubscribe();
        this.entries = [];
        const user = this.authService.currentUser;
        if (!workspace?.id || !user?.uid) return;
        this.entriesSubscription = this.timeTrackingService
          .getEntries(workspace.id, user.uid)
          .subscribe({
            next: (entries) => {
              this.entries = [...entries].sort(
                (a, b) => b.startedAt.toMillis() - a.startedAt.toMillis(),
              );
            },
            error: (error) => {
              console.error('Unable to load time entries:', error);
            },
          });
      }),
    );
    this.clock = setInterval(() => (this.now = Date.now()), 1000);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.entriesSubscription?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
  }

  get activeEntry(): TimeEntry | undefined {
    return this.entries.find((entry) => !entry.endedAt);
  }

  get filteredTasks(): ProjectTask[] {
    if (!this.selectedProjectId) return this.tasks;
    return this.tasks.filter((task) => task.projectId === this.selectedProjectId);
  }

  get todaySeconds(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.entries.reduce((total, entry) => {
      if (entry.startedAt.toDate().getTime() < today.getTime()) return total;
      return total + this.getEntrySeconds(entry);
    }, 0);
  }

  get weekSeconds(): number {
    const start = new Date();
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return this.entries.reduce((total, entry) => {
      if (entry.startedAt.toDate().getTime() < start.getTime()) return total;
      return total + this.getEntrySeconds(entry);
    }, 0);
  }

  get totalSeconds(): number {
    return this.entries.reduce((total, entry) => total + this.getEntrySeconds(entry), 0);
  }

  projectChanged(): void {
    if (
      this.selectedTaskId &&
      !this.filteredTasks.some((task) => task.id === this.selectedTaskId)
    ) {
      this.selectedTaskId = '';
    }
  }

  async startTimer(): Promise<void> {
    if (this.saving || this.activeEntry) return;
    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;
    if (!workspace?.id || !user?.uid || !this.selectedTaskId) return;
    const task = this.tasks.find((item) => item.id === this.selectedTaskId);
    if (!task) return;
    this.saving = true;
    try {
      await this.timeTrackingService.startTimer({
        workspaceId: workspace.id,
        userId: user.uid,
        projectId: task.projectId || this.selectedProjectId,
        taskId: task.id || '',
        description: this.description.trim(),
      });
      this.description = '';
    } finally {
      this.saving = false;
    }
  }

  async stopTimer(): Promise<void> {
    if (!this.activeEntry || this.saving) return;
    this.saving = true;
    try {
      await this.timeTrackingService.stopTimer(this.activeEntry);
    } finally {
      this.saving = false;
    }
  }

  async deleteEntry(entry: TimeEntry): Promise<void> {
    if (!entry.id || !entry.endedAt) return;
    await this.timeTrackingService.deleteEntry(entry.id);
  }

  getEntrySeconds(entry: TimeEntry): number {
    if (entry.endedAt) {
      return (
        entry.durationSeconds ||
        Math.max(0, Math.floor((entry.endedAt.toMillis() - entry.startedAt.toMillis()) / 1000))
      );
    }
    return Math.max(0, Math.floor((this.now - entry.startedAt.toMillis()) / 1000));
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getProjectName(projectId: string): string {
    return this.projects.find((project) => project.id === projectId)?.name || 'No Project';
  }

  getTaskName(taskId: string): string {
    return this.tasks.find((task) => task.id === taskId)?.title || 'Task';
  }
}
