import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, combineLatest } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { ProjectTask } from '../../core/models/task.model';
import { TimeEntry } from '../../core/models/time-entry.model';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import { TimeTrackingService } from '../../core/services/time-tracking.service';
import { WorkspaceService } from '../../core/services/workspace.service';

interface ProjectReport {
  project: Project;
  totalTasks: number;
  doneTasks: number;
  progress: number;
  overdueTasks: number;
  trackedSeconds: number;
}

interface StatusReport {
  label: string;
  count: number;
  percent: number;
  className: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private timeTrackingService = inject(TimeTrackingService);
  private subscription?: Subscription;
  projects: Project[] = [];
  tasks: ProjectTask[] = [];
  timeEntries: TimeEntry[] = [];
  loading = true;

  ngOnInit(): void {
    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;
    if (!workspace?.id || !user?.uid) {
      this.loading = false;
      return;
    }
    this.subscription = combineLatest([
      this.projectService.getProjects(),
      this.taskService.getTasks(),
      this.timeTrackingService.getEntries(workspace.id, user.uid),
    ]).subscribe({
      next: ([projects, tasks, timeEntries]) => {
        this.projects = projects;
        this.tasks = tasks;
        this.timeEntries = timeEntries;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get totalProjects(): number {
    return this.projects.length;
  }

  get totalTasks(): number {
    return this.tasks.length;
  }

  get completedTasks(): number {
    return this.tasks.filter((task) => this.isDone(task.status)).length;
  }

  get completionRate(): number {
    if (!this.totalTasks) return 0;
    return Math.round((this.completedTasks / this.totalTasks) * 100);
  }

  get overdueTasks(): ProjectTask[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.tasks
      .filter((task) => {
        if (this.isDone(task.status)) return false;
        const dueDate = this.toDate(task.dueDate);
        return !!dueDate && dueDate.getTime() < now.getTime();
      })
      .sort(
        (a, b) =>
          (this.toDate(a.dueDate)?.getTime() || 0) - (this.toDate(b.dueDate)?.getTime() || 0),
      );
  }

  get totalTrackedSeconds(): number {
    return this.timeEntries.reduce((total, entry) => total + this.entrySeconds(entry), 0);
  }

  get completedProjects(): number {
    return this.projectReports.filter((item) => item.progress === 100 && item.totalTasks > 0)
      .length;
  }

  get projectReports(): ProjectReport[] {
    return this.projects
      .map((project) => {
        const projectTasks = this.tasks.filter((task) => task.projectId === project.id);
        const doneTasks = projectTasks.filter((task) => this.isDone(task.status)).length;
        const overdueTasks = projectTasks.filter((task) =>
          this.overdueTasks.some((overdue) => overdue.id === task.id),
        ).length;
        const trackedSeconds = this.timeEntries
          .filter((entry) => entry.projectId === project.id)
          .reduce((total, entry) => total + this.entrySeconds(entry), 0);
        return {
          project,
          totalTasks: projectTasks.length,
          doneTasks,
          progress: projectTasks.length ? Math.round((doneTasks / projectTasks.length) * 100) : 0,
          overdueTasks,
          trackedSeconds,
        };
      })
      .sort((a, b) => b.progress - a.progress);
  }

  get statusReports(): StatusReport[] {
    const total = this.tasks.length || 1;
    const groups = [
      { label: 'To Do', matcher: ['todo', 'to do'], className: 'todo' },
      {
        label: 'In Progress',
        matcher: ['in-progress', 'in progress', 'inprogress'],
        className: 'progress',
      },
      { label: 'Review', matcher: ['review'], className: 'review' },
      { label: 'Done', matcher: ['done', 'completed', 'complete'], className: 'done' },
    ];
    return groups.map((group) => {
      const count = this.tasks.filter((task) =>
        group.matcher.includes(this.normalize(task.status)),
      ).length;
      return {
        label: group.label,
        count,
        percent: Math.round((count / total) * 100),
        className: group.className,
      };
    });
  }

  get topProjectsByTime(): ProjectReport[] {
    return [...this.projectReports]
      .filter((item) => item.trackedSeconds > 0)
      .sort((a, b) => b.trackedSeconds - a.trackedSeconds)
      .slice(0, 5);
  }

  get maxProjectSeconds(): number {
    return Math.max(...this.topProjectsByTime.map((item) => item.trackedSeconds), 1);
  }

  getProjectName(projectId?: string): string {
    if (!projectId) return 'No Project';
    return this.projects.find((project) => project.id === projectId)?.name || 'Project';
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (!hours) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }

  formatDate(value: any): string {
    const date = this.toDate(value);
    return date
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'No date';
  }

  private entrySeconds(entry: TimeEntry): number {
    if (entry.durationSeconds) return entry.durationSeconds;
    if (!entry.endedAt)
      return Math.max(0, Math.floor((Date.now() - entry.startedAt.toMillis()) / 1000));
    return Math.max(0, Math.floor((entry.endedAt.toMillis() - entry.startedAt.toMillis()) / 1000));
  }

  private isDone(status?: string): boolean {
    return ['done', 'completed', 'complete'].includes(this.normalize(status));
  }

  private normalize(value?: string): string {
    return (value || '').trim().toLowerCase();
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const date = value instanceof Date ? new Date(value) : new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
}
