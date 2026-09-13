import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Meeting, MeetingProvider, MeetingStatus } from '../../core/models/meeting.model';
import { Project } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth.service';
import { MeetingService } from '../../core/services/meeting.service';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss',
})
export class MeetingsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private meetingService = inject(MeetingService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private topbarService = inject(TopbarService);
  private subscriptions = new Subscription();
  private meetingsSubscription?: Subscription;

  projects: Project[] = [];
  meetings: Meeting[] = [];
  loading = true;
  saving = false;
  modalOpen = false;
  editingMeeting: Meeting | null = null;
  view: 'upcoming' | 'past' | 'all' = 'upcoming';
  now = Date.now();

  title = '';
  projectId = '';
  description = '';
  agenda = '';
  provider: MeetingProvider = 'jitsi';
  meetingUrl = '';
  attendeeEmails = '';
  startAt = '';
  endAt = '';
  status: MeetingStatus = 'scheduled';

  readonly providers: {
    value: MeetingProvider;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: 'jitsi',
      label: 'Marvills Meeting',
      description: 'Built-in video room powered by Jitsi',
      icon: 'fa-solid fa-video',
    },
    {
      value: 'google-meet',
      label: 'Google Meet',
      description: 'Use an existing Google Meet link',
      icon: 'fa-brands fa-google',
    },
    {
      value: 'teams',
      label: 'Microsoft Teams',
      description: 'Use an existing Teams meeting link',
      icon: 'fa-brands fa-microsoft',
    },
    {
      value: 'zoom',
      label: 'Zoom',
      description: 'Use an existing Zoom meeting link',
      icon: 'fa-solid fa-camera',
    },
    {
      value: 'custom',
      label: 'External Link',
      description: 'Use any external meeting provider',
      icon: 'fa-solid fa-link',
    },
  ];

  constructor() {
    this.topbarService.setPageContext({
      title: 'Meetings',
      icon: 'fa-solid fa-video',
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.projectService.getProjects().subscribe({
        next: (projects) => (this.projects = projects),
        error: () => this.toast.error('Unable to load projects'),
      }),
    );

    this.subscriptions.add(
      this.workspaceService.currentWorkspace$.subscribe((workspace) => {
        this.meetingsSubscription?.unsubscribe();
        this.meetings = [];

        if (!workspace?.id) {
          this.loading = false;
          return;
        }

        this.loading = true;

        this.meetingsSubscription = this.meetingService.getMeetings(workspace.id).subscribe({
          next: (meetings) => {
            this.meetings = [...meetings].sort(
              (a, b) => a.startAt.toMillis() - b.startAt.toMillis(),
            );
            this.loading = false;
          },
          error: (error) => {
            console.error('Unable to load meetings:', error);
            this.loading = false;
            this.toast.error('Unable to load meetings');
          },
        });
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.meetingsSubscription?.unsubscribe();
    this.topbarService.clearPageContext();
  }

  get visibleMeetings(): Meeting[] {
    if (this.view === 'all') return this.meetings;

    if (this.view === 'upcoming') {
      return this.meetings.filter(
        (meeting) =>
          meeting.status !== 'cancelled' &&
          meeting.status !== 'completed' &&
          meeting.endAt.toMillis() >= this.now,
      );
    }

    return [...this.meetings]
      .filter(
        (meeting) =>
          meeting.status === 'cancelled' ||
          meeting.status === 'completed' ||
          meeting.endAt.toMillis() < this.now,
      )
      .reverse();
  }

  get upcomingCount(): number {
    return this.meetings.filter(
      (meeting) => meeting.status === 'scheduled' && meeting.endAt.toMillis() >= this.now,
    ).length;
  }

  get todayCount(): number {
    return this.meetings.filter((meeting) => {
      if (meeting.status === 'cancelled') return false;
      return this.isToday(meeting.startAt.toDate());
    }).length;
  }

  get completedCount(): number {
    return this.meetings.filter(
      (meeting) =>
        meeting.status === 'completed' ||
        (meeting.status !== 'cancelled' && meeting.endAt.toMillis() < this.now),
    ).length;
  }

  openCreateModal(): void {
    this.editingMeeting = null;
    this.title = '';
    this.projectId = '';
    this.description = '';
    this.agenda = '';
    this.provider = 'jitsi';
    this.meetingUrl = '';
    this.attendeeEmails = '';
    this.status = 'scheduled';

    const start = new Date();
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);

    const end = new Date(start.getTime() + 60 * 60 * 1000);

    this.startAt = this.toLocalDateTime(start);
    this.endAt = this.toLocalDateTime(end);
    this.modalOpen = true;
  }

  openEditModal(meeting: Meeting): void {
    this.editingMeeting = meeting;
    this.title = meeting.title;
    this.projectId = meeting.projectId || '';
    this.description = meeting.description || '';
    this.agenda = meeting.agenda || '';
    this.provider = meeting.provider;
    this.meetingUrl = meeting.meetingUrl || '';
    this.attendeeEmails = (meeting.attendeeEmails || []).join(', ');
    this.startAt = this.toLocalDateTime(meeting.startAt.toDate());
    this.endAt = this.toLocalDateTime(meeting.endAt.toDate());
    this.status = meeting.status;
    this.modalOpen = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
    this.editingMeeting = null;
  }

  providerChanged(): void {
    if (this.provider === 'jitsi') this.meetingUrl = '';
  }

  async saveMeeting(): Promise<void> {
    if (this.saving) return;

    const workspace = this.workspaceService.currentWorkspace();
    const user = this.authService.currentUser;

    if (!workspace?.id || !user?.uid) {
      this.toast.error('Workspace or user is unavailable');
      return;
    }

    if (!this.title.trim()) {
      this.toast.error('Meeting title is required');
      return;
    }

    if (!this.startAt || !this.endAt) {
      this.toast.error('Start and end time are required');
      return;
    }

    const start = new Date(this.startAt);
    const end = new Date(this.endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      this.toast.error('Invalid meeting date');
      return;
    }

    if (end <= start) {
      this.toast.error('End time must be after start time');
      return;
    }

    if (this.provider !== 'jitsi' && !this.isValidUrl(this.meetingUrl)) {
      this.toast.error('Enter a valid meeting link');
      return;
    }

    const attendeeEmails = this.attendeeEmails
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    this.saving = true;

    try {
      if (this.editingMeeting?.id) {
        await this.meetingService.updateMeeting(this.editingMeeting.id, {
          projectId: this.projectId,
          title: this.title,
          description: this.description,
          agenda: this.agenda,
          provider: this.provider,
          meetingUrl: this.meetingUrl,
          attendeeEmails,
          startAt: start,
          endAt: end,
          status: this.status,
        });

        this.toast.success('Meeting updated');
      } else {
        await this.meetingService.createMeeting({
          workspaceId: workspace.id,
          projectId: this.projectId,
          title: this.title,
          description: this.description,
          agenda: this.agenda,
          provider: this.provider,
          meetingUrl: this.meetingUrl,
          attendeeEmails,
          startAt: start,
          endAt: end,
          createdBy: user.uid,
        });

        this.toast.success('Meeting created');
      }

      this.modalOpen = false;
      this.editingMeeting = null;
    } catch (error) {
      console.error('Unable to save meeting:', error);
      this.toast.error('Unable to save meeting');
    } finally {
      this.saving = false;
    }
  }

  joinMeeting(meeting: Meeting): void {
    if (!meeting.meetingUrl) {
      this.toast.error('Meeting link is unavailable');
      return;
    }

    window.open(meeting.meetingUrl, '_blank', 'noopener,noreferrer');
  }

  async copyMeetingLink(meeting: Meeting): Promise<void> {
    if (!meeting.meetingUrl) return;

    try {
      await navigator.clipboard.writeText(meeting.meetingUrl);
      this.toast.success('Meeting link copied');
    } catch {
      this.toast.error('Unable to copy meeting link');
    }
  }

  async completeMeeting(meeting: Meeting): Promise<void> {
    if (!meeting.id) return;

    try {
      await this.meetingService.updateStatus(meeting.id, 'completed');
      this.toast.success('Meeting marked as completed');
    } catch {
      this.toast.error('Unable to update meeting');
    }
  }

  async cancelMeeting(meeting: Meeting): Promise<void> {
    if (!meeting.id) return;

    try {
      await this.meetingService.updateStatus(meeting.id, 'cancelled');
      this.toast.success('Meeting cancelled');
    } catch {
      this.toast.error('Unable to cancel meeting');
    }
  }

  async deleteMeeting(meeting: Meeting): Promise<void> {
    if (!meeting.id) return;

    const confirmed = confirm(`Delete "${meeting.title}"?`);

    if (!confirmed) return;

    try {
      await this.meetingService.deleteMeeting(meeting.id);
      this.toast.success('Meeting deleted');
    } catch {
      this.toast.error('Unable to delete meeting');
    }
  }

  openProject(meeting: Meeting): void {
    if (!meeting.projectId) return;
    this.router.navigate(['/projects', meeting.projectId]);
  }

  getProjectName(projectId: string): string {
    if (!projectId) return 'No Project';

    return this.projects.find((project) => project.id === projectId)?.name || 'Unknown Project';
  }

  getProviderLabel(provider: MeetingProvider): string {
    return this.providers.find((item) => item.value === provider)?.label || 'Meeting';
  }

  getProviderIcon(provider: MeetingProvider): string {
    return this.providers.find((item) => item.value === provider)?.icon || 'fa-solid fa-video';
  }

  getDisplayStatus(meeting: Meeting): string {
    if (meeting.status === 'cancelled') return 'Cancelled';
    if (meeting.status === 'completed') return 'Completed';

    const now = Date.now();

    if (meeting.startAt.toMillis() <= now && meeting.endAt.toMillis() >= now) {
      return 'In Progress';
    }

    if (meeting.endAt.toMillis() < now) return 'Ended';

    return 'Scheduled';
  }

  getStatusClass(meeting: Meeting): string {
    return this.getDisplayStatus(meeting).toLowerCase().replace(' ', '-');
  }

  formatMeetingDate(meeting: Meeting): string {
    return meeting.startAt.toDate().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatMeetingTime(meeting: Meeting): string {
    const start = meeting.startAt.toDate().toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    const end = meeting.endAt.toDate().toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${start} – ${end}`;
  }

  private toLocalDateTime(date: Date): string {
    const offset = date.getTimezoneOffset();

    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  }

  private isToday(date: Date): boolean {
    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
