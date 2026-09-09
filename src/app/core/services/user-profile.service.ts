import { inject, Injectable } from '@angular/core';
import { Auth, sendPasswordResetEmail, signOut, updateProfile } from '@angular/fire/auth';
import { doc, Firestore, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { UserProfile } from '../models/user-profile.model';

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  async getCurrentProfile(): Promise<UserProfile | null> {
    const user = this.auth.currentUser;
    if (!user) {
      return null;
    }
    const userRef = doc(this.firestore, `users/${user.uid}`);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      return {
        uid: user.uid,
        email: user.email ?? '',
        emailLower: (user.email ?? '').toLowerCase(),
        displayName: user.displayName ?? '',
        displayNameLower: (user.displayName ?? '').toLowerCase(),
        jobTitle: '',
        bio: '',
        location: '',
        phoneNumber: '',
        photoURL: user.photoURL ?? '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        defaultWorkspaceId: '',
        theme: 'dark',
        dateFormat: 'MM/DD/YYYY',
      };
    }
    const data = snapshot.data() as Partial<UserProfile>;
    return {
      uid: user.uid,
      email: data.email ?? user.email ?? '',
      emailLower: data.emailLower ?? (user.email ?? '').toLowerCase(),
      displayName: data.displayName ?? user.displayName ?? '',
      displayNameLower: data.displayNameLower ?? (user.displayName ?? '').toLowerCase(),
      jobTitle: data.jobTitle ?? '',
      bio: data.bio ?? '',
      location: data.location ?? '',
      phoneNumber: data.phoneNumber ?? '',
      photoURL: data.photoURL ?? user.photoURL ?? '',
      timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      defaultWorkspaceId: data.defaultWorkspaceId ?? '',
      theme: data.theme ?? 'dark',
      dateFormat: data.dateFormat ?? 'MM/DD/YYYY',
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }
    const displayName = profile.displayName?.trim() ?? user.displayName ?? '';
    const photoURL = profile.photoURL?.trim() ?? user.photoURL ?? '';
    await updateProfile(user, {
      displayName,
      photoURL: photoURL || null,
    });
    const userRef = doc(this.firestore, `users/${user.uid}`);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email ?? '',
        emailLower: (user.email ?? '').toLowerCase(),
        displayName,
        displayNameLower: displayName.toLowerCase(),
        jobTitle: profile.jobTitle?.trim() ?? '',
        bio: profile.bio?.trim() ?? '',
        location: profile.location?.trim() ?? '',
        phoneNumber: profile.phoneNumber?.trim() ?? '',
        photoURL,
        timezone: profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        defaultWorkspaceId: profile.defaultWorkspaceId ?? '',
        theme: profile.theme ?? 'dark',
        dateFormat: profile.dateFormat ?? 'MM/DD/YYYY',
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  async sendPasswordReset(): Promise<void> {
    const email = this.auth.currentUser?.email;
    if (!email) {
      throw new Error('No email address is associated with this account.');
    }
    await sendPasswordResetEmail(this.auth, email);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
