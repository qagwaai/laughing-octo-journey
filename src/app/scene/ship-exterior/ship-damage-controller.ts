import { signal, type Signal } from '@angular/core';
import {
  coerceShipDamageProfile,
  resolveShipDamageProfileFromPreset,
  type ShipDamagePreset,
  type ShipDamageProfile,
} from '../../model/ship-damage';
import type { ShipSummary } from '../../model/ship-list';

/**
 * Owns the active ship damage profile signal and resolves it from either an
 * explicit ship summary payload or a mission-supplied fallback preset.
 *
 * Plain class so it can be unit-tested without TestBed.
 */
export class ShipDamageController {
  private readonly profile = signal<ShipDamageProfile | null>(null);

  /** Read-only view of the resolved damage profile (or null when unknown). */
  readonly current: Signal<ShipDamageProfile | null> = this.profile.asReadonly();

  constructor(
    private readonly fallbackPreset: ShipDamagePreset | undefined,
    initialShip?: ShipSummary | undefined,
  ) {
    if (initialShip !== undefined) {
      this.resolveFromShipSummary(initialShip);
    }
  }

  /**
   * Resolves and stores the damage profile from a ship summary payload, falling
   * back to the controller's mission-supplied preset when the payload omits one.
   */
  resolveFromShipSummary(ship: ShipSummary | undefined): void {
    const explicit = coerceShipDamageProfile(ship?.damageProfile);
    this.profile.set(explicit ?? resolveShipDamageProfileFromPreset(this.fallbackPreset));
  }
}
