import { inject, Injectable } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { doc, Firestore, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  user$: Observable<User | null> = authState(this.auth);

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);

    await this.ensureUserProfile(credential.user);

    return credential;
  }

  logout() {
    return signOut(this.auth);
  }

  private async ensureUserProfile(user: User): Promise<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);

    const snapshot = await getDoc(userRef);

    const email = user.email?.trim() ?? '';

    const emailLower = email.toLowerCase();

    const displayName = user.displayName?.trim() ?? '';

    const displayNameLower = displayName.toLowerCase();

    if (snapshot.exists()) {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email,
          emailLower,
          displayName,
          displayNameLower,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
