export const SHIP_DAMAGE_OVERALL_STATUSES = ['intact', 'damaged', 'disabled', 'destroyed'] as const;
export type ShipDamageOverallStatus = typeof SHIP_DAMAGE_OVERALL_STATUSES[number];

export const SHIP_DAMAGE_SEVERITIES = ['minor', 'major', 'critical'] as const;
export type ShipDamageSeverity = typeof SHIP_DAMAGE_SEVERITIES[number];

export interface ShipSubsystemDamage {
	code: string;
	label: string;
	severity: ShipDamageSeverity;
	summary: string;
	repairPriority: number;
}

export interface ShipDamageProfile {
	overallStatus: ShipDamageOverallStatus;
	summary: string;
	origin: 'cold-boot-scripted' | 'combat' | 'wear' | 'unknown';
	systems: ShipSubsystemDamage[];
	updatedAt: string;
}

export type ShipDamagePreset = 'cold-boot-starter-damaged';

function coerceShipDamageSeverity(raw: unknown): ShipDamageSeverity | null {
	if (typeof raw !== 'string') {
		return null;
	}

	const normalized = raw.trim().toLowerCase();
	return (SHIP_DAMAGE_SEVERITIES as readonly string[]).includes(normalized)
		? (normalized as ShipDamageSeverity)
		: null;
}

function coerceShipDamageOverallStatus(raw: unknown): ShipDamageOverallStatus | null {
	if (typeof raw !== 'string') {
		return null;
	}

	const normalized = raw.trim().toLowerCase();
	return (SHIP_DAMAGE_OVERALL_STATUSES as readonly string[]).includes(normalized)
		? (normalized as ShipDamageOverallStatus)
		: null;
}

function coerceShipSubsystemDamage(raw: unknown): ShipSubsystemDamage | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return null;
	}

	const source = raw as Record<string, unknown>;
	const code = typeof source['code'] === 'string' ? source['code'].trim() : '';
	const label = typeof source['label'] === 'string' ? source['label'].trim() : '';
	const summary = typeof source['summary'] === 'string' ? source['summary'].trim() : '';
	const severity = coerceShipDamageSeverity(source['severity']);
	const repairPriority = typeof source['repairPriority'] === 'number' && Number.isInteger(source['repairPriority'])
		? source['repairPriority']
		: 0;

	if (!code || !label || !summary || !severity) {
		return null;
	}

	return {
		code,
		label,
		severity,
		summary,
		repairPriority,
	};
}

export function coerceShipDamageProfile(raw: unknown): ShipDamageProfile | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return null;
	}

	const source = raw as Record<string, unknown>;
	const overallStatus = coerceShipDamageOverallStatus(source['overallStatus']);
	const summary = typeof source['summary'] === 'string' ? source['summary'].trim() : '';
	const origin = typeof source['origin'] === 'string' ? source['origin'].trim().toLowerCase() : 'unknown';
	const systems = Array.isArray(source['systems'])
		? source['systems'].map((entry) => coerceShipSubsystemDamage(entry)).filter((entry): entry is ShipSubsystemDamage => entry !== null)
		: [];
	const updatedAt = typeof source['updatedAt'] === 'string' && source['updatedAt'].trim().length > 0
		? source['updatedAt']
		: new Date().toISOString();

	if (!overallStatus || !summary) {
		return null;
	}

	return {
		overallStatus,
		summary,
		origin: origin === 'cold-boot-scripted' || origin === 'combat' || origin === 'wear' ? origin : 'unknown',
		systems,
		updatedAt,
	};
}

export function createColdBootStarterShipDamageProfile(nowIso: string = new Date().toISOString()): ShipDamageProfile {
	return {
		overallStatus: 'damaged',
		summary: 'Primary propulsion manifold breach; emergency systems online.',
		origin: 'cold-boot-scripted',
		updatedAt: nowIso,
		systems: [
			{
				code: 'propulsion-manifold',
				label: 'Propulsion Manifold',
				severity: 'critical',
				summary: 'Main thrust line rupture; sustained burn unavailable.',
				repairPriority: 1,
			},
			{
				code: 'sensor-array',
				label: 'Sensor Array',
				severity: 'major',
				summary: 'Long-range targeting scatter beyond operational tolerance.',
				repairPriority: 2,
			},
			{
				code: 'power-distribution',
				label: 'Power Distribution Bus',
				severity: 'major',
				summary: 'Load balancing unstable; nonessential systems power-capped.',
				repairPriority: 3,
			},
		],
	};
}

export function resolveShipDamageProfileFromPreset(
	preset?: ShipDamagePreset,
	nowIso: string = new Date().toISOString(),
): ShipDamageProfile | null {
	if (preset === 'cold-boot-starter-damaged') {
		return createColdBootStarterShipDamageProfile(nowIso);
	}

	return null;
}