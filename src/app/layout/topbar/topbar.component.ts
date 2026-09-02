// import { Component, inject } from '@angular/core';
// import { ThemeService } from '../../core/services/theme.service';

// @Component({
//   selector: 'app-topbar',
//   standalone: true,
//   templateUrl: './topbar.component.html',
//   styleUrl: './topbar.component.scss',
// })
// export class TopbarComponent {
//   themeService = inject(ThemeService);
// }

import { Component, EventEmitter, inject, Output } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  themeService = inject(ThemeService);

  @Output()
  menuToggle = new EventEmitter<void>();
}
