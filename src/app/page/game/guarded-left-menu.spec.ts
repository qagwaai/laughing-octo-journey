import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GuardedLeftMenu } from './guarded-left-menu';

describe('GuardedLeftMenu', () => {
	let component: GuardedLeftMenu;
	let fixture: ComponentFixture<GuardedLeftMenu>;
	let navigateSpy: jasmine.Spy;

	beforeEach(async () => {
		sessionStorage.clear();
		navigateSpy = jasmine.createSpy('navigate');

		await TestBed.configureTestingModule({
			imports: [GuardedLeftMenu],
			providers: [{ provide: Router, useValue: { navigate: navigateSpy } }],
		})
			.overrideComponent(GuardedLeftMenu, {
				set: {
					template: '',
				},
			})
			.compileComponents();

		fixture = TestBed.createComponent(GuardedLeftMenu);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		sessionStorage.clear();
	});

	it('should default to minimized and unpinned', () => {
		expect((component as any).isPinned()).toBeFalse();
		expect((component as any).isExpanded()).toBeFalse();
	});

	it('should expand on hover when unpinned', () => {
		(component as any).onMouseEnter();
		expect((component as any).isExpanded()).toBeTrue();

		(component as any).onMouseLeave();
		expect((component as any).isExpanded()).toBeFalse();
	});

	it('should stay expanded when pinned and persist that state', () => {
		(component as any).togglePinned();

		expect((component as any).isPinned()).toBeTrue();
		expect((component as any).isExpanded()).toBeTrue();
		expect(sessionStorage.getItem('guarded-left-menu:pinned')).toBe('true');

		(component as any).onMouseLeave();
		expect((component as any).isExpanded()).toBeTrue();
	});

	it('should restore pinned state from session storage', async () => {
		sessionStorage.setItem('guarded-left-menu:pinned', 'true');

		const restoredFixture = TestBed.createComponent(GuardedLeftMenu);
		const restoredComponent = restoredFixture.componentInstance;

		expect((restoredComponent as any).isPinned()).toBeTrue();
		expect((restoredComponent as any).isExpanded()).toBeTrue();
	});

	it('should navigate with preserved player and character state', () => {
		component.playerName = 'Pioneer';
		component.joinCharacter = { id: 'c-1', characterName: 'Nova' } as any;

		component.navigateLeft('market-hub');

		expect(navigateSpy).toHaveBeenCalledWith([{ outlets: { left: ['market-hub'] } }], {
			preserveFragment: true,
			state: {
				playerName: 'Pioneer',
				joinCharacter: { id: 'c-1', characterName: 'Nova' },
			},
		});
	});
});