export interface AppUser {
  id?: string;
  uid: string;
  email: string;
  emailLower: string;
  displayName?: string;
  displayNameLower?: string;
  photoURL?: string;
  jobTitle?: string;
  bio?: string;
  phone?: string;
  location?: string;
  website?: string;
  timezone?: string;
  createdAt?: any;
  updatedAt?: any;
}
