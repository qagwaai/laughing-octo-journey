import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CurrentRoute } from './current';

function setup() {
	TestBed.configureTestingModule({
		imports: [CurrentRoute],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	TestBed.overrideComponent(CurrentRoute, {
		set: {
			imports: [],
			template: '',
		},
	});

	const fixture = TestBed.createComponent(CurrentRoute);
	fixture.componentRef.setInput('text', 'Current Route');
	fixture.detectChanges();

	return { fixture, component: fixture.componentInstance };
}

describe('CurrentRoute', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('should create component instance', () => {
		const { component } = setup();
		expect(component).toBeTruthy();
	});

	it('should expose default position input', () => {
		const { component } = setup();
		expect(component.position()).toEqual([0, 0, 0]);
	});

	it('should require and expose text input', () => {
		const { component } = setup();
		expect(component.text()).toBe('Current Route');
	});

	it('should accept position override', () => {
		const { fixture, component } = setup();

		fixture.componentRef.setInput('position', [1, 2, 3]);
		fixture.detectChanges();

		expect(component.position()).toEqual([1, 2, 3]);
	});

	it('should accept text override', () => {
		const { fixture, component } = setup();

		fixture.componentRef.setInput('text', '/ship-view-specs // G-Class // T2');
		fixture.detectChanges();

		expect(component.text()).toBe('/ship-view-specs // G-Class // T2');
	});

});
