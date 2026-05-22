/**
 * Item-to-specsheet configuration map used by item-view-specs UI rendering.
 */
import type { ShipItem } from '../ship-item';
import type { ShipSummary } from '../ship-list';
import { FieldGroupConfig, ItemViewSpecsConfig } from '../view/item-view-specs';

interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

interface SpatialLike {
  frame?: string;
  positionKm: Vector3Like;
  epochMs?: number;
}

interface MotionLike {
  velocityKmPerSec: Vector3Like;
}

function isVector3Like(value: unknown): value is Vector3Like {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const vector = value as Record<string, unknown>;
  return typeof vector['x'] === 'number' && typeof vector['y'] === 'number' && typeof vector['z'] === 'number';
}

function resolveSpatial(item: unknown): SpatialLike | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const candidate = (item as Record<string, unknown>)['spatial'];
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const spatial = candidate as Record<string, unknown>;
  if (!isVector3Like(spatial['positionKm'])) {
    return null;
  }

  return {
    frame: typeof spatial['frame'] === 'string' ? spatial['frame'] : undefined,
    positionKm: spatial['positionKm'] as Vector3Like,
    epochMs: typeof spatial['epochMs'] === 'number' ? spatial['epochMs'] : undefined,
  };
}

function resolveMotion(item: unknown): MotionLike | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const candidate = (item as Record<string, unknown>)['motion'];
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const motion = candidate as Record<string, unknown>;
  if (!isVector3Like(motion['velocityKmPerSec'])) {
    return null;
  }

  return {
    velocityKmPerSec: motion['velocityKmPerSec'] as Vector3Like,
  };
}

function formatVector(vector: Vector3Like): string {
  return `(${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)})`;
}

function resolveSpeed(motion: MotionLike): number {
  const { x, y, z } = motion.velocityKmPerSec;
  return Math.hypot(x, y, z);
}

function resolveHeading(motion: MotionLike): Vector3Like | null {
  const speed = resolveSpeed(motion);
  if (speed <= Number.EPSILON) {
    return null;
  }

  return {
    x: motion.velocityKmPerSec.x / speed,
    y: motion.velocityKmPerSec.y / speed,
    z: motion.velocityKmPerSec.z / speed,
  };
}

// --- Shared kinematics group ---

const sharedKinematicsGroup: FieldGroupConfig = {
  label: 'Kinematics',
  fields: [
    {
      label: 'Position',
      getValue: (item) => {
        const spatial = resolveSpatial(item);
        if (!spatial) return null;
        return `${formatVector(spatial.positionKm)} km`;
      },
    },
    {
      label: 'Velocity',
      getValue: (item) => {
        const motion = resolveMotion(item);
        if (!motion) return null;
        return `${formatVector(motion.velocityKmPerSec)} km/s`;
      },
    },
    {
      label: 'Speed',
      getValue: (item) => {
        const motion = resolveMotion(item);
        if (!motion) {
          return null;
        }

        return resolveSpeed(motion);
      },
      format: (value) => `${(value as number).toFixed(3)} km/s`,
    },
    {
      label: 'Heading',
      getValue: (item) => {
        const motion = resolveMotion(item);
        if (!motion) {
          return null;
        }

        const heading = resolveHeading(motion);
        if (!heading) {
          return 'Stationary (insufficient velocity)';
        }

        return formatVector(heading);
      },
    },
    {
      label: 'Reference Frame',
      getValue: (item) => resolveSpatial(item)?.frame ?? null,
    },
    {
      label: 'Epoch',
      getValue: (item) => {
        const epochMs = resolveSpatial(item)?.epochMs;
        if (typeof epochMs !== 'number') {
          return null;
        }

        return new Date(epochMs).toISOString();
      },
    },
  ],
};

function buildShipSummaryConfig(itemType: string, title: string): ItemViewSpecsConfig {
  const config: ItemViewSpecsConfig = {
    itemType,
    title,
    groups: [
      {
        label: 'Identity',
        fields: [
          { label: 'Name', getValue: (item) => (item as ShipSummary).name },
          { label: 'Model', getValue: (item) => (item as ShipSummary).model },
          { label: 'Tier', getValue: (item) => (item as ShipSummary).tier },
          { label: 'Status', getValue: (item) => (item as ShipSummary).status ?? 'Unknown Status' },
        ],
      },
      sharedKinematicsGroup,
    ],
  };

  if (itemType === 'Scavenger Pod') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // MANUAL OPERATED UTILITY VESSEL',
      classificationLine: 'HANGAR BLUEPRINT PROFILE',
      footerTag: '[ L-BRACKET_SYSTEM_READY ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/scavenger_pod_blueprint_overlay.png',
      topMetaLabels: ['OVERALL LENGTH: 3.85 M', 'POD WIDTH: 2.10 M'],
      labels: [],
    };
  }

  return config;
}

function buildShipItemConfig(itemType: string, title: string): ItemViewSpecsConfig {
  const config: ItemViewSpecsConfig = {
    itemType,
    title,
    groups: [
      {
        label: 'Identity',
        fields: [
          { label: 'Name', getValue: (item) => (item as ShipItem).displayName },
          { label: 'Type', getValue: (item) => (item as ShipItem).itemType },
          { label: 'Tier', getValue: (item) => (item as ShipItem).tier ?? null },
          { label: 'State', getValue: (item) => (item as ShipItem).state },
          { label: 'Damage Status', getValue: (item) => (item as ShipItem).damageStatus },
        ],
      },
      {
        label: 'Lifecycle',
        fields: [
          { label: 'Created', getValue: (item) => (item as ShipItem).createdAt },
          { label: 'Updated', getValue: (item) => (item as ShipItem).updatedAt },
          { label: 'Destroyed', getValue: (item) => (item as ShipItem).destroyedAt },
          { label: 'Discovered', getValue: (item) => (item as ShipItem).discoveredAt },
        ],
      },
      sharedKinematicsGroup,
    ],
  };

  if (itemType === '3d-printer') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // SHIPBOARD FABRICATION MODULE',
      classificationLine: 'FABRICATION BLUEPRINT PROFILE',
      footerTag: '[ PRINT_CELL_CALIBRATED ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/three_d_printer_blueprint_overlay.svg',
      labels: [
        { label: 'OVERALL WIDTH: 2.40 M', topPercent: 11, leftPercent: 10 },
        { label: 'OVERALL HEIGHT: 2.20 M', topPercent: 11, leftPercent: 67 },
      ],
    };
  }

  if (itemType === 'expendable-dart-drone') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // AUTONOMOUS STRIKE MUNITION',
      classificationLine: 'ORDNANCE BLUEPRINT PROFILE',
      footerTag: '[ ARMING_SEQUENCE_STANDBY ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/expendable_dart_drone_blueprint_overlay.svg',
      labels: [
        { label: 'OVERALL LENGTH: 1.14 M', topPercent: 11, leftPercent: 24 },
        { label: 'DIAMETER: 0.18 M', topPercent: 11, leftPercent: 74 },
      ],
    };
  }

  if (itemType === 'propulsion-manifold') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // PROPULSION FLOW REGULATION MODULE',
      classificationLine: 'DRIVE TRAIN BLUEPRINT PROFILE',
      footerTag: '[ THERMAL_LOOP_BALANCED ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/propulsion_manifold_blueprint_overlay.svg',
      topMetaLabels: ['OVERALL LENGTH: 2.86 M', 'BODY DIAMETER: 0.46 M'],
      labels: [],
    };
  }

  if (itemType === 'sensor-array') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // MULTI-SPECTRAL SENSOR CLUSTER',
      classificationLine: 'TELEMETRY BLUEPRINT PROFILE',
      footerTag: '[ SIGNAL_LOCK_STABLE ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/sensor_array_blueprint_overlay.svg',
      topMetaLabels: ['ARRAY SPAN: 2.72 M', 'DISH DIAMETER: 0.88 M'],
      labels: [],
    };
  }

  if (itemType === 'power-distribution-bus') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // SHIPBOARD POWER ROUTING MODULE',
      classificationLine: 'ENERGY GRID BLUEPRINT PROFILE',
      footerTag: '[ LOAD_BALANCER_SYNCED ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/power_distribution_bus_blueprint_overlay.svg',
      topMetaLabels: ['BUS LENGTH: 2.94 M', 'TRUNK HEIGHT: 0.41 M'],
      labels: [],
    };
  }

  if (itemType === 'ship-tractor-beam') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // VECTOR-LOCK MATERIAL HANDLING ARRAY',
      classificationLine: 'TRACTOR FIELD BLUEPRINT PROFILE',
      footerTag: '[ BEAM_ENVELOPE_STABLE ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/ship_tractor_beam_blueprint_overlay.svg',
      topMetaLabels: ['BARREL LENGTH: 2.61 M', 'FIELD APERTURE: 0.52 M'],
      labels: [],
    };
  }

  if (itemType === 'basic-mining-laser') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // ENTRY-GRADE MATERIAL EXTRACTION LASER',
      classificationLine: 'MINING SYSTEM BLUEPRINT PROFILE',
      footerTag: '[ LENS_CALIBRATION_READY ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/basic_mining_laser_blueprint_overlay.svg',
      topMetaLabels: ['BARREL LENGTH: 2.48 M', 'EMITTER DIAMETER: 0.36 M'],
      labels: [],
    };
  }

  if (itemType === 'structural-frames') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // REINFORCED HULL SUBSTRUCTURE KIT',
      classificationLine: 'CHASSIS BLUEPRINT PROFILE',
      footerTag: '[ FRAME_STRESS_NORMALIZED ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/structural_frames_blueprint_overlay.svg',
      topMetaLabels: ['FRAME LENGTH: 3.08 M', 'FRAME HEIGHT: 1.12 M'],
      labels: [],
    };
  }

  if (itemType === 'basic-plating') {
    config.blueprint = {
      unitLine: 'PROJECT STELLAR // STANDARD HULL PLATING MODULE',
      classificationLine: 'ARMOR BLUEPRINT PROFILE',
      footerTag: '[ IMPACT_LAYER_ALIGNED ]',
      backgroundImagePath: 'images/scavenger_pod_blueprint_bg.png',
      blueprintImagePath: 'images/basic_plating_blueprint_overlay.svg',
      topMetaLabels: ['PLATE LENGTH: 2.92 M', 'PLATE HEIGHT: 1.06 M'],
      labels: [],
    };
  }

  return config;
}

// --- Registry ---

const ALL_CONFIGS: ItemViewSpecsConfig[] = [
  // ShipSummary configs (keyed by ship model name)
  buildShipSummaryConfig('Scavenger Pod', 'Scavenger Pod'),
  buildShipSummaryConfig('Expendable Dart Ship', 'Expendable Dart Ship'),
  // ShipItem configs (keyed by itemType)
  buildShipItemConfig('expendable-dart-drone', 'Expendable Dart Drone'),
  buildShipItemConfig('propulsion-manifold', 'Propulsion Manifold'),
  buildShipItemConfig('sensor-array', 'Sensor Array'),
  buildShipItemConfig('power-distribution-bus', 'Power Distribution Bus'),
  buildShipItemConfig('ship-tractor-beam', 'Tractor Beam'),
  buildShipItemConfig('3d-printer', '3D Printer'),
  buildShipItemConfig('basic-mining-laser', 'Basic Mining Laser'),
  buildShipItemConfig('structural-frames', 'Structural Frames'),
  buildShipItemConfig('basic-plating', 'Basic Plating'),
];

export const ITEM_VIEW_SPECS_CONFIGS = new Map<string, ItemViewSpecsConfig>(ALL_CONFIGS.map((c) => [c.itemType, c]));
