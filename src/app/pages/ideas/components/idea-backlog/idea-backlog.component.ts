import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Idea, IdeaPriority, IdeaStatus } from '../../../../core/models/idea.model';

@Component({
  selector: 'app-idea-backlog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './idea-backlog.component.html',
  styleUrl: './idea-backlog.component.scss',
})
export class IdeaBacklogComponent {
  @Input() ideas: Idea[] = [];
  @Input() totalIdeas = 0;
  @Input() canManage = false;

  @Output() createIdea = new EventEmitter<void>();
  @Output() editIdea = new EventEmitter<Idea>();
  @Output() deleteIdea = new EventEmitter<Idea>();
  @Output() pinIdea = new EventEmitter<Idea>();
  @Output() convertIdea = new EventEmitter<Idea>();
  @Output() openProject = new EventEmitter<Idea>();
  @Output() statusChange = new EventEmitter<{ idea: Idea; status: IdeaStatus }>();
  @Output() priorityChange = new EventEmitter<{ idea: Idea; priority: IdeaPriority }>();

  openCreateIdea(): void {
    if (!this.canManage) return;
    this.createIdea.emit();
  }

  changeStatus(idea: Idea, event: Event): void {
    if (!this.canManage || idea.status === 'converted') return;
    const status = (event.target as HTMLSelectElement).value as IdeaStatus;
    this.statusChange.emit({ idea, status });
  }

  changePriority(idea: Idea, event: Event): void {
    if (!this.canManage) return;
    const priority = (event.target as HTMLSelectElement).value as IdeaPriority;
    this.priorityChange.emit({ idea, priority });
  }

  getStatusLabel(status: IdeaStatus): string {
    const labels: Record<IdeaStatus, string> = {
      idea: 'Idea',
      evaluating: 'Evaluating',
      planned: 'Planned',
      converted: 'Converted',
      archived: 'Archived',
    };
    return labels[status];
  }
}
