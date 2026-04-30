import { ITEM_VIEW_SPECS_CONFIGS } from './item-view-specs-configs';
import { resolveGroups } from './item-view-specs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeShipSummary(overrides: object = {}) {
  return {
    id: 'ship-1',
    name: 'Lucky Star',
    model: 'Scavenger Pod',
    tier: 1,
    status: 'docked',
    ...overrides,
  };
}

function makeShipItem(overrides: object = {}) {
  return {
    id: 'item-1',
    itemType: '3d-printer',
    displayName: '3D Printer',
    tier: 1,
    state: 'contained',
    damageStatus: 'intact',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    destroyedAt: null,
    discoveredAt: null,
    ...overrides,
  };
}

const validKinematics = {
  position: { x: 100, y: 200, z: 300 },
  velocity: { x: 1, y: 2, z: 2 },
  reference: {
    referenceKind: 'barycentric',
    epochMs: 1_000_000,
    distanceUnit: 'km',
    velocityUnit: 'km/s',
  },
};

const zeroVelocityKinematics = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  reference: { referenceKind: 'body-centered', epochMs: 0 },
};

// ── Shared helper to resolve all group fields as a flat map ───────────────────

function fieldMap(config: ReturnType<typeof ITEM_VIEW_SPECS_CONFIGS.get>, item: object): Map<string, string> {
  const map = new Map<string, string>();
  if (!config) return map;
  for (const group of resolveGroups(config, item)) {
    for (const field of group.fields) {
      map.set(field.label, field.displayValue);
    }
  }
  return map;
}

// ── ShipSummary configs ───────────────────────────────────────────────────────

describe('ITEM_VIEW_SPECS_CONFIGS — Scavenger Pod (ShipSummary)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('Scavenger Pod');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('scavenger_pod');
  });

  it('resolves Identity fields from a ShipSummary', () => {
    const fields = fieldMap(config, makeShipSummary());
    expect(fields.get('Name')).toBe('Lucky Star');
    expect(fields.get('Model')).toBe('Scavenger Pod');
    expect(fields.get('Tier')).toBe('1');
    expect(fields.get('Status')).toBe('docked');
  });

  it('falls back to "Unknown Status" when status is null', () => {
    const fields = fieldMap(config, makeShipSummary({ status: null }));
    expect(fields.get('Status')).toBe('Unknown Status');
  });

  it('resolves kinematics fields when kinematics is present', () => {
    const fields = fieldMap(config, makeShipSummary({ kinematics: validKinematics }));
    expect(fields.get('Position')).toMatch(/100\.000.*200\.000.*300\.000/);
    expect(fields.get('Velocity')).toMatch(/1\.000.*2\.000.*2\.000/);
    expect(fields.get('Speed')).toMatch(/3\.000 km\/s/);
    expect(fields.get('Heading')).toBeDefined();
    expect(fields.get('Reference Frame')).toBe('barycentric');
    expect(fields.get('Epoch')).toMatch(/1970/);
  });

  it('omits kinematics fields when kinematics is absent', () => {
    const fields = fieldMap(config, makeShipSummary({ kinematics: null }));
    expect(fields.has('Position')).toBeFalse();
    expect(fields.has('Speed')).toBeFalse();
    expect(fields.has('Heading')).toBeFalse();
  });

  it('shows "Stationary" heading when velocity is zero', () => {
    const fields = fieldMap(config, makeShipSummary({ kinematics: zeroVelocityKinematics }));
    expect(fields.get('Heading')).toContain('Stationary');
  });

  it('uses default units when distanceUnit/velocityUnit are absent', () => {
    const kinematicsWithoutUnits = {
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 0, y: 0, z: 1 },
      reference: { referenceKind: 'barycentric', epochMs: 0 },
    };
    const fields = fieldMap(config, makeShipSummary({ kinematics: kinematicsWithoutUnits }));
    expect(fields.get('Position')).toContain('km');
    expect(fields.get('Velocity')).toContain('km/s');
  });

  it('omits Epoch when epochMs is not a number', () => {
    const noEpoch = { ...validKinematics, reference: { referenceKind: 'barycentric' } };
    const fields = fieldMap(config, makeShipSummary({ kinematics: noEpoch }));
    expect(fields.has('Epoch')).toBeFalse();
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — Expendable Dart Ship (ShipSummary)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('Expendable Dart Ship');

  it('config exists and has no blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeUndefined();
  });

  it('resolves Identity fields', () => {
    const fields = fieldMap(config, makeShipSummary({ model: 'Expendable Dart Ship', name: 'Dart Alpha' }));
    expect(fields.get('Name')).toBe('Dart Alpha');
    expect(fields.get('Model')).toBe('Expendable Dart Ship');
  });
});

// ── ShipItem configs ──────────────────────────────────────────────────────────

describe('ITEM_VIEW_SPECS_CONFIGS — 3D Printer (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('3d-printer');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('three_d_printer');
  });

  it('resolves Identity and Lifecycle fields', () => {
    const fields = fieldMap(config, makeShipItem());
    expect(fields.get('Name')).toBe('3D Printer');
    expect(fields.get('Type')).toBe('3d-printer');
    expect(fields.get('Tier')).toBe('1');
    expect(fields.get('State')).toBe('contained');
    expect(fields.get('Damage Status')).toBe('intact');
    expect(fields.get('Created')).toBe('2026-01-01T00:00:00.000Z');
    expect(fields.get('Updated')).toBe('2026-04-01T00:00:00.000Z');
  });

  it('omits null Lifecycle fields (destroyedAt, discoveredAt)', () => {
    const fields = fieldMap(config, makeShipItem());
    expect(fields.has('Destroyed')).toBeFalse();
    expect(fields.has('Discovered')).toBeFalse();
  });

  it('resolves kinematics fields for an item with kinematics', () => {
    const fields = fieldMap(config, makeShipItem({ kinematics: validKinematics }));
    expect(fields.get('Speed')).toMatch(/3\.000 km\/s/);
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — Expendable Dart Drone (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('expendable-dart-drone');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('expendable_dart_drone');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — basic-mining-laser (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('basic-mining-laser');

  it('config exists and has no blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeUndefined();
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — kinematics edge cases', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('Scavenger Pod')!;

  it('omits kinematics fields when kinematics object lacks position', () => {
    const bad = { ...validKinematics, position: null };
    const fields = fieldMap(config, makeShipSummary({ kinematics: bad }));
    expect(fields.has('Position')).toBeFalse();
    expect(fields.has('Speed')).toBeFalse();
  });

  it('omits kinematics fields when kinematics has no reference', () => {
    const noRef = { position: validKinematics.position, velocity: validKinematics.velocity, reference: null };
    const fields = fieldMap(config, makeShipSummary({ kinematics: noRef }));
    expect(fields.has('Position')).toBeFalse();
  });

  it('omits kinematics fields when item.kinematics is a primitive', () => {
    const fields = fieldMap(config, makeShipSummary({ kinematics: 'not-an-object' }));
    expect(fields.has('Position')).toBeFalse();
  });
});
