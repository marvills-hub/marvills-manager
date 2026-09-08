import { Component, EventEmitter, inject, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { TopbarService } from '../../core/services/top-bar.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  themeService = inject(ThemeService);
  topbarService = inject(TopbarService);

  @Output()
  menuToggle = new EventEmitter<void>();
}
