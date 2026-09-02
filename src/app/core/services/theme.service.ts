import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  theme = signal<ThemeMode>('dark');

  constructor(
    @Inject(DOCUMENT)
    private document: Document,
    @Inject(PLATFORM_ID)
    private platformId: object,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('marvills-theme') as ThemeMode | null;

      this.setTheme(savedTheme || 'dark');
    }
  }

  toggleTheme() {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode) {
    this.theme.set(theme);

    this.document.documentElement.setAttribute('data-theme', theme);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('marvills-theme', theme);
    }
  }
}
