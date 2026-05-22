import { resolveGroups } from './item-view-specs';
import { ITEM_VIEW_SPECS_CONFIGS } from './item-view-specs-configs';

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

const validSpatial = {
  frame: 'barycentric',
  positionKm: { x: 100, y: 200, z: 300 },
  epochMs: 1_000_000,
};

const validMotion = {
  velocityKmPerSec: { x: 1, y: 2, z: 2 },
};

const zeroVelocityMotion = {
  velocityKmPerSec: { x: 0, y: 0, z: 0 },
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

  it('resolves spatial and motion fields when present', () => {
    const fields = fieldMap(config, makeShipSummary({ spatial: validSpatial, motion: validMotion }));
    expect(fields.get('Position')).toMatch(/100\.000.*200\.000.*300\.000/);
    expect(fields.get('Velocity')).toMatch(/1\.000.*2\.000.*2\.000/);
    expect(fields.get('Speed')).toMatch(/3\.000 km\/s/);
    expect(fields.get('Heading')).toBeDefined();
    expect(fields.get('Reference Frame')).toBe('barycentric');
    expect(fields.get('Epoch')).toMatch(/1970/);
  });

  it('omits spatial and motion fields when absent', () => {
    const fields = fieldMap(config, makeShipSummary({ spatial: null, motion: null }));
    expect(fields.has('Position')).toBeFalse();
    expect(fields.has('Speed')).toBeFalse();
    expect(fields.has('Heading')).toBeFalse();
  });

  it('shows "Stationary" heading when velocity is zero', () => {
    const fields = fieldMap(config, makeShipSummary({ spatial: validSpatial, motion: zeroVelocityMotion }));
    expect(fields.get('Heading')).toContain('Stationary');
  });

  it('uses default units for canonical spatial and motion fields', () => {
    const fields = fieldMap(
      config,
      makeShipSummary({
        spatial: { frame: 'barycentric', positionKm: { x: 1, y: 2, z: 3 }, epochMs: 0 },
        motion: { velocityKmPerSec: { x: 0, y: 0, z: 1 } },
      }),
    );
    expect(fields.get('Position')).toContain('km');
    expect(fields.get('Velocity')).toContain('km/s');
  });

  it('omits Epoch when epochMs is not a number', () => {
    const noEpoch = { frame: 'barycentric', positionKm: validSpatial.positionKm };
    const fields = fieldMap(config, makeShipSummary({ spatial: noEpoch, motion: validMotion }));
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

  it('resolves spatial and motion fields for an item with movement state', () => {
    const fields = fieldMap(config, makeShipItem({ spatial: validSpatial, motion: validMotion }));
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

describe('ITEM_VIEW_SPECS_CONFIGS — Tractor Beam (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('ship-tractor-beam');

  it('config exists and has no blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeUndefined();
  });

  it('resolves Identity fields for ship-tractor-beam itemType', () => {
    const fields = fieldMap(
      config,
      makeShipItem({
        itemType: 'ship-tractor-beam',
        displayName: 'Tractor Beam',
        tier: 1,
      }),
    );

    expect(fields.get('Name')).toBe('Tractor Beam');
    expect(fields.get('Type')).toBe('ship-tractor-beam');
    expect(fields.get('Tier')).toBe('1');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — basic-mining-laser (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('basic-mining-laser');

  it('config exists and has no blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeUndefined();
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — spatial/motion edge cases', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('Scavenger Pod')!;

  it('omits position fields when spatial object lacks positionKm', () => {
    const bad = { ...validSpatial, positionKm: null };
    const fields = fieldMap(config, makeShipSummary({ spatial: bad, motion: validMotion }));
    expect(fields.has('Position')).toBeFalse();
  });

  it('omits velocity fields when motion lacks velocityKmPerSec', () => {
    const noVelocity = { velocityKmPerSec: null };
    const fields = fieldMap(config, makeShipSummary({ spatial: validSpatial, motion: noVelocity }));
    expect(fields.has('Velocity')).toBeFalse();
    expect(fields.has('Speed')).toBeFalse();
  });

  it('omits spatial fields when item.spatial is a primitive', () => {
    const fields = fieldMap(config, makeShipSummary({ spatial: 'not-an-object', motion: validMotion }));
    expect(fields.has('Position')).toBeFalse();
  });
});
