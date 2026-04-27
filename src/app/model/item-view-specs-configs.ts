import type { ShipSummary } from './ship-list';
import type { ShipItem } from './ship-item';
import { summarizeShipMotion } from './kinematics';
import { FieldGroupConfig, ItemViewSpecsConfig } from './item-view-specs';

// --- ShipSummary kinematics group ---

const shipSummaryKinematicsGroup: FieldGroupConfig = {
	label: 'Kinematics',
	fields: [
		{
			label: 'Position',
			getValue: (item) => {
				const k = (item as ShipSummary).kinematics;
				if (!k) return null;
				return `(${k.position.x}, ${k.position.y}, ${k.position.z}) ${k.reference.distanceUnit}`;
			},
		},
		{
			label: 'Velocity',
			getValue: (item) => {
				const k = (item as ShipSummary).kinematics;
				if (!k) return null;
				return `(${k.velocity.x}, ${k.velocity.y}, ${k.velocity.z}) ${k.reference.velocityUnit}`;
			},
		},
		{
			label: 'Speed',
			getValue: (item) => {
				const k = (item as ShipSummary).kinematics;
				return k ? summarizeShipMotion(k).speedKmPerSec : null;
			},
			format: (value) => `${(value as number).toFixed(3)} km/s`,
		},
		{
			label: 'Heading',
			getValue: (item) => {
				const k = (item as ShipSummary).kinematics;
				if (!k) return null;
				const motion = summarizeShipMotion(k);
				if (!motion.headingUnitVector) return 'Stationary (insufficient velocity)';
				const h = motion.headingUnitVector;
				return `(${h.x.toFixed(4)}, ${h.y.toFixed(4)}, ${h.z.toFixed(4)})`;
			},
		},
		{
			label: 'Reference Frame',
			getValue: (item) => (item as ShipSummary).kinematics?.reference.referenceKind ?? null,
		},
	],
};

function buildShipSummaryConfig(itemType: string, title: string): ItemViewSpecsConfig {
	return {
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
			shipSummaryKinematicsGroup,
		],
	};
}

// --- ShipItem kinematics group ---

const shipItemKinematicsGroup: FieldGroupConfig = {
	label: 'Kinematics',
	fields: [
		{
			label: 'Position',
			getValue: (item) => {
				const k = (item as ShipItem).kinematics;
				if (!k) return null;
				return `(${k.position.x}, ${k.position.y}, ${k.position.z}) ${k.reference.distanceUnit}`;
			},
		},
		{
			label: 'Velocity',
			getValue: (item) => {
				const k = (item as ShipItem).kinematics;
				if (!k) return null;
				return `(${k.velocity.x}, ${k.velocity.y}, ${k.velocity.z}) ${k.reference.velocityUnit}`;
			},
		},
		{
			label: 'Reference Frame',
			getValue: (item) => (item as ShipItem).kinematics?.reference.referenceKind ?? null,
		},
	],
};

function buildShipItemConfig(itemType: string, title: string): ItemViewSpecsConfig {
	return {
		itemType,
		title,
		groups: [
			{
				label: 'Identity',
				fields: [
					{ label: 'Name', getValue: (item) => (item as ShipItem).displayName },
					{ label: 'Type', getValue: (item) => (item as ShipItem).itemType },
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
			shipItemKinematicsGroup,
		],
	};
}

// --- Registry ---

const ALL_CONFIGS: ItemViewSpecsConfig[] = [
	// ShipSummary configs (keyed by ship model name)
	buildShipSummaryConfig('Scavenger Pod', 'Scavenger Pod'),
	buildShipSummaryConfig('Expendable Dart Ship', 'Expendable Dart Ship'),
	// ShipItem configs (keyed by itemType)
	buildShipItemConfig('expendable-dart-drone', 'Expendable Dart Drone'),
	buildShipItemConfig('basic-mining-laser', 'Basic Mining Laser'),
	buildShipItemConfig('structural-frames', 'Structural Frames'),
	buildShipItemConfig('basic-plating', 'Basic Plating'),
];

export const ITEM_VIEW_SPECS_CONFIGS = new Map<string, ItemViewSpecsConfig>(
	ALL_CONFIGS.map(c => [c.itemType, c]),
);
