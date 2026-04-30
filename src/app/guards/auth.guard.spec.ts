import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { SessionService } from '../services/session.service';

describe('authGuard', () => {
	let sessionService: jasmine.SpyObj<SessionService>;
	let router: jasmine.SpyObj<Router>;

	beforeEach(() => {
		const sessionSpy = jasmine.createSpyObj<SessionService>('SessionService', [
			'hasSession', 'getSessionKey', 'setSessionKey', 'clearSession',
		]);
		const routerSpy = jasmine.createSpyObj<Router>('Router', [
			'createUrlTree', 'navigate', 'navigateByUrl', 'parseUrl',
		]);
		routerSpy.createUrlTree.and.returnValue({ type: 'redirect' } as unknown as UrlTree);

		TestBed.configureTestingModule({
			providers: [
				{ provide: SessionService, useValue: sessionSpy },
				{ provide: Router, useValue: routerSpy },
			],
		});

		sessionService = TestBed.inject(SessionService) as jasmine.SpyObj<SessionService>;
		router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
	});

	it('should allow activation when a session exists', () => {
		sessionService.hasSession.and.returnValue(true);
		const result = TestBed.runInInjectionContext(() => authGuard(null!, null!));
		expect(result).toBe(true);
		expect(router.createUrlTree).not.toHaveBeenCalled();
	});

	it('should redirect to left:login when no session exists', () => {
		sessionService.hasSession.and.returnValue(false);
		const result = TestBed.runInInjectionContext(() => authGuard(null!, null!));
		expect(router.createUrlTree).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }]);
		expect(result).not.toBe(true);
	});

	it('should return the UrlTree produced by router.createUrlTree on redirect', () => {
		sessionService.hasSession.and.returnValue(false);
		const tree = { url: '/left:login' } as unknown as UrlTree;
		router.createUrlTree.and.returnValue(tree);
		const result = TestBed.runInInjectionContext(() => authGuard(null!, null!));
		expect(result).toBe(tree);
	});

	it('should block activation after session is cleared', () => {
		sessionService.hasSession.and.returnValue(true);
		const allowed = TestBed.runInInjectionContext(() => authGuard(null!, null!));
		expect(allowed).toBe(true);

		sessionService.hasSession.and.returnValue(false);
		const blocked = TestBed.runInInjectionContext(() => authGuard(null!, null!));
		expect(blocked).not.toBe(true);
		expect(router.createUrlTree).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }]);
	});

	it('should allow reactivation after session becomes available', () => {
		sessionService.hasSession.and.returnValue(false);
		const blocked = TestBed.runInInjectionContext(() => authGuard(null!, null!));
		expect(blocked).not.toBe(true);

		sessionService.hasSession.and.returnValue(true);
		const allowed = TestBed.runInInjectionContext(() => authGuard(null!, null!));
		expect(allowed).toBe(true);
	});
});
