import { PlayerCharacterSummary } from '../../model/character-list';
import { ShipDamageProfile, ShipSubsystemDamage } from '../../model/ship-damage';
import { ShipSummary } from '../../model/ship-list';

export type RepairAssetKind = 'ship' | 'ship-system' | 'inventory-item';
export type RepairAssetFilter = 'all' | 'needs-repair' | 'critical-only' | 'intact-only';
export type RepairAssetGrouping = 'asset-type' | 'severity' | 'priority-band';

export interface RepairAssetEntry {
	key: string;
	kind: RepairAssetKind;
	label: string;
	severity: string;
	summary: string;
	repairPriority?: number;
	shipId: string;
	systemCode?: string;
	itemId?: string;
}

export interface RepairDetailNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary | null;
	joinShip?: ShipSummary | null;
	damageProfile?: ShipDamageProfile | null;
	asset?: RepairAssetEntry;
	selectedFilter?: RepairAssetFilter;
	selectedGrouping?: RepairAssetGrouping;
	searchQuery?: string;
	missionId?: string;
}

export function mapOverallStatusToShipStatus(overallStatus: ShipDamageProfile['overallStatus']): string {
	if (overallStatus === 'intact') {
		return 'Operational';
	}

	if (overallStatus === 'disabled' || overallStatus === 'destroyed') {
		return 'Disabled';
	}

	return 'Damaged';
}

export function resolveOverallStatusFromSystems(systems: readonly ShipSubsystemDamage[]): ShipDamageProfile['overallStatus'] {
	if (systems.length === 0) {
		return 'intact';
	}

	if (systems.some((system) => system.severity === 'critical')) {
		return 'disabled';
	}

	return 'damaged';
}

export function describeSummaryForSystems(systems: readonly ShipSubsystemDamage[]): string {
	if (systems.length === 0) {
		return 'All critical ship systems stabilized and nominal.';
	}

	const criticalCount = systems.filter((system) => system.severity === 'critical').length;
	if (criticalCount > 0) {
		return `Critical damage remains in ${criticalCount} subsystem${criticalCount > 1 ? 's' : ''}.`;
	}

	const majorCount = systems.filter((system) => system.severity === 'major').length;
	if (majorCount > 0) {
		return `Major damage remains in ${majorCount} subsystem${majorCount > 1 ? 's' : ''}.`;
	}

	return 'Minor damage remains. Full restoration pending final calibration.';
}
