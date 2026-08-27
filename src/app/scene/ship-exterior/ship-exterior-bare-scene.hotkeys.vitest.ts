import { describe, expect, it } from 'vitest';
import { shouldToggleFlightModeFromKey } from './ship-exterior-bare-scene.component';

describe('ShipExteriorBareScene hotkey policy', () => {
  it('always toggles on KeyF', () => {
    expect(shouldToggleFlightModeFromKey('KeyF', false)).toBe(true);
    expect(shouldToggleFlightModeFromKey('KeyF', true)).toBe(true);
  });

  it('toggles on Escape only when flight mode is enabled', () => {
    expect(shouldToggleFlightModeFromKey('Escape', true)).toBe(true);
    expect(shouldToggleFlightModeFromKey('Escape', false)).toBe(false);
  });

  it('ignores unrelated keys', () => {
    expect(shouldToggleFlightModeFromKey('KeyW', true)).toBe(false);
    expect(shouldToggleFlightModeFromKey('KeyW', false)).toBe(false);
  });
});
