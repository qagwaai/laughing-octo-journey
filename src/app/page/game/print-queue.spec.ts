import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import PrintQueuePage from './print-queue';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import { PrinterStateService } from '../../services/printer-state.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import {
	createMockSocketService,
	type MockSocketService,
	createMockSessionService,
	type MockSessionService,
	createMockPrinterStateService,
	type MockPrinterStateService,
} from '../../../testing';
import { signal } from '@angular/core';

function setup(options: {
	socketService: MockSocketService;
	sessionService: MockSessionService;
	printerService: MockPrinterStateService;
	navigationState?: Record<string, unknown>;
}) {
	const mockRouter = {
		getCurrentNavigation: () =>
			options.navigationState ? { extras: { state: options.navigationState } } : null,
		navigate: jasmine.createSpy('navigate'),
	};

	const mockMissionState = { lastSaved: signal(null), loadState: () => null, saveState: () => {} };
	const mockMissionProgressSync = { syncGateState: () => Promise.resolve('skipped' as const) };

	TestBed.configureTestingModule({
		imports: [PrintQueuePage],
		providers: [
			{ provide: SocketService, useValue: options.socketService },
			{ provide: SessionService, useValue: options.sessionService },
			{ provide: PrinterStateService, useValue: options.printerService },
			{ provide: ShipExteriorMissionStateService, useValue: mockMissionState },
			{ provide: MissionProgressSyncService, useValue: mockMissionProgressSync },
			{ provide: Router, useValue: mockRouter },
		],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(PrintQueuePage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('PrintQueuePage', () => {
	let socketService: MockSocketService;
	let sessionService: MockSessionService;
	let printerService: MockPrinterStateService;

	beforeEach(() => {
		socketService = createMockSocketService();
		sessionService = createMockSessionService('test-session-key');
		printerService = createMockPrinterStateService();
	});

	describe('printerStatus()', () => {
		it('should return idle when queue is empty', () => {
			const { component } = setup({ socketService, sessionService, printerService });
			expect(component['printerStatus']()).toBe('idle');
		});

		it('should return printing when queue has items', () => {
			const { component, fixture } = setup({ socketService, sessionService, printerService });
			printerService.queue.set([{ id: 'job-1', itemType: 'hull-patch-kit', label: 'Hull Patch Kit', startedAt: new Date().toISOString(), durationMs: 60000 }]);
			fixture.detectChanges();
			expect(component['printerStatus']()).toBe('printing');
		});
	});

	describe('formatRemainingTime()', () => {
		it('should return 0:00 for zero or negative ms', () => {
			const { component } = setup({ socketService, sessionService, printerService });
			expect(component['formatRemainingTime'](0)).toBe('0:00');
			expect(component['formatRemainingTime'](-1000)).toBe('0:00');
		});

		it('should format under 1 minute correctly', () => {
			const { component } = setup({ socketService, sessionService, printerService });
			expect(component['formatRemainingTime'](30000)).toBe('0:30');
			expect(component['formatRemainingTime'](9000)).toBe('0:09');
		});

		it('should format minutes and seconds correctly', () => {
			const { component } = setup({ socketService, sessionService, printerService });
			expect(component['formatRemainingTime'](90000)).toBe('1:30');
			expect(component['formatRemainingTime'](125000)).toBe('2:05');
		});

		it('should pad seconds with leading zero', () => {
			const { component } = setup({ socketService, sessionService, printerService });
			expect(component['formatRemainingTime'](61000)).toBe('1:01');
		});
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({ socketService, sessionService, printerService });
			fixture.detectChanges();
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});
