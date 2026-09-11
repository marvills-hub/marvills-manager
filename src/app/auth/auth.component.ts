import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

type AuthMode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  mode: AuthMode = 'login';
  loading = false;
  errorMessage = '';
  successMessage = '';
  loginPasswordVisible = false;
  registerPasswordVisible = false;
  confirmPasswordVisible = false;
  passwordCopied = false;

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  registerForm = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: [{ value: '', disabled: true }, Validators.required],
  });

  forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    this.registerForm.controls.password.valueChanges.subscribe((password) => {
      const confirmControl = this.registerForm.controls.confirmPassword;
      if (password.trim()) {
        confirmControl.enable({ emitEvent: false });
        return;
      }
      confirmControl.reset('', { emitEvent: false });
      confirmControl.disable({ emitEvent: false });
      this.confirmPasswordVisible = false;
    });
  }

  setMode(mode: AuthMode): void {
    this.mode = mode;
    this.errorMessage = '';
    this.successMessage = '';
    this.passwordCopied = false;
  }

  toggleLoginPassword(): void {
    this.loginPasswordVisible = !this.loginPasswordVisible;
  }

  toggleRegisterPassword(): void {
    this.registerPasswordVisible = !this.registerPasswordVisible;
  }

  toggleConfirmPassword(): void {
    if (this.registerForm.controls.confirmPassword.disabled) return;
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  generatePassword(): void {
    const password = this.createStrongPassword();
    this.registerForm.controls.password.setValue(password);
    this.registerForm.controls.password.markAsDirty();
    this.registerForm.controls.confirmPassword.reset('');
    this.registerPasswordVisible = true;
    this.confirmPasswordVisible = false;
    this.passwordCopied = false;
  }

  async copyPassword(): Promise<void> {
    const password = this.registerForm.controls.password.value;
    if (!password) return;
    await navigator.clipboard.writeText(password);
    this.passwordCopied = true;
    setTimeout(() => {
      this.passwordCopied = false;
    }, 1800);
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      const { email, password } = this.loginForm.getRawValue();
      await this.authService.login(email, password);
      await this.router.navigate(['/dashboard']);
    } catch {
      this.errorMessage = 'Invalid email or password.';
    } finally {
      this.loading = false;
    }
  }

  async register(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const { displayName, email, password, confirmPassword } = this.registerForm.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      await this.authService.register(email, password, displayName);
      await this.router.navigate(['/invitations']);
    } catch (error: any) {
      this.errorMessage = this.getRegisterError(error?.code);
    } finally {
      this.loading = false;
    }
  }

  async resetPassword(): Promise<void> {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const { email } = this.forgotForm.getRawValue();
      await this.authService.resetPassword(email);
      this.successMessage = 'Password reset email sent. Check your inbox.';
    } catch {
      this.errorMessage = 'Unable to send password reset email.';
    } finally {
      this.loading = false;
    }
  }

  private createStrongPassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*_-+=';
    const all = uppercase + lowercase + numbers + symbols;
    const required = [
      this.randomCharacter(uppercase),
      this.randomCharacter(lowercase),
      this.randomCharacter(numbers),
      this.randomCharacter(symbols),
    ];
    while (required.length < 16) required.push(this.randomCharacter(all));
    return this.shuffle(required).join('');
  }

  private randomCharacter(characters: string): string {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return characters[values[0] % characters.length];
  }

  private shuffle(values: string[]): string[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      const randomValues = new Uint32Array(1);
      crypto.getRandomValues(randomValues);
      const randomIndex = randomValues[0] % (index + 1);
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  private getRegisterError(code?: string): string {
    if (code === 'auth/email-already-in-use') return 'An account already exists with this email.';
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'auth/weak-password') return 'Please use a stronger password.';
    return 'Unable to create your account.';
  }
}
