import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import ItemViewSpecsPage from './item-view-specs';
import {
	getSpecsImagePath,
	normalizeItemTypeForImage,
	resolveGroups,
	type ItemViewSpecsConfig,
} from '../../model/view/item-view-specs';
import { ITEM_VIEW_SPECS_CONFIGS } from '../../model/catalog/item-view-specs-configs';
import type { ShipItem } from '../../model/ship-item';

interface NavState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
	itemType?: string;
	item?: unknown;
}

function makeDroneItem(overrides?: Partial<ShipItem>): ShipItem {
	const now = '2026-01-01T00:00:00.000Z';
	const { launchable = true, ...restOverrides } = overrides ?? {};
	return {
		id: 'item-1',
		itemType: 'expendable-dart-drone',
		displayName: 'Expendable Dart Drone',
		launchable,
		state: 'contained',
		damageStatus: 'intact',
		container: null,
		owningPlayerId: null,
		owningCharacterId: null,
		spatial: null,
		destroyedAt: null,
		destroyedReason: null,
		discoveredAt: null,
		discoveredByCharacterId: null,
		createdAt: now,
		updatedAt: now,
		...restOverrides,
	};
}

function setup(navigationState?: NavState) {
	const events$ = new Subject<unknown>();
	const mockRouter = {
		events: events$.asObservable(),
		getCurrentNavigation: () => (navigationState ? { extras: { state: navigationState } } : null),
		navigate: jasmine.createSpy('navigate'),
	};

	TestBed.configureTestingModule({
		imports: [ItemViewSpecsPage],
		providers: [{ provide: Router, useValue: mockRouter }],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(ItemViewSpecsPage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter, events$ };
}

describe('normalizeItemTypeForImage', () => {
	it('converts a display name to snake_case', () => {
		expect(normalizeItemTypeForImage('Scavenger Pod')).toBe('scavenger_pod');
	});

	it('converts kebab-case to snake_case', () => {
		expect(normalizeItemTypeForImage('expendable-dart-drone')).toBe('expendable_dart_drone');
	});

	it('lowercases multi-word display names', () => {
		expect(normalizeItemTypeForImage('Basic Mining Laser')).toBe('basic_mining_laser');
	});

	it('strips special characters other than letters, digits, and underscores', () => {
		expect(normalizeItemTypeForImage('item!@#type')).toBe('itemtype');
	});

	it('handles mixed spaces and hyphens', () => {
		expect(normalizeItemTypeForImage('Expendable Dart Ship')).toBe('expendable_dart_ship');
	});
});

describe('getSpecsImagePath', () => {
	it('returns the correct path for a display name itemType', () => {
		expect(getSpecsImagePath('Scavenger Pod')).toBe('images/scavenger_pod_specs.png');
	});

	it('returns the correct path for a kebab-case itemType', () => {
		expect(getSpecsImagePath('expendable-dart-drone')).toBe('images/expendable_dart_drone_specs.png');
	});

	it('returns the correct path for a multi-word itemType', () => {
		expect(getSpecsImagePath('Basic Mining Laser')).toBe('images/basic_mining_laser_specs.png');
	});
});

describe('resolveGroups', () => {
	const simpleConfig: ItemViewSpecsConfig = {
		itemType: 'test-item',
		title: 'Test Item',
		groups: [
			{
				label: 'Identity',
				fields: [
					{ label: 'Name', getValue: (item) => (item as { name: string }).name },
					{ label: 'Type', getValue: (item) => (item as { type: string | null }).type },
				],
			},
			{
				label: 'Status',
				fields: [
					{
						label: 'Value',
						getValue: (item) => (item as { value: number }).value,
						format: (v) => `${v} units`,
					},
				],
			},
		],
	};

	it('returns groups with resolved field values', () => {
		const groups = resolveGroups(simpleConfig, { name: 'Widget', type: 'gadget', value: 42 });
		expect(groups.length).toBe(2);
		expect(groups[0].label).toBe('Identity');
		expect(groups[0].fields).toEqual([
			{ label: 'Name', displayValue: 'Widget' },
			{ label: 'Type', displayValue: 'gadget' },
		]);
	});

	it('applies the format function when provided', () => {
		const groups = resolveGroups(simpleConfig, { name: 'Widget', type: 'gadget', value: 7 });
		const statusGroup = groups.find((g) => g.label === 'Status')!;
		expect(statusGroup.fields[0].displayValue).toBe('7 units');
	});

	it('excludes fields whose getValue returns null', () => {
		const groups = resolveGroups(simpleConfig, { name: 'Widget', type: null, value: 5 });
		const identityGroup = groups.find((g) => g.label === 'Identity')!;
		expect(identityGroup.fields.length).toBe(1);
		expect(identityGroup.fields[0].label).toBe('Name');
	});

	it('excludes groups where all fields return null', () => {
		const groups = resolveGroups(simpleConfig, { name: null, type: null, value: 10 });
		expect(groups.find((g) => g.label === 'Identity')).toBeUndefined();
	});

	it('returns empty array when all groups are empty', () => {
		const nullConfig: ItemViewSpecsConfig = {
			itemType: 'null-item',
			title: 'Null Item',
			groups: [{ label: 'Group', fields: [{ label: 'Field', getValue: () => null }] }],
		};
		expect(resolveGroups(nullConfig, {})).toEqual([]);
	});
});

describe('ITEM_VIEW_SPECS_CONFIGS', () => {
	it('contains a config for Scavenger Pod', () => {
		expect(ITEM_VIEW_SPECS_CONFIGS.has('Scavenger Pod')).toBeTrue();
	});

	it('contains a config for Expendable Dart Ship', () => {
		expect(ITEM_VIEW_SPECS_CONFIGS.has('Expendable Dart Ship')).toBeTrue();
	});

	it('contains a config for expendable-dart-drone', () => {
		expect(ITEM_VIEW_SPECS_CONFIGS.has('expendable-dart-drone')).toBeTrue();
	});

	it('contains a config for basic-mining-laser', () => {
		expect(ITEM_VIEW_SPECS_CONFIGS.has('basic-mining-laser')).toBeTrue();
	});

	it('contains a config for structural-frames', () => {
		expect(ITEM_VIEW_SPECS_CONFIGS.has('structural-frames')).toBeTrue();
	});

	it('contains a config for basic-plating', () => {
		expect(ITEM_VIEW_SPECS_CONFIGS.has('basic-plating')).toBeTrue();
	});

	it('Scavenger Pod config has Identity and Kinematics groups', () => {
		const config = ITEM_VIEW_SPECS_CONFIGS.get('Scavenger Pod')!;
		const groupLabels = config.groups.map((g) => g.label);
		expect(groupLabels).toContain('Identity');
		expect(groupLabels).toContain('Kinematics');
	});

	it('expendable-dart-drone config has Identity and Lifecycle groups', () => {
		const config = ITEM_VIEW_SPECS_CONFIGS.get('expendable-dart-drone')!;
		const groupLabels = config.groups.map((g) => g.label);
		expect(groupLabels).toContain('Identity');
		expect(groupLabels).toContain('Lifecycle');
		expect(groupLabels).toContain('Kinematics');
	});
});

describe('ItemViewSpecsPage', () => {
	it('should initialize state from navigation', () => {
		const drone = makeDroneItem();
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			itemType: 'expendable-dart-drone',
			item: drone,
		});

		expect(component['playerName']()).toBe('Pioneer');
		expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
		expect(component['itemType']()).toBe('expendable-dart-drone');
		expect(component['item']()).toEqual(drone);
	});

	it('should resolve config for a known itemType', () => {
		const { component } = setup({ itemType: 'expendable-dart-drone' });
		expect(component['config']()).not.toBeNull();
		expect(component['config']()?.title).toBe('Expendable Dart Drone');
	});

	it('should return null config for an unknown itemType', () => {
		const { component } = setup({ itemType: 'unknown-item-xyz' });
		expect(component['config']()).toBeNull();
	});

	it('should return empty resolved groups when item is null', () => {
		const { component } = setup({ itemType: 'expendable-dart-drone' });
		expect(component['resolvedGroups']()).toEqual([]);
	});

	it('should resolve Identity group fields for a ShipItem', () => {
		const drone = makeDroneItem();
		const { component } = setup({ itemType: 'expendable-dart-drone', item: drone });

		const identityGroup = component['resolvedGroups']().find((g) => g.label === 'Identity');
		expect(identityGroup).toBeDefined();
		expect(identityGroup!.fields.find((f) => f.label === 'Name')?.displayValue).toBe('Expendable Dart Drone');
		expect(identityGroup!.fields.find((f) => f.label === 'State')?.displayValue).toBe('contained');
		expect(identityGroup!.fields.find((f) => f.label === 'Damage Status')?.displayValue).toBe('intact');
	});

	it('should exclude null fields from Lifecycle group', () => {
		const drone = makeDroneItem({ destroyedAt: null, discoveredAt: null });
		const { component } = setup({ itemType: 'expendable-dart-drone', item: drone });

		const lifecycleGroup = component['resolvedGroups']().find((g) => g.label === 'Lifecycle');
		expect(lifecycleGroup).toBeDefined();
		const fieldLabels = lifecycleGroup!.fields.map((f) => f.label);
		expect(fieldLabels).toContain('Created');
		expect(fieldLabels).toContain('Updated');
		expect(fieldLabels).not.toContain('Destroyed');
		expect(fieldLabels).not.toContain('Discovered');
	});

	it('should exclude Kinematics group when item has no kinematics', () => {
		const drone = makeDroneItem({ kinematics: null });
		const { component } = setup({ itemType: 'expendable-dart-drone', item: drone });

		const kinematicsGroup = component['resolvedGroups']().find((g) => g.label === 'Kinematics');
		expect(kinematicsGroup).toBeUndefined();
	});

	it('should compute the correct spec image path for a kebab-case itemType', () => {
		const { component } = setup({ itemType: 'expendable-dart-drone' });
		expect(component['specImagePath']()).toBe('images/expendable_dart_drone_specs.png');
	});

	it('should compute the correct spec image path for a display-name itemType', () => {
		const { component } = setup({ itemType: 'Scavenger Pod' });
		expect(component['specImagePath']()).toBe('images/scavenger_pod_specs.png');
	});

	it('should set imageNotFound to true on image error', () => {
		const { component } = setup();
		expect(component['imageNotFound']()).toBeFalse();
		component.onImageError();
		expect(component['imageNotFound']()).toBeTrue();
	});

	it('should navigate to character profile with current player and character state', () => {
		const character = { id: 'c-1', characterName: 'Nova' };
		const { component, mockRouter } = setup({ playerName: 'Pioneer', joinCharacter: character });

		component.navigateToCharacterProfile();

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { left: ['character-profile'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: character,
				},
			},
		);
	});

	it('should handle missing navigation state gracefully', () => {
		const { component } = setup();
		expect(component['playerName']()).toBe('');
		expect(component['joinCharacter']()).toBeNull();
		expect(component['itemType']()).toBe('');
		expect(component['item']()).toBeNull();
		expect(component['imageNotFound']()).toBeFalse();
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({ itemType: 'expendable-dart-drone', item: makeDroneItem() });
			fixture.detectChanges();
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});
