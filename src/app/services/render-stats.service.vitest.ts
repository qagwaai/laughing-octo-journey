import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderStatsService } from './render-stats.service';
import { SessionService } from './session.service';

describe('RenderStatsService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('defaults off, supports both values, and does not write to storage', () => {
    const stats = TestBed.inject(RenderStatsService);
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    expect(stats.enabled()).toBe(false);
    stats.setEnabled(true);
    expect(stats.enabled()).toBe(true);
    stats.setEnabled(false);
    expect(stats.enabled()).toBe(false);
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it('preserves the pre-login choice and resets synchronously on logout', () => {
    const stats = TestBed.inject(RenderStatsService);
    const session = TestBed.inject(SessionService);
    stats.setEnabled(true);
    session.setSessionKey('first-session');
    expect(stats.enabled()).toBe(true);
    session.setSessionKey('refreshed-session');
    expect(stats.enabled()).toBe(true);
    session.clearSession();
    expect(stats.enabled()).toBe(false);
    stats.setEnabled(true);
    session.setSessionKey('next-session');
    expect(stats.enabled()).toBe(true);
  });

  it('keeps graphs off when logging in without enabling them first', () => {
    const stats = TestBed.inject(RenderStatsService);
    TestBed.inject(SessionService).setSessionKey('first-session');
    expect(stats.enabled()).toBe(false);
  });

  it('does not restore the setting when the application is recreated', () => {
    TestBed.inject(SessionService).setSessionKey('persisted-session');
    TestBed.inject(RenderStatsService).setEnabled(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(SessionService).hasSession()).toBe(true);
    expect(TestBed.inject(RenderStatsService).enabled()).toBe(false);
  });
});
