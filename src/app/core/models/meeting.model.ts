import { Timestamp } from '@angular/fire/firestore';

export type MeetingProvider = 'jitsi' | 'google-meet' | 'teams' | 'zoom' | 'custom';
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Meeting {
  id?: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string;
  agenda: string;
  provider: MeetingProvider;
  meetingUrl: string;
  externalMeetingId: string;
  attendeeEmails: string[];
  startAt: Timestamp;
  endAt: Timestamp;
  status: MeetingStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
