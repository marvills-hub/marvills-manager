import { Injectable, signal } from '@angular/core';

export interface TopbarProjectContext {
  name: string;
  clientName: string;
  status: string;
  priority: string;
}

@Injectable({
  providedIn: 'root',
})
export class TopbarService {
  readonly projectContext = signal<TopbarProjectContext | null>(null);

  setProjectContext(context: TopbarProjectContext): void {
    this.projectContext.set(context);
  }

  clearProjectContext(): void {
    this.projectContext.set(null);
  }
}
