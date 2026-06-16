import { Injectable, signal } from '@angular/core';
import type { ShipExteriorViewFacadeSource } from '../scene/ship-exterior/ship-exterior-view-facade';

@Injectable({
  providedIn: 'root',
})
export class ShipExteriorViewHostService {
  private readonly currentSource = signal<ShipExteriorViewFacadeSource | null>(null);

  readonly source = this.currentSource.asReadonly();

  register(source: ShipExteriorViewFacadeSource): void {
    this.currentSource.set(source);
  }

  clear(source: ShipExteriorViewFacadeSource): void {
    if (this.currentSource() === source) {
      this.currentSource.set(null);
    }
  }
}
