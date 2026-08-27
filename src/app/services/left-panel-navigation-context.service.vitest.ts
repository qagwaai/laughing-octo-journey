import { TestBed } from '@angular/core/testing';
import { LeftPanelNavigationContextService } from './left-panel-navigation-context.service';

describe('LeftPanelNavigationContextService', () => {
  let service: LeftPanelNavigationContextService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeftPanelNavigationContextService);
  });

  it('should default menu mode to unpinned when no stored value exists', () => {
    expect(service.menuMode()).toBe('unpinned');
  });

  it('should update menu mode when setMenuMode is called', () => {
    service.setMenuMode('pinned');
    expect(service.menuMode()).toBe('pinned');

    service.setMenuMode('keep-mini');
    expect(service.menuMode()).toBe('keep-mini');

    service.setMenuMode('unpinned');
    expect(service.menuMode()).toBe('unpinned');
  });

  it('should persist menu mode to localStorage when setMenuMode is called', () => {
    service.setMenuMode('pinned');
    expect(localStorage.getItem('guarded_left_menu_pin_state')).toBe('pinned');

    service.setMenuMode('keep-mini');
    expect(localStorage.getItem('guarded_left_menu_pin_state')).toBe('keep-mini');
  });

  it('should restore menu mode from localStorage on construction', () => {
    localStorage.setItem('guarded_left_menu_pin_state', 'pinned');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(LeftPanelNavigationContextService);
    expect(freshService.menuMode()).toBe('pinned');
  });

  it('should restore menu mode from localStorage on updateContext', () => {
    localStorage.setItem('guarded_left_menu_pin_state', 'keep-mini');
    service.updateContext('player1', null);
    expect(service.menuMode()).toBe('keep-mini');
  });

  it('should ignore invalid stored menu mode values', () => {
    localStorage.setItem('guarded_left_menu_pin_state', 'invalid-value');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(LeftPanelNavigationContextService);
    expect(freshService.menuMode()).toBe('unpinned');
  });

  it('should reset menu mode to unpinned on clearContext', () => {
    service.setMenuMode('pinned');
    service.clearContext();
    expect(service.menuMode()).toBe('unpinned');
  });

  it('should restore menu mode from localStorage after clearContext when updateContext is called', () => {
    service.setMenuMode('keep-mini');
    service.clearContext();
    expect(service.menuMode()).toBe('unpinned');

    service.updateContext('player1', null);
    expect(service.menuMode()).toBe('keep-mini');
  });
});
