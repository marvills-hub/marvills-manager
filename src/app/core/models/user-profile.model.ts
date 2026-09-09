import { Timestamp } from '@angular/fire/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  emailLower: string;
  displayName: string;
  displayNameLower: string;
  jobTitle: string;
  bio: string;
  location: string;
  phoneNumber: string;
  photoURL: string;
  timezone: string;
  defaultWorkspaceId: string;
  theme: 'dark' | 'light' | 'system';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
