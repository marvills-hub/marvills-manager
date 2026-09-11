import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  loading = false;
  errorMessage = '';

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

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
}
