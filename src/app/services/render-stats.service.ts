import { inject, Injectable, linkedSignal } from '@angular/core';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root',
})
export class RenderStatsService {
  private readonly session = inject(SessionService);
  readonly enabled = linkedSignal<string | null, boolean>({
    source: () => this.session.getSessionKey(),
    computation: (sessionKey, previous) => (sessionKey === null ? false : (previous?.value ?? false)),
  });

  setEnabled(value: boolean): void {
    this.enabled.set(value);
  }
}
