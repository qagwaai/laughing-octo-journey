import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import RepairRetrofitShipDetailPage from './repair-retrofit-ship-detail';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { describeSummaryForSystems } from './repair-retrofit-state';
import {
	createMockSessionService,
	createMockSocketService,
	type MockSocketService,
} from '../../../testing';
import { SHIP_UPSERT_REQUEST_EVENT, SHIP_UPSERT_RESPONSE_EVENT } from '../../model/ship-upsert';
import { ITEM_UPSERT_REQUEST_EVENT, ITEM_UPSERT_RESPONSE_EVENT } from '../../model/item-upsert';

interface NavigationState {
	playerName?: string;
	joinCharacter?: { id: string } | null;
	joinShip?: any;
	damageProfile?: any;
	missionId?: string;
}

type MockSocketWithUpsert = MockSocketService & {
	upsertShip(request: any, cb?: (r: any) => void): void;
	upsertItem(request: any, cb?: (r: any) => void): void;
};

function createSocketWithUpsert(): MockSocketWithUpsert {
	const base = createMockSocketService();
	return Object.assign(base, {
		upsertShip(request: any, cb?: (r: any) => void) {
			if (cb) { base.once(SHIP_UPSERT_RESPONSE_EVENT, cb); }
			base.emit(SHIP_UPSERT_REQUEST_EVENT, request);
		},
		upsertItem(request: any, cb?: (r: any) => void) {
			if (cb) { base.once(ITEM_UPSERT_RESPONSE_EVENT, cb); }
			base.emit(ITEM_UPSERT_REQUEST_EVENT, request);
		},
	});
}

const mockMissionProgressSyncService = {
	syncGateState: () => Promise.resolve('skipped' as const),
};

const mockMissionStateService = {
	lastSaved: { asReadonly: () => () => null },
	loadState: () => null,
	saveState: () => undefined,
};

function setup(state?: NavigationState) {
	const mockRouter = {
		getCurrentNavigation: () => (state ? { extras: { state } } : null),
		navigate: jasmine.createSpy('navigate'),
	};
	const mockSocket = createSocketWithUpsert();
	const mockSession = createMockSessionService('session-key');

	TestBed.configureTestingModule({
		imports: [RepairRetrofitShipDetailPage],
		providers: [
			{ provide: Router, useValue: mockRouter },
			{ provide: SocketService, useValue: mockSocket },
			{ provide: SessionService, useValue: mockSession },
			{ provide: MissionProgressSyncService, useValue: mockMissionProgressSyncService },
			{ provide: ShipExteriorMissionStateService, useValue: mockMissionStateService },
		],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(RepairRetrofitShipDetailPage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter, mockSocket, mockSession };
}

const mockSpatial = { solarSystemId: 'sol', frame: 'barycentric' as const, positionKm: [0, 0, 0] as any, epochMs: 0 };


// ---------------------------------------------------------------------------
// Tests: Initialization
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - initialization', () => {
	it('should initialize signals from navigation state', () => {
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod' },
		});

		expect(component['playerName']()).toBe('Pioneer');
		expect(component['joinCharacter']()?.id).toBe('c-1');
		expect(component['joinShip']()?.id).toBe('s-1');
	});

	it('should fall back to default values when state is absent', () => {
		const { component } = setup();

		expect(component['playerName']()).toBe('');
		expect(component['joinCharacter']()).toBeNull();
		expect(component['joinShip']()).toBeNull();
		expect(component['damageProfile']()).toBeNull();
		expect(component['missionId']()).toBe('first-target');
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({
				playerName: 'Pioneer',
				joinCharacter: { id: 'c-1' },
				joinShip: { id: 's-1', model: 'Scavenger Pod' },
			});
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});

// ---------------------------------------------------------------------------
// Tests: hasHullPatchKit
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - hasHullPatchKit', () => {
	it('should be false when inventory is empty', () => {
		const { component } = setup({
			joinShip: { id: 's-1', model: 'Scavenger Pod', inventory: [] } as any,
		});
		expect(component['hasHullPatchKit']()).toBe(false);
	});

	it('should be true when hull-patch-kit is in inventory', () => {
		const { component } = setup({
			joinShip: {
				id: 's-1', model: 'Scavenger Pod',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit' }],
			} as any,
		});
		expect(component['hasHullPatchKit']()).toBe(true);
	});

	it('should be false when inventory has other items but no hull patch kit', () => {
		const { component } = setup({
			joinShip: {
				id: 's-1', model: 'Scavenger Pod',
				inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }],
			} as any,
		});
		expect(component['hasHullPatchKit']()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Tests: canFullyRepair
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - canFullyRepair', () => {
	it('should be false when damage profile is null', () => {
		const { component } = setup({
			joinShip: {
				id: 's-1', model: 'Scavenger Pod',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			} as any,
		});
		expect(component['canFullyRepair']()).toBe(false);
	});

	it('should be false when ship is intact even with hull patch kit', () => {
		const { component } = setup({
			joinShip: {
				id: 's-1', model: 'Scavenger Pod',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			} as any,
			damageProfile: { overallStatus: 'intact', summary: 'Nominal.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		expect(component['canFullyRepair']()).toBe(false);
	});

	it('should be false when ship is damaged but hull patch kit is missing', () => {
		const { component } = setup({
			joinShip: { id: 's-1', model: 'Scavenger Pod', inventory: [] } as any,
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		expect(component['canFullyRepair']()).toBe(false);
	});

	it('should be true when ship is damaged and hull patch kit is present', () => {
		const { component } = setup({
			joinShip: {
				id: 's-1', model: 'Scavenger Pod',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			} as any,
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		expect(component['canFullyRepair']()).toBe(true);
	});

	it('should be true when ship is disabled and hull patch kit is present', () => {
		const { component } = setup({
			joinShip: {
				id: 's-1', model: 'Scavenger Pod',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			} as any,
			damageProfile: { overallStatus: 'disabled', summary: 'Total failure.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		expect(component['canFullyRepair']()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Tests: getShipName
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - getShipName', () => {
	it('should prefer name over model and id', () => {
		const { component } = setup({
			joinShip: { id: 's-1', name: 'The Iron Nomad', model: 'Scavenger Pod' } as any,
		});
		expect(component['getShipName']()).toBe('The Iron Nomad');
	});

	it('should fall back to model when name is absent', () => {
		const { component } = setup({
			joinShip: { id: 's-1', name: '', model: 'Scavenger Pod' } as any,
		});
		expect(component['getShipName']()).toBe('Scavenger Pod');
	});

	it('should fall back to id when name and model are absent', () => {
		const { component } = setup({
			joinShip: { id: 's-1', name: '', model: '' } as any,
		});
		expect(component['getShipName']()).toBe('s-1');
	});

	it('should return "Ship" when no ship context is set', () => {
		const { component } = setup();
		expect(component['getShipName']()).toBe('Ship');
	});
});

// ---------------------------------------------------------------------------
// Tests: fullyRepairShip guard conditions
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - fullyRepairShip guard', () => {
	it('should report error when damage profile is missing', () => {
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
		});
		component['fullyRepairShip']();
		expect(component['persistError']()).not.toBeNull();
	});

	it('should report error when ship id is missing', () => {
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: '', name: '', model: 'Scavenger Pod' } as any,
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		component['fullyRepairShip']();
		expect(component['persistError']()).not.toBeNull();
	});

	it('should report error when characterId is missing', () => {
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: '' },
			joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		component['fullyRepairShip']();
		expect(component['persistError']()).not.toBeNull();
	});

	it('should report error when playerName is missing', () => {
		const { component } = setup({
			playerName: '',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		component['fullyRepairShip']();
		expect(component['persistError']()).not.toBeNull();
	});

	it('should report error when sessionKey is missing', () => {
		const { component, mockSession } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod' } as any,
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		mockSession.setSessionKey('');
		component['fullyRepairShip']();
		expect(component['persistError']()).not.toBeNull();
	});

	it('should allow repair when all context is present', () => {
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod', spatial: mockSpatial } as any,
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [], origin: 'unknown', updatedAt: '' } as any,
		});
		component['fullyRepairShip']();
		// No guard error — socket call was dispatched (persistError stays null until response)
		expect(component['persistError']()).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Tests: buildRepairedProfile
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - buildRepairedProfile', () => {
	it('should return null when there is no current damage profile', () => {
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod', spatial: mockSpatial } as any,
			// no damageProfile provided
		});
		// With no damageProfile, fullyRepairShip sets persistError immediately
		component['fullyRepairShip']();
		expect(component['persistError']()).not.toBeNull();
		expect(component['damageProfile']()).toBeNull();
	});

	it('should produce an intact profile with no systems', () => {
		const { component, mockSocket } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod', spatial: mockSpatial, inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }] } as any,
			damageProfile: {
				overallStatus: 'damaged',
				summary: 'Breach.',
				systems: [
					{ code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 1 },
				],
				origin: 'unknown',
				updatedAt: '',
			} as any,
		});
		// Trigger the repair and simulate a successful socket response
		component['fullyRepairShip']();
		mockSocket.triggerOnceEvent(SHIP_UPSERT_RESPONSE_EVENT, { success: true });

		expect(component['damageProfile']()?.overallStatus).toBe('intact');
		expect(component['damageProfile']()?.systems.length).toBe(0);
		expect(component['damageProfile']()?.summary).toBe(describeSummaryForSystems([]));
	});
});
