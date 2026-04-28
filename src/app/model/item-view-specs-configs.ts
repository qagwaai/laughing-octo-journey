import type { ShipSummary } from './ship-list';
import type { ShipItem } from './ship-item';
import { FieldGroupConfig, ItemViewSpecsConfig } from './item-view-specs';

interface Vector3Like {
	x: number;
	y: number;
	z: number;
}

interface KinematicsLike {
	position: Vector3Like;
	velocity: Vector3Like;
	reference: {
		referenceKind?: string;
		epochMs?: number;
		distanceUnit?: string;
		velocityUnit?: string;
	};
}

function isVector3Like(value: unknown): value is Vector3Like {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const vector = value as Record<string, unknown>;
	return (
		typeof vector['x'] === 'number' &&
		typeof vector['y'] === 'number' &&
		typeof vector['z'] === 'number'
	);
}

function resolveKinematics(item: unknown): KinematicsLike | null {
	if (!item || typeof item !== 'object') {
		return null;
	}

	const candidate = (item as Record<string, unknown>)['kinematics'];
	if (!candidate || typeof candidate !== 'object') {
		return null;
	}

	const kinematics = candidate as Record<string, unknown>;
	if (!isVector3Like(kinematics['position']) || !isVector3Like(kinematics['velocity'])) {
		return null;
	}

	const referenceCandidate = kinematics['reference'];
	if (!referenceCandidate || typeof referenceCandidate !== 'object') {
		return null;
	}

	return {
		position: kinematics['position'] as Vector3Like,
		velocity: kinematics['velocity'] as Vector3Like,
		reference: referenceCandidate as KinematicsLike['reference'],
	};
}

function formatVector(vector: Vector3Like): string {
	return `(${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)})`;
}

function resolveSpeed(kinematics: KinematicsLike): number {
	const { x, y, z } = kinematics.velocity;
	return Math.hypot(x, y, z);
}

function resolveHeading(kinematics: KinematicsLike): Vector3Like | null {
	const speed = resolveSpeed(kinematics);
	if (speed <= Number.EPSILON) {
		return null;
	}

	return {
		x: kinematics.velocity.x / speed,
		y: kinematics.velocity.y / speed,
		z: kinematics.velocity.z / speed,
	};
}

// --- Shared kinematics group ---

const sharedKinematicsGroup: FieldGroupConfig = {
	label: 'Kinematics',
	fields: [
		{
			label: 'Position',
			getValue: (item) => {
				const kinematics = resolveKinematics(item);
				if (!kinematics) return null;
				const unit = kinematics.reference.distanceUnit ?? 'km';
				return `${formatVector(kinematics.position)} ${unit}`;
			},
		},
		{
			label: 'Velocity',
			getValue: (item) => {
				const kinematics = resolveKinematics(item);
				if (!kinematics) return null;
				const unit = kinematics.reference.velocityUnit ?? 'km/s';
				return `${formatVector(kinematics.velocity)} ${unit}`;
			},
		},
		{
			label: 'Speed',
			getValue: (item) => {
				const kinematics = resolveKinematics(item);
				if (!kinematics) {
					return null;
				}

				return resolveSpeed(kinematics);
			},
			format: (value) => `${(value as number).toFixed(3)} km/s`,
		},
		{
			label: 'Heading',
			getValue: (item) => {
				const kinematics = resolveKinematics(item);
				if (!kinematics) {
					return null;
				}

				const heading = resolveHeading(kinematics);
				if (!heading) {
					return 'Stationary (insufficient velocity)';
				}

				return formatVector(heading);
			},
		},
		{
			label: 'Reference Frame',
			getValue: (item) => resolveKinematics(item)?.reference.referenceKind ?? null,
		},
		{
			label: 'Epoch',
			getValue: (item) => {
				const epochMs = resolveKinematics(item)?.reference.epochMs;
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
			labels: [
				{ label: 'OVERALL LENGTH: 3.85 M', topPercent: 11, leftPercent: 12 },
				{ label: 'POD WIDTH: 2.10 M', topPercent: 11, leftPercent: 74 },
			],
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
				{ label: 'OVERALL LENGTH: 1.14 M', topPercent: 11, leftPercent: 10 },
				{ label: 'DIAMETER: 0.18 M', topPercent: 11, leftPercent: 67 },
			],
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
	buildShipItemConfig('3d-printer', '3D Printer'),
	buildShipItemConfig('basic-mining-laser', 'Basic Mining Laser'),
	buildShipItemConfig('structural-frames', 'Structural Frames'),
	buildShipItemConfig('basic-plating', 'Basic Plating'),
];

export const ITEM_VIEW_SPECS_CONFIGS = new Map<string, ItemViewSpecsConfig>(
	ALL_CONFIGS.map(c => [c.itemType, c]),
);
