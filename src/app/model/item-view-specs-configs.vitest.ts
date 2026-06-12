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
    expect(config!.blueprint!.blueprintImagePath).toContain('scavenger_pod_blueprint_overlay.png');
    expect(config!.blueprint!.topMetaLabels).toEqual(['OVERALL LENGTH: 3.85 M', 'POD WIDTH: 2.10 M']);
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
    expect(fields.has('Position')).toBe(false);
    expect(fields.has('Speed')).toBe(false);
    expect(fields.has('Heading')).toBe(false);
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
    expect(fields.has('Epoch')).toBe(false);
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
    expect(fields.has('Destroyed')).toBe(false);
    expect(fields.has('Discovered')).toBe(false);
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

  it('positions top labels inward so text does not clip at the stage edge', () => {
    const labels = config!.blueprint?.labels ?? [];
    const overallLength = labels.find((entry) => entry.label === 'OVERALL LENGTH: 1.14 M');
    const diameter = labels.find((entry) => entry.label === 'DIAMETER: 0.18 M');

    expect(overallLength?.leftPercent).toBe(24);
    expect(diameter?.leftPercent).toBe(74);
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — Tractor Beam (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('ship-tractor-beam');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('ship_tractor_beam_blueprint_overlay.svg');
    expect(config!.blueprint!.topMetaLabels).toEqual(['BARREL LENGTH: 2.61 M', 'FIELD APERTURE: 0.52 M']);
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

describe('ITEM_VIEW_SPECS_CONFIGS — Propulsion Manifold (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('propulsion-manifold');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('propulsion_manifold_blueprint_overlay.svg');
    expect(config!.blueprint!.topMetaLabels).toEqual(['OVERALL LENGTH: 2.86 M', 'BODY DIAMETER: 0.46 M']);
  });

  it('resolves Identity fields for propulsion-manifold itemType', () => {
    const fields = fieldMap(
      config,
      makeShipItem({
        itemType: 'propulsion-manifold',
        displayName: 'Propulsion Manifold',
        tier: 2,
      }),
    );

    expect(fields.get('Name')).toBe('Propulsion Manifold');
    expect(fields.get('Type')).toBe('propulsion-manifold');
    expect(fields.get('Tier')).toBe('2');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — Sensor Array (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('sensor-array');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('sensor_array_blueprint_overlay.svg');
    expect(config!.blueprint!.topMetaLabels).toEqual(['ARRAY SPAN: 2.72 M', 'DISH DIAMETER: 0.88 M']);
  });

  it('resolves Identity fields for sensor-array itemType', () => {
    const fields = fieldMap(
      config,
      makeShipItem({
        itemType: 'sensor-array',
        displayName: 'Sensor Array',
        tier: 2,
      }),
    );

    expect(fields.get('Name')).toBe('Sensor Array');
    expect(fields.get('Type')).toBe('sensor-array');
    expect(fields.get('Tier')).toBe('2');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — Power Distribution Bus (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('power-distribution-bus');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('power_distribution_bus_blueprint_overlay.svg');
    expect(config!.blueprint!.topMetaLabels).toEqual(['BUS LENGTH: 2.94 M', 'TRUNK HEIGHT: 0.41 M']);
  });

  it('resolves Identity fields for power-distribution-bus itemType', () => {
    const fields = fieldMap(
      config,
      makeShipItem({
        itemType: 'power-distribution-bus',
        displayName: 'Power Distribution Bus',
        tier: 2,
      }),
    );

    expect(fields.get('Name')).toBe('Power Distribution Bus');
    expect(fields.get('Type')).toBe('power-distribution-bus');
    expect(fields.get('Tier')).toBe('2');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — basic-mining-laser (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('basic-mining-laser');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('basic_mining_laser_blueprint_overlay.svg');
    expect(config!.blueprint!.topMetaLabels).toEqual(['BARREL LENGTH: 2.48 M', 'EMITTER DIAMETER: 0.36 M']);
  });

  it('resolves Identity fields for basic-mining-laser itemType', () => {
    const fields = fieldMap(
      config,
      makeShipItem({
        itemType: 'basic-mining-laser',
        displayName: 'Basic Mining Laser',
        tier: 1,
      }),
    );

    expect(fields.get('Name')).toBe('Basic Mining Laser');
    expect(fields.get('Type')).toBe('basic-mining-laser');
    expect(fields.get('Tier')).toBe('1');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — structural-frames (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('structural-frames');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('structural_frames_blueprint_overlay.svg');
    expect(config!.blueprint!.topMetaLabels).toEqual(['FRAME LENGTH: 3.08 M', 'FRAME HEIGHT: 1.12 M']);
  });

  it('resolves Identity fields for structural-frames itemType', () => {
    const fields = fieldMap(
      config,
      makeShipItem({
        itemType: 'structural-frames',
        displayName: 'Structural Frames',
        tier: 1,
      }),
    );

    expect(fields.get('Name')).toBe('Structural Frames');
    expect(fields.get('Type')).toBe('structural-frames');
    expect(fields.get('Tier')).toBe('1');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — basic-plating (ShipItem)', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('basic-plating');

  it('config exists and has a blueprint', () => {
    expect(config).toBeDefined();
    expect(config!.blueprint).toBeDefined();
    expect(config!.blueprint!.blueprintImagePath).toContain('basic_plating_blueprint_overlay.svg');
    expect(config!.blueprint!.topMetaLabels).toEqual(['PLATE LENGTH: 2.92 M', 'PLATE HEIGHT: 1.06 M']);
  });

  it('resolves Identity fields for basic-plating itemType', () => {
    const fields = fieldMap(
      config,
      makeShipItem({
        itemType: 'basic-plating',
        displayName: 'Basic Plating',
        tier: 1,
      }),
    );

    expect(fields.get('Name')).toBe('Basic Plating');
    expect(fields.get('Type')).toBe('basic-plating');
    expect(fields.get('Tier')).toBe('1');
  });
});

describe('ITEM_VIEW_SPECS_CONFIGS — spatial/motion edge cases', () => {
  const config = ITEM_VIEW_SPECS_CONFIGS.get('Scavenger Pod')!;

  it('omits position fields when spatial object lacks positionKm', () => {
    const bad = { ...validSpatial, positionKm: null };
    const fields = fieldMap(config, makeShipSummary({ spatial: bad, motion: validMotion }));
    expect(fields.has('Position')).toBe(false);
  });

  it('omits velocity fields when motion lacks velocityKmPerSec', () => {
    const noVelocity = { velocityKmPerSec: null };
    const fields = fieldMap(config, makeShipSummary({ spatial: validSpatial, motion: noVelocity }));
    expect(fields.has('Velocity')).toBe(false);
    expect(fields.has('Speed')).toBe(false);
  });

  it('omits spatial fields when item.spatial is a primitive', () => {
    const fields = fieldMap(config, makeShipSummary({ spatial: 'not-an-object', motion: validMotion }));
    expect(fields.has('Position')).toBe(false);
  });
});
