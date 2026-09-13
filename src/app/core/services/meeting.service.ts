import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Meeting, MeetingProvider, MeetingStatus } from '../models/meeting.model';

@Injectable({
  providedIn: 'root',
})
export class MeetingService {
  private firestore = inject(Firestore);

  getMeetings(workspaceId: string): Observable<Meeting[]> {
    const ref = collection(this.firestore, 'meetings');
    const q = query(ref, where('workspaceId', '==', workspaceId));
    return collectionData(q, { idField: 'id' }) as Observable<Meeting[]>;
  }

  async createMeeting(data: {
    workspaceId: string;
    projectId: string;
    title: string;
    description: string;
    agenda: string;
    provider: MeetingProvider;
    meetingUrl: string;
    attendeeEmails: string[];
    startAt: Date;
    endAt: Date;
    createdBy: string;
  }): Promise<string> {
    const now = Timestamp.now();
    const ref = await addDoc(collection(this.firestore, 'meetings'), {
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      title: data.title.trim(),
      description: data.description.trim(),
      agenda: data.agenda.trim(),
      provider: data.provider,
      meetingUrl: data.provider === 'jitsi' ? '' : data.meetingUrl.trim(),
      externalMeetingId: '',
      attendeeEmails: data.attendeeEmails,
      startAt: Timestamp.fromDate(data.startAt),
      endAt: Timestamp.fromDate(data.endAt),
      status: 'scheduled',
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    if (data.provider === 'jitsi') {
      await updateDoc(doc(this.firestore, `meetings/${ref.id}`), {
        meetingUrl: this.getJitsiUrl(ref.id),
        externalMeetingId: ref.id,
        updatedAt: Timestamp.now(),
      });
    }
    return ref.id;
  }

  async updateMeeting(
    meetingId: string,
    data: {
      projectId: string;
      title: string;
      description: string;
      agenda: string;
      provider: MeetingProvider;
      meetingUrl: string;
      attendeeEmails: string[];
      startAt: Date;
      endAt: Date;
      status: MeetingStatus;
    },
  ): Promise<void> {
    const meetingUrl =
      data.provider === 'jitsi' ? this.getJitsiUrl(meetingId) : data.meetingUrl.trim();
    await updateDoc(doc(this.firestore, `meetings/${meetingId}`), {
      projectId: data.projectId,
      title: data.title.trim(),
      description: data.description.trim(),
      agenda: data.agenda.trim(),
      provider: data.provider,
      meetingUrl,
      externalMeetingId: data.provider === 'jitsi' ? meetingId : '',
      attendeeEmails: data.attendeeEmails,
      startAt: Timestamp.fromDate(data.startAt),
      endAt: Timestamp.fromDate(data.endAt),
      status: data.status,
      updatedAt: Timestamp.now(),
    });
  }

  async updateStatus(meetingId: string, status: MeetingStatus): Promise<void> {
    await updateDoc(doc(this.firestore, `meetings/${meetingId}`), {
      status,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `meetings/${meetingId}`));
  }

  getJitsiUrl(meetingId: string): string {
    return `https://meet.jit.si/marvills-${meetingId}`;
  }
}
