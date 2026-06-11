import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { SessionService } from '../services/session.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let sessionService: {
    hasSession: ReturnType<typeof vi.fn>;
    getSessionKey: ReturnType<typeof vi.fn>;
    setSessionKey: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let router: {
    createUrlTree: ReturnType<typeof vi.fn>;
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
    parseUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const sessionSpy = {
      hasSession: vi.fn(),
      getSessionKey: vi.fn(),
      setSessionKey: vi.fn(),
      clearSession: vi.fn(),
    };
    const routerSpy = {
      createUrlTree: vi.fn(),
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
      parseUrl: vi.fn(),
    };
    routerSpy.createUrlTree.mockReturnValue({ type: 'redirect' } as unknown as UrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: sessionSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    sessionService = TestBed.inject(SessionService) as unknown as typeof sessionService;
    router = TestBed.inject(Router) as unknown as typeof router;
  });

  it('should allow activation when a session exists', () => {
    sessionService.hasSession.mockReturnValue(true);
    const result = TestBed.runInInjectionContext(() => authGuard(null!, null!));
    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to left:login when no session exists', () => {
    sessionService.hasSession.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() => authGuard(null!, null!));
    expect(router.createUrlTree).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }]);
    expect(result).not.toBe(true);
  });

  it('should return the UrlTree produced by router.createUrlTree on redirect', () => {
    sessionService.hasSession.mockReturnValue(false);
    const tree = { url: '/left:login' } as unknown as UrlTree;
    router.createUrlTree.mockReturnValue(tree);
    const result = TestBed.runInInjectionContext(() => authGuard(null!, null!));
    expect(result).toBe(tree);
  });

  it('should block activation after session is cleared', () => {
    sessionService.hasSession.mockReturnValue(true);
    const allowed = TestBed.runInInjectionContext(() => authGuard(null!, null!));
    expect(allowed).toBe(true);

    sessionService.hasSession.mockReturnValue(false);
    const blocked = TestBed.runInInjectionContext(() => authGuard(null!, null!));
    expect(blocked).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }]);
  });

  it('should allow reactivation after session becomes available', () => {
    sessionService.hasSession.mockReturnValue(false);
    const blocked = TestBed.runInInjectionContext(() => authGuard(null!, null!));
    expect(blocked).not.toBe(true);

    sessionService.hasSession.mockReturnValue(true);
    const allowed = TestBed.runInInjectionContext(() => authGuard(null!, null!));
    expect(allowed).toBe(true);
  });
});
