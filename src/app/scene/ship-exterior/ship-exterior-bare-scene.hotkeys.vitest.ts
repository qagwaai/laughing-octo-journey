import { describe, expect, it } from 'vitest';
import { shouldToggleFlightModeFromKey } from './ship-exterior-bare-scene.component';

describe('ShipExteriorBareScene hotkey policy', () => {
  it('always toggles on KeyF', () => {
    expect(shouldToggleFlightModeFromKey('KeyF', false)).toBe(true);
    expect(shouldToggleFlightModeFromKey('KeyF', true)).toBe(true);
  });

  it('does not disable the always-active pilot controls on Escape', () => {
    expect(shouldToggleFlightModeFromKey('Escape', true)).toBe(false);
    expect(shouldToggleFlightModeFromKey('Escape', false)).toBe(false);
  });

  it('ignores unrelated keys', () => {
    expect(shouldToggleFlightModeFromKey('KeyW', true)).toBe(false);
    expect(shouldToggleFlightModeFromKey('KeyW', false)).toBe(false);
  });
});
