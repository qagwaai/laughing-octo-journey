import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { RenderStatsService } from '../../services/render-stats.service';
import SettingsPage from './settings';

describe('SettingsPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('uses a labeled checkbox and retains its value when the page is recreated', async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [provideRouter([])],
    })
      .overrideComponent(SettingsPage, { set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
      .compileComponents();
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-guarded-left-menu')).toBeNull();
    expect(host.querySelector('app-character-ship-badge')).toBeNull();
    expect(host.querySelector('button')?.textContent).toContain('Back');
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(host.querySelector('label')?.textContent).toContain('Show 3d performance graphs');
    expect(checkbox.checked).toBe(false);
    checkbox.click();
    fixture.detectChanges();
    expect(TestBed.inject(RenderStatsService).enabled()).toBe(true);
    fixture.destroy();

    const restored = TestBed.createComponent(SettingsPage);
    restored.detectChanges();
    const restoredHost: HTMLElement = restored.nativeElement;
    const restoredCheckbox = restoredHost.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(restoredCheckbox.checked).toBe(true);
    restoredCheckbox.click();
    expect(TestBed.inject(RenderStatsService).enabled()).toBe(false);
  });
});
