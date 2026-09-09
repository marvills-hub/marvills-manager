import { inject, Injectable } from '@angular/core';
import {
  Auth,
  authState,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  User,
  UserCredential,
} from '@angular/fire/auth';
import { doc, Firestore, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { deleteObject, getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { AppUser } from '../models/app.-user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  readonly user$: Observable<User | null> = authState(this.auth);

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async login(email: string, password: string): Promise<UserCredential> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const credential = await signInWithEmailAndPassword(this.auth, normalizedEmail, password);
      try {
        await this.ensureUserProfile(credential.user);
      } catch (profileError) {
        console.error('User authenticated, but profile sync failed:', profileError);
      }
      return credential;
    } catch (error: any) {
      console.error('Firebase login failed:', {
        code: error?.code,
        message: error?.message,
        error,
      });
      throw error;
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async getUserProfile(): Promise<AppUser | null> {
    const user = this.currentUser;
    if (!user) {
      return null;
    }
    const userRef = doc(this.firestore, `users/${user.uid}`);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await this.ensureUserProfile(user);
      const createdSnapshot = await getDoc(userRef);
      if (!createdSnapshot.exists()) {
        return null;
      }
      return {
        id: createdSnapshot.id,
        ...(createdSnapshot.data() as Omit<AppUser, 'id'>),
      };
    }
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<AppUser, 'id'>),
    };
  }

  async updateUserProfile(profile: Partial<AppUser>): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }
    const userRef = doc(this.firestore, `users/${user.uid}`);
    const cleanProfile = Object.fromEntries(
      Object.entries(profile).filter(([, value]) => value !== undefined),
    );
    await setDoc(
      userRef,
      {
        ...cleanProfile,
        uid: user.uid,
        email: user.email?.trim() ?? '',
        emailLower: user.email?.trim().toLowerCase() ?? '',
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  async updateDisplayName(displayName: string): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }
    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      throw new Error('Display name is required.');
    }
    await updateProfile(user, {
      displayName: normalizedDisplayName,
    });
    const userRef = doc(this.firestore, `users/${user.uid}`);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email?.trim() ?? '',
        emailLower: user.email?.trim().toLowerCase() ?? '',
        displayName: normalizedDisplayName,
        displayNameLower: normalizedDisplayName.toLowerCase(),
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  async uploadProfileImage(file: File): Promise<string> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('INVALID_IMAGE_TYPE');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('IMAGE_TOO_LARGE');
    }
    const optimizedImage = await this.prepareProfileImage(file);
    if (optimizedImage.size > 2 * 1024 * 1024) {
      throw new Error('OPTIMIZED_IMAGE_TOO_LARGE');
    }
    const imageRef = ref(this.storage, `users/${user.uid}/profile/avatar.webp`);
    await uploadBytes(imageRef, optimizedImage, {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=3600',
    });
    const downloadURL = await getDownloadURL(imageRef);
    const photoURL = `${downloadURL}${downloadURL.includes('?') ? '&' : '?'}v=${Date.now()}`;
    await updateProfile(user, {
      photoURL,
    });
    const userRef = doc(this.firestore, `users/${user.uid}`);
    await setDoc(
      userRef,
      {
        photoURL,
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );
    return photoURL;
  }

  async removeProfileImage(): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }
    const imageRef = ref(this.storage, `users/${user.uid}/profile/avatar.webp`);
    try {
      await deleteObject(imageRef);
    } catch (error: any) {
      if (error?.code !== 'storage/object-not-found') {
        throw error;
      }
    }
    await updateProfile(user, {
      photoURL: null,
    });
    const userRef = doc(this.firestore, `users/${user.uid}`);
    await setDoc(
      userRef,
      {
        photoURL: '',
        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  async sendVerificationEmail(): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }
    if (user.emailVerified) {
      throw new Error('Your email address is already verified.');
    }
    await sendEmailVerification(user);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }
    if (!user.email) {
      throw new Error('No email address is associated with this account.');
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  }

  private async prepareProfileImage(file: File): Promise<Blob> {
    const image = await createImageBitmap(file);
    const cropSize = Math.min(image.width, image.height);
    const sourceX = (image.width - cropSize) / 2;
    const sourceY = (image.height - cropSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) {
      image.close();
      throw new Error('IMAGE_PROCESSING_FAILED');
    }
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 512, 512);
    image.close();
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('IMAGE_PROCESSING_FAILED'));
            return;
          }
          resolve(blob);
        },
        'image/webp',
        0.86,
      );
    });
  }

  private async ensureUserProfile(user: User): Promise<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    const snapshot = await getDoc(userRef);
    const email = user.email?.trim() ?? '';
    const emailLower = email.toLowerCase();
    const displayName = user.displayName?.trim() ?? '';
    const displayNameLower = displayName.toLowerCase();
    const photoURL = user.photoURL ?? '';
    if (snapshot.exists()) {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email,
          emailLower,
          displayName,
          displayNameLower,
          photoURL,
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );
      return;
    }
    await setDoc(userRef, {
      uid: user.uid,
      email,
      emailLower,
      displayName,
      displayNameLower,
      photoURL,
      jobTitle: '',
      bio: '',
      phone: '',
      location: '',
      website: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
