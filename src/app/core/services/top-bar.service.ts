import { Injectable, signal } from '@angular/core';

export interface TopbarProjectContext {
  name: string;
  clientName: string;
  status: string;
  priority: string;
}

export interface TopbarPageAction {
  label: string;
  icon?: string;
  route?: string;
  handler?: () => void;
}

export interface TopbarPageContext {
  title: string;
  description: string;
  icon?: string;
  action?: TopbarPageAction;
}

@Injectable({
  providedIn: 'root',
})
export class TopbarService {
  readonly projectContext = signal<TopbarProjectContext | null>(null);
  readonly pageContext = signal<TopbarPageContext | null>(null);

  setProjectContext(context: TopbarProjectContext): void {
    this.pageContext.set(null);
    this.projectContext.set(context);
  }

  clearProjectContext(): void {
    this.projectContext.set(null);
  }

  setPageContext(context: TopbarPageContext): void {
    this.projectContext.set(null);
    this.pageContext.set(context);
  }

  clearPageContext(): void {
    this.pageContext.set(null);
  }

  runPageAction(): void {
    this.pageContext()?.action?.handler?.();
  }
}
