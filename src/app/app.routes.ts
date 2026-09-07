import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
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
        path: 'clients',
        loadComponent: () =>
          import('./pages/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'workspaces',
        loadComponent: () =>
          import('./pages/workspaces/workspaces.component').then((m) => m.WorkspacesComponent),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./pages/members/members.component').then((m) => m.MembersComponent),
      },
      {
        path: 'invitations',
        loadComponent: () =>
          import('./pages/invitations/invitations.component').then((m) => m.InvitationsComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

// import { Routes } from '@angular/router';
// import { AppLayoutComponent } from './layout/app-layout/app-layout.component';

// export const routes: Routes = [
//   {
//     path: '',
//     component: AppLayoutComponent,
//     children: [
//       {
//         path: '',
//         redirectTo: 'dashboard',
//         pathMatch: 'full',
//       },
//       {
//         path: 'dashboard',
//         loadComponent: () =>
//           import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
//       },
//       {
//         path: 'projects',
//         loadComponent: () =>
//           import('./pages/projects/projects.component').then((m) => m.ProjectsComponent),
//       },
//       {
//         path: 'tasks',
//         loadComponent: () => import('./pages/tasks/tasks.component').then((m) => m.TasksComponent),
//       },
//       {
//         path: 'clients',
//         loadComponent: () =>
//           import('./pages/clients/clients.component').then((m) => m.ClientsComponent),
//       },
//     ],
//   },
// ];
