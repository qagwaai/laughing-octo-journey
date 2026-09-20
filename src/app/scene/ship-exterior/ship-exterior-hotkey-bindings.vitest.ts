import { describe, expect, it } from 'vitest';
import {
  buildShipExteriorHotkeyBindings,
  type ShipExteriorHotkeyBinding,
  type ShipExteriorHotkeyBindingsInput,
  type ShipExteriorHotkeyDisplayKey,
  type ShipExteriorHotkeyFlashKey,
} from './ship-exterior-hotkey-bindings';

function createInput(overrides: Partial<ShipExteriorHotkeyBindingsInput> = {}): ShipExteriorHotkeyBindingsInput {
  return {
    hasActiveContext: true,
    flightModeEnabled: true,
    pointerLocked: false,
    rightMouseHeld: false,
    heldMovementCodes: new Set<string>(),
    flashedHotkeys: new Set<ShipExteriorHotkeyFlashKey>(),
    hasActiveShip: true,
    launchableItems: [],
    hasValidLaunchTarget: false,
    ...overrides,
  };
}

function findBinding(
  bindings: readonly ShipExteriorHotkeyBinding[],
  key: ShipExteriorHotkeyDisplayKey,
): ShipExteriorHotkeyBinding {
  const binding = bindings.find((candidate) => candidate.key === key);
  if (!binding) {
    throw new Error(`Expected a hotkey binding for "${key}".`);
  }
  return binding;
}

function stateOf(input: ShipExteriorHotkeyBindingsInput, key: ShipExteriorHotkeyDisplayKey): string {
  return findBinding(buildShipExteriorHotkeyBindings(input), key).state;
}

describe('buildShipExteriorHotkeyBindings', () => {
  it('renders a stable, single-row hotkey order without a flight-toggle entry', () => {
    const keys = buildShipExteriorHotkeyBindings(createInput()).map((binding) => binding.key);

    expect(keys).toEqual([
      'MOUSE HOVER',
      'RMB HOLD',
      'W',
      'A',
      'S',
      'D',
      'SPACE',
      'CTRL / C',
      'SHIFT',
      '1',
      '2',
      '3',
      '4',
      '5',
      'ESC',
      'Q',
      'E',
    ]);
    expect(keys).not.toContain('F');
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe('mouse entries', () => {
    it('offers hover scan and RMB targeting in FREE mode', () => {
      const input = createInput({ pointerLocked: false });

      expect(findBinding(buildShipExteriorHotkeyBindings(input), 'MOUSE HOVER')).toEqual({
        key: 'MOUSE HOVER',
        action: 'Scan',
        state: 'available',
      });
      expect(findBinding(buildShipExteriorHotkeyBindings(input), 'RMB HOLD')).toEqual({
        key: 'RMB HOLD',
        action: 'Target',
        state: 'available',
      });
    });

    it('disables hover scan and RMB targeting in CAPTURE mode', () => {
      const input = createInput({ pointerLocked: true });

      expect(stateOf(input, 'MOUSE HOVER')).toBe('disabled');
      expect(stateOf(input, 'RMB HOLD')).toBe('disabled');
    });

    it('marks RMB pressed only while the right button is held in FREE mode', () => {
      expect(stateOf(createInput({ pointerLocked: false, rightMouseHeld: true }), 'RMB HOLD')).toBe('pressed');
      expect(stateOf(createInput({ pointerLocked: true, rightMouseHeld: true }), 'RMB HOLD')).toBe('disabled');
    });

    it('disables mouse entries without an active scene context', () => {
      const input = createInput({ hasActiveContext: false });

      expect(stateOf(input, 'MOUSE HOVER')).toBe('disabled');
      expect(stateOf(input, 'RMB HOLD')).toBe('disabled');
    });
  });

  describe('ESC entry', () => {
    it('is disabled in FREE mode and available in CAPTURE mode', () => {
      expect(stateOf(createInput({ pointerLocked: false }), 'ESC')).toBe('disabled');
      expect(findBinding(buildShipExteriorHotkeyBindings(createInput({ pointerLocked: true })), 'ESC')).toEqual({
        key: 'ESC',
        action: 'Release controls',
        state: 'available',
      });
    });

    it('is pressed while the release flash is active, even once capture is already released', () => {
      const flashedWhileLocked = createInput({
        pointerLocked: true,
        flashedHotkeys: new Set<ShipExteriorHotkeyFlashKey>(['ESC']),
      });
      const flashedAfterRelease = createInput({
        pointerLocked: false,
        flashedHotkeys: new Set<ShipExteriorHotkeyFlashKey>(['ESC']),
      });

      expect(stateOf(flashedWhileLocked, 'ESC')).toBe('pressed');
      expect(stateOf(flashedAfterRelease, 'ESC')).toBe('pressed');
    });
  });

  describe('movement and boost entries', () => {
    const movementKeys: readonly ShipExteriorHotkeyDisplayKey[] = ['W', 'A', 'S', 'D', 'SPACE', 'CTRL / C', 'SHIFT'];

    it('is available in both FREE and CAPTURE mode while flight mode is enabled', () => {
      for (const mode of [false, true]) {
        const input = createInput({ flightModeEnabled: true, pointerLocked: mode });
        for (const key of movementKeys) {
          expect(stateOf(input, key)).toBe('available');
        }
      }
    });

    it('is disabled when flight mode is off or no context is active', () => {
      const flightOff = createInput({ flightModeEnabled: false });
      const noContext = createInput({ hasActiveContext: false });

      for (const key of movementKeys) {
        expect(stateOf(flightOff, key)).toBe('disabled');
        expect(stateOf(noContext, key)).toBe('disabled');
      }
    });

    it('maps held key codes to the pressed state', () => {
      const input = createInput({ heldMovementCodes: new Set(['KeyW', 'ShiftLeft']) });

      expect(stateOf(input, 'W')).toBe('pressed');
      expect(stateOf(input, 'SHIFT')).toBe('pressed');
      expect(stateOf(input, 'S')).toBe('available');
      expect(stateOf(input, 'A')).toBe('available');
    });

    it('treats every alias code of a combined entry as pressed', () => {
      expect(stateOf(createInput({ heldMovementCodes: new Set(['ControlLeft']) }), 'CTRL / C')).toBe('pressed');
      expect(stateOf(createInput({ heldMovementCodes: new Set(['ControlRight']) }), 'CTRL / C')).toBe('pressed');
      expect(stateOf(createInput({ heldMovementCodes: new Set(['KeyC']) }), 'CTRL / C')).toBe('pressed');
      expect(stateOf(createInput({ heldMovementCodes: new Set(['ShiftRight']) }), 'SHIFT')).toBe('pressed');
    });

    it('keeps held keys from leaking into the pressed state while disabled', () => {
      const input = createInput({ flightModeEnabled: false, heldMovementCodes: new Set(['KeyW']) });

      expect(stateOf(input, 'W')).toBe('disabled');
    });

    it('keeps roll entries disabled because roll is not implemented', () => {
      const bindings = buildShipExteriorHotkeyBindings(createInput({ heldMovementCodes: new Set(['KeyQ', 'KeyE']) }));

      expect(findBinding(bindings, 'Q')).toEqual({ key: 'Q', action: 'Roll', state: 'disabled' });
      expect(findBinding(bindings, 'E')).toEqual({ key: 'E', action: 'Roll', state: 'disabled' });
    });
  });

  describe('launch slots', () => {
    const droneAndProbe = [
      { itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone' },
      { itemType: 'survey-probe', displayName: 'Survey Probe' },
    ];

    it('labels filled slots with the payload name and empty slots as Empty', () => {
      const bindings = buildShipExteriorHotkeyBindings(
        createInput({ launchableItems: droneAndProbe, hasValidLaunchTarget: true }),
      );

      expect(findBinding(bindings, '1').action).toBe('Launch Expendable Dart Drone');
      expect(findBinding(bindings, '2').action).toBe('Launch Survey Probe');
      expect(findBinding(bindings, '3').action).toBe('Empty');
      expect(findBinding(bindings, '4').action).toBe('Empty');
      expect(findBinding(bindings, '5').action).toBe('Empty');
    });

    it('falls back to the item type when the display name is blank', () => {
      const bindings = buildShipExteriorHotkeyBindings(
        createInput({
          launchableItems: [{ itemType: 'expendable-dart-drone', displayName: '   ' }],
          hasValidLaunchTarget: true,
        }),
      );

      expect(findBinding(bindings, '1').action).toBe('Launch expendable-dart-drone');
    });

    it('enables only slots backed by a payload, and never lets an empty slot borrow slot 1', () => {
      const bindings = buildShipExteriorHotkeyBindings(
        createInput({ launchableItems: droneAndProbe, hasValidLaunchTarget: true }),
      );

      expect(findBinding(bindings, '1').state).toBe('available');
      expect(findBinding(bindings, '2').state).toBe('available');
      expect(findBinding(bindings, '3').state).toBe('disabled');
      expect(findBinding(bindings, '4').state).toBe('disabled');
      expect(findBinding(bindings, '5').state).toBe('disabled');
    });

    it('disables every slot without a valid launch target, an active ship, or a context', () => {
      const noTarget = createInput({ launchableItems: droneAndProbe, hasValidLaunchTarget: false });
      const noShip = createInput({ launchableItems: droneAndProbe, hasValidLaunchTarget: true, hasActiveShip: false });
      const noContext = createInput({
        launchableItems: droneAndProbe,
        hasValidLaunchTarget: true,
        hasActiveContext: false,
      });

      for (const key of ['1', '2', '3', '4', '5'] as const) {
        expect(stateOf(noTarget, key)).toBe('disabled');
        expect(stateOf(noShip, key)).toBe('disabled');
        expect(stateOf(noContext, key)).toBe('disabled');
      }
    });

    it('marks a flashed slot pressed only while that slot is otherwise available', () => {
      const flashedAvailable = createInput({
        launchableItems: droneAndProbe,
        hasValidLaunchTarget: true,
        flashedHotkeys: new Set<ShipExteriorHotkeyFlashKey>([1]),
      });
      const flashedWithoutTarget = createInput({
        launchableItems: droneAndProbe,
        hasValidLaunchTarget: false,
        flashedHotkeys: new Set<ShipExteriorHotkeyFlashKey>([1]),
      });

      expect(stateOf(flashedAvailable, '1')).toBe('pressed');
      expect(stateOf(flashedAvailable, '2')).toBe('available');
      expect(stateOf(flashedWithoutTarget, '1')).toBe('disabled');
    });

    it('never reports an empty slot as pressed even when its flash key is set', () => {
      const input = createInput({
        launchableItems: droneAndProbe,
        hasValidLaunchTarget: true,
        flashedHotkeys: new Set<ShipExteriorHotkeyFlashKey>([3]),
      });

      expect(stateOf(input, '3')).toBe('disabled');
      expect(stateOf(input, '1')).toBe('available');
    });
  });

  it('returns a fresh binding list per call so HUD rendering stays pure', () => {
    const input = createInput();

    expect(buildShipExteriorHotkeyBindings(input)).toEqual(buildShipExteriorHotkeyBindings(input));
    expect(buildShipExteriorHotkeyBindings(input)).not.toBe(buildShipExteriorHotkeyBindings(input));
  });
});