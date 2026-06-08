import { TestBed } from '@angular/core/testing';
import { LeftPanelNavigationContextService } from './left-panel-navigation-context.service';

describe('LeftPanelNavigationContextService', () => {
  let service: LeftPanelNavigationContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeftPanelNavigationContextService);
  });

  it('should default menu mode to unpinned', () => {
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
});
