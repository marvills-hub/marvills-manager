import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  Diagram,
  DiagramConnection,
  DiagramNode,
  DiagramType,
} from '../../core/models/diagram.model';
import { Project } from '../../core/models/project.model';
import { DIAGRAM_TEMPLATES, DiagramTemplate } from '../../core/constants/diagram-template.constant';
import { DiagramService } from '../../core/services/diagram.service';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';
import { DiagramEditorComponent } from './components/diagram-editor/diagram-editor.component';

@Component({
  selector: 'app-diagrams',
  standalone: true,
  imports: [CommonModule, FormsModule, DiagramEditorComponent],
  templateUrl: './diagrams.component.html',
  styleUrl: './diagrams.component.scss',
})
export class DiagramsComponent implements OnInit, OnDestroy {
  private diagramService = inject(DiagramService);
  private projectService = inject(ProjectService);
  private toast = inject(ToastService);
  private topbarService = inject(TopbarService);
  readonly permissions = inject(WorkspacePermissionService);

  private subscriptions = new Subscription();

  readonly templates = DIAGRAM_TEMPLATES;

  diagrams: Diagram[] = [];
  projects: Project[] = [];
  selectedDiagram: Diagram | null = null;
  loading = true;
  saving = false;
  dirty = false;
  creating = false;
  createDialogOpen = false;
  renameDialogOpen = false;
  deletingDiagram: Diagram | null = null;
  newDiagramName = '';
  selectedTemplateType: DiagramType = 'blank';
  selectedProjectId = '';
  renameValue = '';

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Diagrams',
      icon: 'fa-solid fa-diagram-project',
    });

    this.subscriptions.add(
      this.diagramService.getDiagrams().subscribe({
        next: (diagrams) => {
          this.diagrams = diagrams;
          this.loading = false;

          if (!this.selectedDiagram && diagrams.length) {
            this.selectDiagram(diagrams[0]);
            return;
          }

          if (this.selectedDiagram?.id) {
            const fresh = diagrams.find((diagram) => diagram.id === this.selectedDiagram?.id);

            if (fresh && !this.dirty) {
              this.selectedDiagram = this.cloneDiagram(fresh);
            }
          }
        },
        error: (error) => {
          console.error('DIAGRAM LOAD ERROR:', error);
          this.loading = false;
          this.toast.error('Unable to load diagrams.');
        },
      }),
    );

    this.subscriptions.add(
      this.projectService.getProjects().subscribe({
        next: (projects) => {
          this.projects = projects;
        },
        error: (error) => {
          console.error('PROJECT LOAD ERROR:', error);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  selectDiagram(diagram: Diagram): void {
    if (this.saving) return;

    if (this.dirty && this.selectedDiagram?.id !== diagram.id) {
      const proceed = window.confirm('You have unsaved diagram changes. Continue without saving?');

      if (!proceed) return;
    }

    this.selectedDiagram = this.cloneDiagram(diagram);
    this.dirty = false;
  }

  openCreateDialog(): void {
    if (!this.permissions.canManageContent()) return;

    this.newDiagramName = '';
    this.selectedTemplateType = 'blank';
    this.selectedProjectId = '';
    this.createDialogOpen = true;
  }

  closeCreateDialog(): void {
    if (this.creating) return;
    this.createDialogOpen = false;
  }

  selectTemplate(type: DiagramType): void {
    this.selectedTemplateType = type;
  }

  async createDiagram(): Promise<void> {
    const name = this.newDiagramName.trim();

    if (!name || this.creating || !this.permissions.canManageContent()) {
      return;
    }

    const template = this.getTemplate(this.selectedTemplateType);
    const nodes = this.cloneNodes(template.nodes);
    const connections = this.cloneConnections(template.connections);

    this.creating = true;

    try {
      const id = await this.diagramService.createDiagram(
        name,
        '',
        this.selectedTemplateType,
        this.selectedProjectId || undefined,
        nodes,
        connections,
      );

      this.selectedDiagram = {
        id,
        workspaceId: '',
        projectId: this.selectedProjectId || undefined,
        name,
        description: '',
        type: this.selectedTemplateType,
        nodes,
        connections,
        createdBy: '',
      };

      this.dirty = false;
      this.createDialogOpen = false;
      this.toast.success('Diagram created.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to create diagram.');
    } finally {
      this.creating = false;
    }
  }

  openRenameDialog(diagram: Diagram): void {
    if (!this.permissions.canManageContent()) return;

    this.renameValue = diagram.name;
    this.selectedDiagram = this.cloneDiagram(diagram);
    this.renameDialogOpen = true;
  }

  closeRenameDialog(): void {
    this.renameDialogOpen = false;
  }

  async renameDiagram(): Promise<void> {
    if (!this.selectedDiagram?.id || !this.renameValue.trim()) {
      return;
    }

    try {
      await this.diagramService.renameDiagram(this.selectedDiagram.id, this.renameValue);

      this.selectedDiagram.name = this.renameValue.trim();
      this.renameDialogOpen = false;
      this.toast.success('Diagram renamed.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to rename diagram.');
    }
  }

  openDeleteDiagram(diagram: Diagram): void {
    if (!this.permissions.canManageContent()) return;
    this.deletingDiagram = diagram;
  }

  closeDeleteDialog(): void {
    this.deletingDiagram = null;
  }

  async confirmDeleteDiagram(): Promise<void> {
    if (!this.deletingDiagram?.id) return;

    try {
      const deletedId = this.deletingDiagram.id;

      await this.diagramService.deleteDiagram(deletedId);

      if (this.selectedDiagram?.id === deletedId) {
        this.selectedDiagram = null;
        this.dirty = false;
      }

      this.deletingDiagram = null;
      this.toast.success('Diagram deleted.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to delete diagram.');
    }
  }

  updateGraph(event: { nodes: DiagramNode[]; connections: DiagramConnection[] }): void {
    if (!this.selectedDiagram) return;

    this.selectedDiagram = {
      ...this.selectedDiagram,
      nodes: event.nodes,
      connections: event.connections,
    };

    this.dirty = true;
  }

  async saveDiagram(): Promise<void> {
    if (!this.selectedDiagram?.id || !this.dirty || this.saving) {
      return;
    }

    this.saving = true;

    try {
      await this.diagramService.updateDiagram(
        this.selectedDiagram.id,
        this.selectedDiagram.nodes,
        this.selectedDiagram.connections,
      );

      this.dirty = false;
      this.toast.success('Diagram saved.');
    } catch (error: any) {
      this.toast.error(error?.message || 'Unable to save diagram.');
    } finally {
      this.saving = false;
    }
  }

  getProjectName(projectId?: string | null): string {
    if (!projectId) return 'Workspace';

    return this.projects.find((project) => project.id === projectId)?.name || 'Project';
  }

  getDiagramTypeLabel(type?: DiagramType): string {
    return this.getTemplate(type ?? 'blank').name;
  }

  getDiagramTypeIcon(type?: DiagramType): string {
    return this.getTemplate(type ?? 'blank').icon;
  }

  private getTemplate(type: DiagramType): DiagramTemplate {
    return this.templates.find((template) => template.type === type) ?? this.templates[0];
  }

  private cloneDiagram(diagram: Diagram): Diagram {
    return {
      ...diagram,
      nodes: this.cloneNodes(diagram.nodes ?? []),
      connections: this.cloneConnections(diagram.connections ?? []),
    };
  }

  private cloneNodes(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.map((node) => ({
      ...node,
    }));
  }

  private cloneConnections(connections: DiagramConnection[]): DiagramConnection[] {
    return connections.map((connection) => ({
      ...connection,
      labels: connection.labels?.map((label) => ({
        ...label,
      })),
      bendPoints: connection.bendPoints?.map((point) => ({
        ...point,
      })),
    }));
  }
}
