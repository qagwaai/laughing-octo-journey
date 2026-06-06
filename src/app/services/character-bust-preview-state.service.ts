import { Injectable, signal } from '@angular/core';
import type { BustDescriptorInput } from '../model/bust-descriptor';

/**
 * Shared state between the character setup left pane and the right-pane bust preview.
 */
@Injectable({ providedIn: 'root' })
export class CharacterBustPreviewStateService {
  private readonly descriptorSignal = signal<BustDescriptorInput | null>(null);

  readonly descriptor = this.descriptorSignal.asReadonly();

  updateDescriptor(descriptor: BustDescriptorInput | null): void {
    this.descriptorSignal.set(descriptor);
  }

  clear(): void {
    this.descriptorSignal.set(null);
  }
}
