import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Diagram, DiagramConnection, DiagramNode } from '../../core/models/diagram.model';
import { DiagramService } from '../../core/services/diagram.service';
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
  private toast = inject(ToastService);
  private topbarService = inject(TopbarService);
  readonly permissions = inject(WorkspacePermissionService);

  private subscription?: Subscription;

  diagrams: Diagram[] = [];
  selectedDiagram: Diagram | null = null;
  loading = true;
  saving = false;
  dirty = false;
  creating = false;
  createDialogOpen = false;
  renameDialogOpen = false;
  deletingDiagram: Diagram | null = null;
  newDiagramName = '';
  renameValue = '';

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Diagrams',
      icon: 'fa-solid fa-diagram-project',
    });
    this.subscription = this.diagramService.getDiagrams().subscribe({
      next: (diagrams) => {
        this.diagrams = diagrams;
        this.loading = false;
        if (!this.selectedDiagram && diagrams.length) {
          this.selectDiagram(diagrams[0]);
          return;
        }
        if (this.selectedDiagram?.id) {
          const fresh = diagrams.find((diagram) => diagram.id === this.selectedDiagram?.id);
          if (fresh && !this.dirty) this.selectedDiagram = this.cloneDiagram(fresh);
        }
      },
      error: (error) => {
        console.error('DIAGRAM LOAD ERROR:', error);
        this.loading = false;
        this.toast.error('Unable to load diagrams.');
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
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
    this.createDialogOpen = true;
  }

  closeCreateDialog(): void {
    if (this.creating) return;
    this.createDialogOpen = false;
  }

  async createDiagram(): Promise<void> {
    const name = this.newDiagramName.trim();
    if (!name || this.creating || !this.permissions.canManageContent()) return;
    this.creating = true;
    try {
      const id = await this.diagramService.createDiagram(name);
      this.selectedDiagram = {
        id,
        workspaceId: '',
        name,
        description: '',
        nodes: [],
        connections: [],
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
    if (!this.selectedDiagram?.id || !this.renameValue.trim()) return;
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
    if (!this.selectedDiagram?.id || !this.dirty || this.saving) return;
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

  private cloneDiagram(diagram: Diagram): Diagram {
    return {
      ...diagram,
      nodes: diagram.nodes?.map((node) => ({ ...node })) ?? [],
      connections: diagram.connections?.map((connection) => ({ ...connection })) ?? [],
    };
  }
}
