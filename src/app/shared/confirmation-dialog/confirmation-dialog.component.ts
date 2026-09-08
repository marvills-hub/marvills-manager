import { Component, input, output } from '@angular/core';

export type ConfirmationDialogType = 'default' | 'danger' | 'warning';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss',
})
export class ConfirmationDialogComponent {
  readonly title = input('Confirm Action');

  readonly message = input('Are you sure you want to continue?');

  readonly confirmText = input('Confirm');

  readonly cancelText = input('Cancel');

  readonly type = input<ConfirmationDialogType>('default');

  readonly loading = input(false);

  readonly confirmed = output<void>();

  readonly cancelled = output<void>();

  confirm(): void {
    if (this.loading()) {
      return;
    }

    this.confirmed.emit();
  }

  cancel(): void {
    if (this.loading()) {
      return;
    }

    this.cancelled.emit();
  }
}
