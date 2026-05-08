import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HudOverlay } from './hud-overlay';

function setup() {
	TestBed.configureTestingModule({
		imports: [HudOverlay],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	TestBed.overrideComponent(HudOverlay, { set: { imports: [], template: '' } });

	const fixture = TestBed.createComponent(HudOverlay);
	fixture.detectChanges();

	return { fixture, component: fixture.componentInstance };
}

describe('HudOverlay', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('should expose default title and AI label inputs', () => {
		const { component } = setup();

		expect(component.title()).toContain('COLD BOOT');
		expect(component.aiLabel()).toContain('AI LINK');
	});

	it('should accept and expose system checks input', () => {
		const { fixture, component } = setup();

		fixture.componentRef.setInput('systemChecks', [
			'BIOS CHECK... OK',
			'OXYGEN LEVELS... 18% (CRITICAL)',
			'NEURAL LINK... ESTABLISHED',
		]);
		fixture.detectChanges();

		expect(component.systemChecks().length).toBe(3);
		expect(component.systemChecks()[1]).toContain('18%');
	});

	it('should accept and expose AI message input', () => {
		const { fixture, component } = setup();

		fixture.componentRef.setInput('aiMessage', 'Deployment of the last Expendable unit is authorized.');
		fixture.detectChanges();

		expect(component.aiMessage()).toContain('Expendable unit');
	});
});
