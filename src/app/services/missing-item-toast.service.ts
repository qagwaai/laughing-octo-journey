import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class MissingItemToastService {
  constructor(private snackBar: MatSnackBar) {}

  showMissingItem(itemType: string) {
    this.snackBar.open(
      `Item '${itemType}' is missing from the backend catalog. Please report this to the dev team.`,
      'Dismiss',
      { duration: 8000, panelClass: 'snackbar-error' }
    );
  }
}
