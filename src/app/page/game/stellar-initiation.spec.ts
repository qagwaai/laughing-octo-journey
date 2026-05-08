import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import StellarInitiationPage from './stellar-initiation';

interface NavigationState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
}

function setup(state?: NavigationState) {
	const mockRouter = {
		getCurrentNavigation: () => (state ? { extras: { state } } : null),
		navigate: jasmine.createSpy('navigate'),
	};

	TestBed.configureTestingModule({
		imports: [StellarInitiationPage],
		providers: [{ provide: Router, useValue: mockRouter }],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(StellarInitiationPage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('StellarInitiationPage', () => {
	it('should initialize from navigation state', () => {
		const { component } = setup({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component['playerName']()).toBe('Pioneer');
		expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
	});

	it('should fallback to empty values', () => {
		const { component } = setup();
		expect(component['playerName']()).toBe('');
		expect(component['joinCharacter']()).toBeNull();
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({
				playerName: 'Pioneer',
				joinCharacter: { id: 'c-1', characterName: 'Nova' },
			});
			fixture.detectChanges();
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});
