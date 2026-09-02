import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { ProjectTask } from '../../core/models/task.model';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private projectService = inject(ProjectService);

  private taskService = inject(TaskService);

  projects: Project[] = [];
  tasks: ProjectTask[] = [];

  totalProjects = 0;
  activeProjects = 0;
  completedTasks = 0;
  inProgressTasks = 0;
  overdueTasks = 0;

  ngOnInit(): void {
    combineLatest([this.projectService.getProjects(), this.taskService.getTasks()]).subscribe(
      ([projects, tasks]) => {
        this.projects = projects;

        this.tasks = tasks;

        this.calculateStats();
      },
    );
  }

  calculateStats(): void {
    this.totalProjects = this.projects.length;

    this.activeProjects = this.projects.filter((project) => project.status === 'active').length;

    this.completedTasks = this.tasks.filter((task) => task.status === 'completed').length;

    this.inProgressTasks = this.tasks.filter((task) => task.status === 'in-progress').length;

    const now = new Date();

    this.overdueTasks = this.tasks.filter((task) => {
      if (!task.dueDate || task.status === 'completed') {
        return false;
      }

      return this.convertDate(task.dueDate) < now;
    }).length;
  }

  get recentProjects(): Project[] {
    return this.projects.filter((project) => project.status !== 'completed').slice(0, 5);
  }

  get activeTasks(): ProjectTask[] {
    return this.tasks.filter((task) => task.status !== 'completed').slice(0, 6);
  }

  convertDate(value: any): Date {
    if (value?.toDate) {
      return value.toDate();
    }

    return new Date(value);
  }
}
