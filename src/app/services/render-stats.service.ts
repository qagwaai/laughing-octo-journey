import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class RenderStatsService {
  readonly enabled = signal(false);

  setEnabled(value: boolean): void {
    this.enabled.set(value);
  }
}