import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Client } from '../../core/models/client.model';
import { ClientService } from '../../core/services/client.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clientService = inject(ClientService);
  private toast = inject(ToastService);

  clients: Client[] = [];
  showForm = false;
  clientForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    company: [''],
    email: [''],
    phone: [''],
  });

  editingClient: Client | null = null;

  ngOnInit(): void {
    this.clientService.getClients().subscribe((clients) => (this.clients = clients));
  }
  async saveClient(): Promise<void> {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }
    const value = this.clientForm.getRawValue();

    const client: Omit<Client, 'workspaceId'> = {
      name: value.name,
      company: value.company,
      email: value.email,
      phone: value.phone,
    };

    if (this.editingClient?.id) {
      await this.clientService.updateClient(this.editingClient.id, client);
      this.toast.success('Project created successfully.');
    } else {
      await this.clientService.createClient(client);
      this.toast.success('Project updated successfully.');
    }
    this.showForm = false;
    this.editingClient = null;
  }

  async removeClient(client: Client): Promise<void> {
    if (client.id && confirm(`Delete ${client.name}?`)) {
      await this.clientService.deleteClient(client.id);
      this.toast.success('Project deleted successfully.');
    }
  }

  openCreateClient(): void {
    this.editingClient = null;

    this.clientForm.reset({
      name: '',
      company: '',
      email: '',
      phone: '',
    });

    this.showForm = true;
  }

  editClient(client: Client): void {
    this.editingClient = client;

    this.clientForm.patchValue({
      name: client.name,
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
    });

    this.showForm = true;
  }
}
