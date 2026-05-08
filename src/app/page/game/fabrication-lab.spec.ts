import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import FabricationLabPage from './fabrication-lab';
import { PrinterStateService } from '../../services/printer-state.service';
import { createMockPrinterStateService, type MockPrinterStateService } from '../../../testing';

function setup(options: {
	printerService: MockPrinterStateService;
	navigationState?: Record<string, unknown>;
}) {
	const mockRouter = {
		getCurrentNavigation: () =>
			options.navigationState ? { extras: { state: options.navigationState } } : null,
		navigate: jasmine.createSpy('navigate'),
	};

	TestBed.configureTestingModule({
		imports: [FabricationLabPage],
		providers: [
			{ provide: PrinterStateService, useValue: options.printerService },
			{ provide: Router, useValue: mockRouter },
		],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(FabricationLabPage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('FabricationLabPage', () => {
	let printerService: MockPrinterStateService;

	beforeEach(() => {
		printerService = createMockPrinterStateService();
	});

	it('should initialize from navigation state', () => {
		const { component } = setup({
			printerService,
			navigationState: {
				playerName: 'Pioneer',
				joinCharacter: { id: 'c-1', characterName: 'Nova' },
			},
		});

		expect(component['playerName']()).toBe('Pioneer');
		expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
	});

	it('should fallback to empty values', () => {
		const { component } = setup({ printerService });
		expect(component['playerName']()).toBe('');
		expect(component['joinCharacter']()).toBeNull();
	});

	it('should expose idle status and zero active jobs when print queue is empty', () => {
		const { component } = setup({ printerService });
		expect(component['printerStatus']()).toBe('idle');
		expect(component['printerActiveJobCount']()).toBe(0);
	});

	it('should expose printing status when print queue has jobs', () => {
		const { component, fixture } = setup({ printerService });
		printerService.queue.set([{ id: 'job-1', itemType: 'hull-patch-kit', label: 'Hull Patch Kit', startedAt: new Date().toISOString(), durationMs: 60000 }]);
		fixture.detectChanges();
		expect(component['printerStatus']()).toBe('printing');
		expect(component['printerActiveJobCount']()).toBe(1);
	});

	it('should navigate print queue flow with fabrication-lab as left outlet', () => {
		const { component, mockRouter } = setup({
			printerService,
			navigationState: {
				playerName: 'Pioneer',
				joinCharacter: { id: 'c-1', characterName: 'Nova' },
				joinShip: { id: 's-1' },
			},
		});

		component['openPrintQueueView']();

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { right: ['print-queue'], left: ['fabrication-lab'] } }],
			jasmine.objectContaining({
				state: {
					playerName: 'Pioneer',
					joinCharacter: { id: 'c-1', characterName: 'Nova' },
					joinShip: { id: 's-1' },
				},
			}),
		);
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({ printerService });
			fixture.detectChanges();
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});
