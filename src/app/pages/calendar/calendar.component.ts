import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { ProjectTask } from '../../core/models/task.model';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import { TopbarService } from '../../core/services/top-bar.service';

type CalendarItemType = 'project-start' | 'project-due' | 'task-due';
interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  date: Date;
  projectId?: string;
  status?: string;
  priority?: string;
}
interface CalendarDay {
  date: Date;
  day: number;
  currentMonth: boolean;
  today: boolean;
  items: CalendarItem[];
}
@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private topbarService = inject(TopbarService);
  private router = inject(Router);
  private subscription?: Subscription;
  projects: Project[] = [];
  tasks: ProjectTask[] = [];
  viewDate = new Date();
  selectedDate = new Date();
  selectedType: 'all' | CalendarItemType = 'all';
  loading = true;
  readonly weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  constructor() {
    this.viewDate = this.startOfDay(new Date());
    this.selectedDate = this.startOfDay(new Date());
    this.topbarService.setPageContext({
      title: 'Calendar',
      icon: 'fa-regular fa-calendar',
    });
  }
  ngOnInit(): void {
    this.subscription = combineLatest([
      this.projectService.getProjects(),
      this.taskService.getTasks(),
    ]).subscribe({
      next: ([projects, tasks]) => {
        this.projects = projects;
        this.tasks = tasks;
        this.loading = false;
      },
      error: () => {
        this.projects = [];
        this.tasks = [];
        this.loading = false;
      },
    });
  }
  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.topbarService.clearPageContext();
  }
  get monthLabel(): string {
    return this.viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  get days(): CalendarDay[] {
    const first = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const start = new Date(first);
    const weekday = (first.getDay() + 6) % 7;
    start.setDate(first.getDate() - weekday);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date,
        day: date.getDate(),
        currentMonth: date.getMonth() === this.viewDate.getMonth(),
        today: this.sameDate(date, new Date()),
        items: this.getItemsForDate(date),
      };
    });
  }
  get selectedItems(): CalendarItem[] {
    return this.getItemsForDate(this.selectedDate);
  }
  get upcomingItems(): CalendarItem[] {
    const today = this.startOfDay(new Date()).getTime();
    return this.allItems
      .filter((item) => item.date.getTime() >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 6);
  }
  get allItems(): CalendarItem[] {
    const items: CalendarItem[] = [];
    for (const project of this.projects) {
      const startDate = this.toDate(project.startDate);
      const dueDate = this.toDate(project.dueDate);
      if (startDate)
        items.push({
          id: `project-start-${project.id}`,
          type: 'project-start',
          title: project.name,
          date: this.startOfDay(startDate),
          projectId: project.id,
          status: project.status,
          priority: project.priority,
        });
      if (dueDate)
        items.push({
          id: `project-due-${project.id}`,
          type: 'project-due',
          title: project.name,
          date: this.startOfDay(dueDate),
          projectId: project.id,
          status: project.status,
          priority: project.priority,
        });
    }
    for (const task of this.tasks) {
      const dueDate = this.toDate(task.dueDate);
      if (!dueDate) continue;
      items.push({
        id: `task-due-${task.id}`,
        type: 'task-due',
        title: task.title,
        date: this.startOfDay(dueDate),
        projectId: task.projectId,
        status: task.status,
        priority: task.priority,
      });
    }
    return items;
  }
  previousMonth(): void {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
  }
  nextMonth(): void {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
  }
  goToday(): void {
    const today = this.startOfDay(new Date());
    this.viewDate = today;
    this.selectedDate = today;
  }
  selectDay(day: CalendarDay): void {
    this.selectedDate = this.startOfDay(day.date);
    if (!day.currentMonth) this.viewDate = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
  }
  setType(type: 'all' | CalendarItemType): void {
    this.selectedType = type;
  }
  openItem(item: CalendarItem): void {
    if (item.type === 'task-due') {
      void this.router.navigate(['/tasks'], {
        queryParams: item.projectId ? { project: item.projectId } : {},
      });
      return;
    }
    if (item.projectId) void this.router.navigate(['/projects', item.projectId]);
  }
  getProjectName(projectId?: string): string {
    if (!projectId) return 'No Project';
    return this.projects.find((project) => project.id === projectId)?.name || 'Project';
  }
  getTypeLabel(type: CalendarItemType): string {
    if (type === 'project-start') return 'Project Start';
    if (type === 'project-due') return 'Project Due';
    return 'Task Due';
  }
  getTypeIcon(type: CalendarItemType): string {
    if (type === 'project-start') return 'fa-solid fa-play';
    if (type === 'project-due') return 'fa-regular fa-flag';
    return 'fa-regular fa-square-check';
  }
  get selectedDateLabel(): string {
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }
  private getItemsForDate(date: Date): CalendarItem[] {
    return this.allItems
      .filter((item) => this.sameDate(item.date, date))
      .filter((item) => this.selectedType === 'all' || item.type === this.selectedType)
      .sort((a, b) => this.itemOrder(a.type) - this.itemOrder(b.type));
  }
  private itemOrder(type: CalendarItemType): number {
    if (type === 'project-start') return 0;
    if (type === 'project-due') return 1;
    return 2;
  }
  private toDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const date = value instanceof Date ? new Date(value) : new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  private startOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }
  private sameDate(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
