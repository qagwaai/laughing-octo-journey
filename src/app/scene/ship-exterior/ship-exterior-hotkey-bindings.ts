import type { HotkeySlot } from './hotkey-flash-controller';

/** Display label of a hotkey entry rendered in the ship-exterior hotkey HUD row. */
export type ShipExteriorHotkeyDisplayKey =
  | 'MOUSE HOVER'
  | 'RMB HOLD'
  | 'W'
  | 'A'
  | 'S'
  | 'D'
  | 'SPACE'
  | 'CTRL / C'
  | 'SHIFT'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | 'ESC'
  | 'Q'
  | 'E';

export type ShipExteriorHotkeyDisplayState = 'disabled' | 'available' | 'pressed';

export interface ShipExteriorHotkeyBinding {
  key: ShipExteriorHotkeyDisplayKey;
  action: string;
  state: ShipExteriorHotkeyDisplayState;
}

/** Minimal shape the HUD needs from a launchable inventory item. */
export interface ShipExteriorHotkeyLaunchItem {
  itemType: string;
  displayName?: string | null;
}

/** Flash keys accepted by the HUD: launch slots are numeric, everything else is a label. */
export type ShipExteriorHotkeyFlashKey = ShipExteriorHotkeyDisplayKey | HotkeySlot;

export interface ShipExteriorHotkeyBindingsInput {
  /** Whether a ship scene context is currently active. */
  hasActiveContext: boolean;
  /** Whether the active context has flight mode enabled. */
  flightModeEnabled: boolean;
  /** Whether the active context currently holds pointer lock (CAPTURE mode). */
  pointerLocked: boolean;
  /** Whether the right mouse button is held during a FREE-mode canvas interaction. */
  rightMouseHeld: boolean;
  /** `KeyboardEvent.code` values currently held for flight movement. */
  heldMovementCodes: ReadonlySet<string>;
  /** Hotkeys inside their transient press-flash window. */
  flashedHotkeys: ReadonlySet<ShipExteriorHotkeyFlashKey>;
  /** Whether a ship is selected for the session. */
  hasActiveShip: boolean;
  /** Launchable inventory items, ordered by launch slot (index 0 is slot 1). */
  launchableItems: readonly ShipExteriorHotkeyLaunchItem[];
  /** Whether the active context has a targeted asteroid that still exists. */
  hasValidLaunchTarget: boolean;
}

/** Launch slots rendered by the HUD, in display order. */
export const SHIP_EXTERIOR_LAUNCH_HOTKEY_SLOTS: readonly HotkeySlot[] = [1, 2, 3, 4, 5];

const MOVEMENT_ENTRIES: readonly {
  key: ShipExteriorHotkeyDisplayKey;
  codes: readonly string[];
  action: string;
}[] = [
  { key: 'W', codes: ['KeyW'], action: 'Forward' },
  { key: 'A', codes: ['KeyA'], action: 'Strafe left' },
  { key: 'S', codes: ['KeyS'], action: 'Reverse' },
  { key: 'D', codes: ['KeyD'], action: 'Strafe right' },
  { key: 'SPACE', codes: ['Space'], action: 'Up' },
  { key: 'CTRL / C', codes: ['ControlLeft', 'ControlRight', 'KeyC'], action: 'Down' },
  { key: 'SHIFT', codes: ['ShiftLeft', 'ShiftRight'], action: 'Boost' },
];

/** Label shown for a launch slot that has no launchable payload assigned. */
export const SHIP_EXTERIOR_EMPTY_LAUNCH_SLOT_ACTION = 'Empty';

function resolveLaunchSlotAction(item: ShipExteriorHotkeyLaunchItem | undefined): string {
  if (!item) {
    return SHIP_EXTERIOR_EMPTY_LAUNCH_SLOT_ACTION;
  }

  return `Launch ${item.displayName?.trim() || item.itemType}`;
}

/**
 * Pure projection of pilot input state onto the ship-exterior hotkey HUD row.
 *
 * Mouse entries are only usable in FREE (unlocked) mode, ESC is only usable in
 * CAPTURE (pointer-locked) mode, movement entries require an active flight
 * context, and launch slots require both a payload and a valid target.
 */
export function buildShipExteriorHotkeyBindings(
  input: ShipExteriorHotkeyBindingsInput,
): readonly ShipExteriorHotkeyBinding[] {
  const mouseFree = input.hasActiveContext && !input.pointerLocked;
  const movementEnabled = input.hasActiveContext && input.flightModeEnabled;

  const movementBindings: ShipExteriorHotkeyBinding[] = MOVEMENT_ENTRIES.map(({ key, codes, action }) => ({
    key,
    action,
    state: !movementEnabled
      ? 'disabled'
      : codes.some((code) => input.heldMovementCodes.has(code))
        ? 'pressed'
        : 'available',
  }));

  const launchBindings = SHIP_EXTERIOR_LAUNCH_HOTKEY_SLOTS.map((slot) => {
    const item = input.launchableItems[slot - 1];
    const available = input.hasActiveContext && input.hasActiveShip && !!item && input.hasValidLaunchTarget;
    return {
      key: String(slot) as ShipExteriorHotkeyDisplayKey,
      action: resolveLaunchSlotAction(item),
      state: !available ? 'disabled' : input.flashedHotkeys.has(slot) ? 'pressed' : 'available',
    } satisfies ShipExteriorHotkeyBinding;
  });

  return [
    { key: 'MOUSE HOVER', action: 'Scan', state: mouseFree ? 'available' : 'disabled' },
    {
      key: 'RMB HOLD',
      action: 'Target',
      state: !mouseFree ? 'disabled' : input.rightMouseHeld ? 'pressed' : 'available',
    },
    ...movementBindings,
    ...launchBindings,
    {
      key: 'ESC',
      action: 'Release controls',
      state: input.flashedHotkeys.has('ESC') ? 'pressed' : input.pointerLocked ? 'available' : 'disabled',
    },
    { key: 'Q', action: 'Roll', state: 'disabled' },
    { key: 'E', action: 'Roll', state: 'disabled' },
  ];
}
