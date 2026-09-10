import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Client } from '../../core/models/client.model';
import { ClientService } from '../../core/services/client.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private clientService = inject(ClientService);
  private toast = inject(ToastService);
  private topbarService = inject(TopbarService);

  clients: Client[] = [];
  editingClient: Client | null = null;
  showForm = false;
  saving = false;
  selectedPhotoFile: File | null = null;
  photoPreview = '';
  removeExistingPhoto = false;

  clientForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    company: [''],
    email: ['', Validators.email],
    phone: [''],
  });

  ngOnInit(): void {
    this.topbarService.setPageContext({
      title: 'Clients',
      description: 'Manage the people and companies you work with.',
      icon: 'fa-regular fa-address-book',
    });
    this.clientService.getClients().subscribe((clients) => {
      this.clients = clients;
    });
  }

  ngOnDestroy(): void {
    this.clearPhotoPreview();
  }

  openCreateClient(): void {
    this.clearPhotoPreview();
    this.editingClient = null;
    this.selectedPhotoFile = null;
    this.removeExistingPhoto = false;
    this.clientForm.reset({
      name: '',
      company: '',
      email: '',
      phone: '',
    });
    this.showForm = true;
  }

  editClient(client: Client): void {
    this.clearPhotoPreview();
    this.editingClient = client;
    this.selectedPhotoFile = null;
    this.removeExistingPhoto = false;
    this.photoPreview = client.photoURL || '';
    this.clientForm.reset({
      name: client.name,
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
    });
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.showForm = false;
    this.editingClient = null;
    this.selectedPhotoFile = null;
    this.removeExistingPhoto = false;
    this.clearPhotoPreview();
  }

  selectPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.clearPhotoPreview();
    this.selectedPhotoFile = file;
    this.removeExistingPhoto = false;
    this.photoPreview = this.clientService.createPhotoPreview(file);
    input.value = '';
  }

  removePhoto(): void {
    this.clearPhotoPreview();
    this.selectedPhotoFile = null;
    this.removeExistingPhoto = !!this.editingClient?.photoURL;
  }

  async saveClient(): Promise<void> {
    if (this.clientForm.invalid || this.saving) {
      this.clientForm.markAllAsTouched();
      return;
    }
    this.saving = true;
    try {
      const value = this.clientForm.getRawValue();
      const client: Omit<Client, 'workspaceId'> = {
        name: value.name.trim(),
        company: value.company.trim(),
        email: value.email.trim(),
        phone: value.phone.trim(),
      };
      if (this.editingClient?.id) {
        const clientId = this.editingClient.id;
        await this.clientService.updateClient(clientId, client);
        if (this.removeExistingPhoto) {
          await this.clientService.removeClientPhoto(clientId, this.editingClient.photoPath);
        }
        if (this.selectedPhotoFile) {
          await this.clientService.uploadClientPhoto(clientId, this.selectedPhotoFile);
        }
        this.toast.success('Client updated successfully.');
      } else {
        const clientRef = await this.clientService.createClient(client);
        if (this.selectedPhotoFile) {
          await this.clientService.uploadClientPhoto(clientRef.id, this.selectedPhotoFile);
        }
        this.toast.success('Client created successfully.');
      }
      this.closeFormAfterSave();
    } finally {
      this.saving = false;
    }
  }

  async removeClient(client: Client): Promise<void> {
    if (!client.id || !confirm(`Delete ${client.name}?`)) return;
    await this.clientService.deleteClient(client.id, client.photoPath);
    this.toast.success('Client deleted successfully.');
  }

  getClientInitials(client: Client): string {
    return client.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private closeFormAfterSave(): void {
    this.showForm = false;
    this.editingClient = null;
    this.selectedPhotoFile = null;
    this.removeExistingPhoto = false;
    this.clearPhotoPreview();
    this.clientForm.reset({
      name: '',
      company: '',
      email: '',
      phone: '',
    });
  }

  private clearPhotoPreview(): void {
    if (this.photoPreview.startsWith('blob:')) {
      this.clientService.revokePhotoPreview(this.photoPreview);
    }
    this.photoPreview = '';
  }
}
