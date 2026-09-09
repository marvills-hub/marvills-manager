import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TopbarService } from '../../core/services/top-bar.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { WorkspacePermissionService } from '../../core/services/workspace-permission.service';
import { AppUser } from '../../core/models/app.-user.model';

type ProfileTab = 'personal' | 'workspace' | 'security';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly topbarService = inject(TopbarService);
  readonly workspaceService = inject(WorkspaceService);
  readonly permissionService = inject(WorkspacePermissionService);
  readonly activeTab = signal<ProfileTab>('personal');
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly profileLoading = signal(true);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly changingPassword = signal(false);
  readonly passwordSaving = signal(false);
  readonly verificationSending = signal(false);
  readonly securityError = signal('');
  readonly securitySuccess = signal('');
  readonly profile = signal<AppUser | null>(null);
  readonly timezones = this.buildTimezoneOptions();
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  editDisplayName = '';
  editJobTitle = '';
  editBio = '';
  editPhone = '';
  editLocation = '';
  editWebsite = '';
  editTimezone = '';
  selectedProfileImage: File | null = null;
  profileImagePreview = '';

  constructor() {
    this.topbarService.setPageContext({
      title: 'Profile',
      description: 'Manage your account and profile',
      icon: 'fa-regular fa-user',
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  get user() {
    return this.authService.currentUser;
  }

  get displayName(): string {
    return this.user?.displayName?.trim() || this.profile()?.displayName?.trim() || 'Marvills User';
  }

  get email(): string {
    return this.user?.email || this.profile()?.email || 'No email available';
  }

  get jobTitle(): string {
    return this.profile()?.jobTitle?.trim() || '';
  }

  get bio(): string {
    return this.profile()?.bio?.trim() || '';
  }

  get phone(): string {
    return this.profile()?.phone?.trim() || '';
  }

  get location(): string {
    return this.profile()?.location?.trim() || '';
  }

  get website(): string {
    return this.profile()?.website?.trim() || '';
  }

  get timezone(): string {
    return (
      this.profile()?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    );
  }

  get initials(): string {
    const name = this.displayName.trim();
    if (!name) {
      return 'MU';
    }
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  get emailVerified(): boolean {
    return this.user?.emailVerified ?? false;
  }

  get workspaceName(): string {
    return this.workspaceService.currentWorkspace()?.name || 'No workspace selected';
  }

  get workspaceDescription(): string {
    return (
      this.workspaceService.currentWorkspace()?.description?.trim() ||
      'No workspace description available.'
    );
  }

  get workspaceRole(): string {
    const role = this.permissionService.role();
    if (!role) {
      return 'No role';
    }
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  get membershipEmail(): string {
    return this.permissionService.membership()?.email || this.email;
  }

  get membershipName(): string {
    return this.permissionService.membership()?.displayName?.trim() || this.displayName;
  }

  get isWorkspaceOwner(): boolean {
    return this.permissionService.isOwner();
  }

  get userId(): string {
    return this.user?.uid || 'Unavailable';
  }

  get authenticationProvider(): string {
    const provider = this.user?.providerData?.[0]?.providerId;
    switch (provider) {
      case 'password':
        return 'Email & Password';
      case 'google.com':
        return 'Google';
      case 'github.com':
        return 'GitHub';
      case 'facebook.com':
        return 'Facebook';
      default:
        return provider || 'Unknown';
    }
  }

  get passwordAccount(): boolean {
    return this.user?.providerData?.some((provider) => provider.providerId === 'password') ?? false;
  }

  get photoURL(): string {
    return this.user?.photoURL || this.profile()?.photoURL || '';
  }

  get editPhotoURL(): string {
    return this.profileImagePreview || this.photoURL;
  }

  selectTab(tab: ProfileTab): void {
    if (this.saving() || this.passwordSaving()) {
      return;
    }
    this.clearPendingProfileImage();
    this.activeTab.set(tab);
    this.editing.set(false);
    this.changingPassword.set(false);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.securityError.set('');
    this.securitySuccess.set('');
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  startEditing(): void {
    this.editDisplayName = this.displayName;
    this.editJobTitle = this.jobTitle;
    this.editBio = this.bio;
    this.editPhone = this.phone;
    this.editLocation = this.location;
    this.editWebsite = this.website;
    this.editTimezone = this.timezone;
    this.clearPendingProfileImage();
    this.errorMessage.set('');
    this.successMessage.set('');
    this.editing.set(true);
  }

  cancelEditing(): void {
    if (this.saving()) {
      return;
    }
    this.resetEditFields();
    this.clearPendingProfileImage();
    this.errorMessage.set('');
    this.editing.set(false);
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.errorMessage.set('');
    this.successMessage.set('');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.errorMessage.set('Please select a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set('Profile images cannot exceed 10 MB.');
      return;
    }
    this.clearPendingProfileImage();
    this.selectedProfileImage = file;
    this.profileImagePreview = URL.createObjectURL(file);
  }

  undoProfileImageChange(): void {
    this.clearPendingProfileImage();
    this.errorMessage.set('');
  }

  async saveProfile(): Promise<void> {
    const displayName = this.editDisplayName.trim();
    const jobTitle = this.editJobTitle.trim();
    const bio = this.editBio.trim();
    const phone = this.editPhone.trim();
    const location = this.editLocation.trim();
    const website = this.editWebsite.trim();
    const timezone = this.editTimezone.trim();
    this.errorMessage.set('');
    this.successMessage.set('');
    if (!displayName) {
      this.errorMessage.set('Display name is required.');
      return;
    }
    if (displayName.length > 60) {
      this.errorMessage.set('Display name cannot exceed 60 characters.');
      return;
    }
    if (jobTitle.length > 80) {
      this.errorMessage.set('Job title cannot exceed 80 characters.');
      return;
    }
    if (bio.length > 500) {
      this.errorMessage.set('Bio cannot exceed 500 characters.');
      return;
    }
    if (phone.length > 30) {
      this.errorMessage.set('Phone number cannot exceed 30 characters.');
      return;
    }
    if (location.length > 100) {
      this.errorMessage.set('Location cannot exceed 100 characters.');
      return;
    }
    if (website.length > 250) {
      this.errorMessage.set('Website URL cannot exceed 250 characters.');
      return;
    }
    if (website && !this.isValidWebsite(website)) {
      this.errorMessage.set('Enter a valid website URL including http:// or https://.');
      return;
    }
    if (!timezone) {
      this.errorMessage.set('Please select a timezone.');
      return;
    }
    const displayNameChanged = displayName !== this.displayName;
    const profileChanged =
      jobTitle !== this.jobTitle ||
      bio !== this.bio ||
      phone !== this.phone ||
      location !== this.location ||
      website !== this.website ||
      timezone !== this.timezone;
    const profileImageChanged = this.selectedProfileImage !== null;
    if (!displayNameChanged && !profileChanged && !profileImageChanged) {
      this.resetEditFields();
      this.clearPendingProfileImage();
      this.editing.set(false);
      return;
    }
    this.saving.set(true);
    try {
      if (displayNameChanged) {
        await this.authService.updateDisplayName(displayName);
      }
      if (profileChanged || displayNameChanged) {
        await this.authService.updateUserProfile({
          displayName,
          displayNameLower: displayName.toLowerCase(),
          jobTitle,
          bio,
          phone,
          location,
          website,
          timezone,
        });
      }
      if (this.selectedProfileImage) {
        await this.authService.uploadProfileImage(this.selectedProfileImage);
      }
      await this.loadProfile();
      this.resetEditFields();
      this.clearPendingProfileImage();
      this.editing.set(false);
      this.successMessage.set('Profile updated successfully.');
    } catch (error: any) {
      console.error('Profile update failed:', error);
      switch (error?.message) {
        case 'INVALID_IMAGE_TYPE':
          this.errorMessage.set('Please select a JPG, PNG, or WebP image.');
          break;
        case 'IMAGE_TOO_LARGE':
        case 'OPTIMIZED_IMAGE_TOO_LARGE':
          this.errorMessage.set('The selected image is too large.');
          break;
        default:
          this.errorMessage.set('Unable to update your profile. Please try again.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  async verifyEmail(): Promise<void> {
    this.securityError.set('');
    this.securitySuccess.set('');
    if (this.emailVerified) {
      this.securitySuccess.set('Your email address is already verified.');
      return;
    }
    this.verificationSending.set(true);
    try {
      await this.authService.sendVerificationEmail();
      this.securitySuccess.set(
        `Verification email sent to ${this.email}. Check your inbox and follow the verification link.`,
      );
    } catch (error: any) {
      console.error('Unable to send verification email:', error);
      if (error?.code === 'auth/too-many-requests') {
        this.securityError.set('Too many verification requests. Please wait before trying again.');
      } else {
        this.securityError.set('Unable to send the verification email. Please try again.');
      }
    } finally {
      this.verificationSending.set(false);
    }
  }

  startPasswordChange(): void {
    this.securityError.set('');
    this.securitySuccess.set('');
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.changingPassword.set(true);
  }

  cancelPasswordChange(): void {
    if (this.passwordSaving()) {
      return;
    }
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.securityError.set('');
    this.changingPassword.set(false);
  }

  async savePassword(): Promise<void> {
    this.securityError.set('');
    this.securitySuccess.set('');
    if (!this.currentPassword) {
      this.securityError.set('Current password is required.');
      return;
    }
    if (!this.newPassword) {
      this.securityError.set('New password is required.');
      return;
    }
    if (this.newPassword.length < 6) {
      this.securityError.set('New password must contain at least 6 characters.');
      return;
    }
    if (this.newPassword === this.currentPassword) {
      this.securityError.set('Your new password must be different from your current password.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.securityError.set('New passwords do not match.');
      return;
    }
    this.passwordSaving.set(true);
    try {
      await this.authService.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.changingPassword.set(false);
      this.securitySuccess.set('Your password was changed successfully.');
    } catch (error: any) {
      console.error('Unable to change password:', error);
      switch (error?.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          this.securityError.set('Your current password is incorrect.');
          break;
        case 'auth/weak-password':
          this.securityError.set(
            'The new password is too weak. Please choose a stronger password.',
          );
          break;
        case 'auth/too-many-requests':
          this.securityError.set('Too many attempts. Please wait before trying again.');
          break;
        default:
          this.securityError.set('Unable to change your password. Please try again.');
      }
    } finally {
      this.passwordSaving.set(false);
    }
  }

  private async loadProfile(): Promise<void> {
    this.profileLoading.set(true);
    try {
      const profile = await this.authService.getUserProfile();
      this.profile.set(profile);
    } catch (error) {
      console.error('Unable to load profile:', error);
      this.errorMessage.set('Unable to load your profile information.');
    } finally {
      this.profileLoading.set(false);
    }
  }

  private resetEditFields(): void {
    this.editDisplayName = '';
    this.editJobTitle = '';
    this.editBio = '';
    this.editPhone = '';
    this.editLocation = '';
    this.editWebsite = '';
    this.editTimezone = '';
  }

  private clearPendingProfileImage(): void {
    if (this.profileImagePreview) {
      URL.revokeObjectURL(this.profileImagePreview);
    }
    this.selectedProfileImage = null;
    this.profileImagePreview = '';
  }

  private isValidWebsite(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private buildTimezoneOptions(): string[] {
    try {
      const supportedValuesOf = (Intl as any).supportedValuesOf;
      if (typeof supportedValuesOf === 'function') {
        return supportedValuesOf('timeZone');
      }
    } catch {}
    return [
      'Asia/Manila',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Europe/London',
      'America/New_York',
      'America/Los_Angeles',
      'UTC',
    ];
  }

  ngOnDestroy(): void {
    this.clearPendingProfileImage();
    this.topbarService.clearPageContext();
  }
}
