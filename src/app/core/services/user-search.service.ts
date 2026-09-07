import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  Firestore,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  endAt,
} from '@angular/fire/firestore';
import { AppUser } from '../models/app.-user.model';

@Injectable({
  providedIn: 'root',
})
export class UserSearchService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  async searchUsers(searchText: string): Promise<AppUser[]> {
    const search = searchText.trim().toLowerCase();

    if (search.length < 2) {
      return [];
    }

    const usersRef = collection(this.firestore, 'users');

    const emailQuery = query(
      usersRef,
      orderBy('emailLower'),
      startAt(search),
      endAt(`${search}\uf8ff`),
      limit(5),
    );

    const nameQuery = query(
      usersRef,
      orderBy('displayNameLower'),
      startAt(search),
      endAt(`${search}\uf8ff`),
      limit(5),
    );

    const [emailSnapshot, nameSnapshot] = await Promise.all([
      getDocs(emailQuery),
      getDocs(nameQuery),
    ]);

    const users = new Map<string, AppUser>();

    for (const document of emailSnapshot.docs) {
      const user = {
        id: document.id,
        ...document.data(),
      } as AppUser;

      users.set(user.uid, user);
    }

    for (const document of nameSnapshot.docs) {
      const user = {
        id: document.id,
        ...document.data(),
      } as AppUser;

      users.set(user.uid, user);
    }

    const currentUserId = this.auth.currentUser?.uid;

    return Array.from(users.values())
      .filter((user) => user.uid !== currentUserId)
      .slice(0, 5);
  }
}
