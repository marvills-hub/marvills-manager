import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'login',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/projects/projects.component').then((m) => m.ProjectsComponent),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./pages/project-details/project-details.component').then(
            (m) => m.ProjectDetailsComponent,
          ),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./pages/tasks/tasks.component').then((m) => m.TasksComponent),
      },
      {
        path: 'ideas',
        loadComponent: () => import('./pages/ideas/ideas.component').then((m) => m.IdeasComponent),
      },
      {
        path: 'diagrams',
        loadComponent: () =>
          import('./pages/diagrams/diagrams.component').then((m) => m.DiagramsComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'clients',
        redirectTo: 'users',
        pathMatch: 'full',
      },
      {
        path: 'members',
        redirectTo: 'users',
        pathMatch: 'full',
      },
      {
        path: 'invitations',
        loadComponent: () =>
          import('./pages/invitations/invitations.component').then((m) => m.InvitationsComponent),
      },
      {
        path: 'workspaces',
        loadComponent: () =>
          import('./pages/workspaces/workspaces.component').then((m) => m.WorkspacesComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
