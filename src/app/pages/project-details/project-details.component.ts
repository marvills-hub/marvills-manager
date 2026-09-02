import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { ProjectTask } from '../../core/models/task.model';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-details.component.html',
  styleUrl: './project-details.component.scss',
})
export class ProjectDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  project: Project | null = null;
  tasks: ProjectTask[] = [];
  loading = true;
  activeTab: 'overview' | 'tasks' = 'overview';

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('id');

    if (!projectId) {
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
      },
      error: () => {
        this.loading = false;
      },
    });
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
}
