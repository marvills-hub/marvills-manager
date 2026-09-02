// import { Component } from '@angular/core';
// import { RouterOutlet } from '@angular/router';
// import { SidebarComponent } from '../sidebar/sidebar.component';
// import { TopbarComponent } from '../topbar/topbar.component';

// @Component({
//   selector: 'app-app-layout',
//   standalone: true,
//   imports: [RouterOutlet, SidebarComponent, TopbarComponent],
//   templateUrl: './app-layout.component.html',
//   styleUrl: './app-layout.component.scss',
// })
// export class AppLayoutComponent {}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { ToastComponent } from '../../shared/toast/toast.component';

@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ToastComponent],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  sidebarOpen = false;
  currentYear = new Date().getFullYear();
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }
}
