import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SolarSystemName } from './solar-system-name';

describe('SolarSystemName (synthetic labels, not published assignments)', () => {
  it.each([
    { displayName: 'TEST-001', settlementName: null, catalogName: null, aliases: [] },
    { displayName: 'TEST-009', settlementName: null, aliases: [] },
    { displayName: '星河 (TEST-002)', settlementName: '星河', catalogName: 'TEST-002', aliases: ['合成'] },
    { displayName: 'اختبار (TEST-003)', settlementName: 'اختبار', catalogName: 'TEST-003', aliases: [] },
    { displayName: 'परीक्षण (TEST-004)', settlementName: 'परीक्षण', catalogName: 'TEST-004', aliases: ['test'] },
    // Missing structured components must not trigger reconstruction from displayName.
    { displayName: '星河 (TEST-005)', settlementName: null, catalogName: null, aliases: [] },
    { displayName: '星河 (TEST-006)', settlementName: '星河', catalogName: null, aliases: [] },
  ])('preserves $displayName exactly once with markup isolation', (name) => {
    const fixture = TestBed.createComponent(SolarSystemName);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
    const primary = fixture.nativeElement.querySelector('[data-testid="system-display-name"]');
    expect(primary.textContent).toBe(name.displayName);
    expect(primary.tagName).toBe('BDI');
    expect(primary.getAttribute('dir')).toBe('auto');
    expect(fixture.nativeElement.textContent).toBe(name.displayName);
    expect(fixture.nativeElement.textContent).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/u);
  });

  it('only shows a supplied, distinct catalog component, without altering its text', () => {
    const fixture = TestBed.createComponent(SolarSystemName);
    fixture.componentRef.setInput('name', {
      displayName: 'TEST legacy',
      settlementName: null,
      catalogName: ' TEST-006 ',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.catalog').textContent).toBe(' TEST-006 ');
    fixture.componentRef.setInput('name', { displayName: 'TEST legacy', settlementName: null, catalogName: '' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.catalog')).toBeNull();
  });

  it.each([
    { displayName: 'KOI-10', settlementName: null, catalogName: 'KOI-1' },
    { displayName: 'Object KOI-10 candidate', settlementName: null, catalogName: 'KOI-1' },
  ])('keeps a catalog that is only a prefix or substring of $displayName', (name) => {
    const fixture = TestBed.createComponent(SolarSystemName);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="system-display-name"]').textContent).toBe(
      name.displayName,
    );
    expect(fixture.nativeElement.querySelector('.catalog').textContent).toBe(name.catalogName);
  });

  it.each([
    { displayName: 'TEST-007', settlementName: null, catalogName: 'TEST-007' },
    { displayName: '星河 (TEST-008)', settlementName: '星河', catalogName: 'TEST-008' },
  ])('suppresses only exact duplicate catalog labels: $displayName', (name) => {
    const fixture = TestBed.createComponent(SolarSystemName);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="system-display-name"]').textContent).toBe(
      name.displayName,
    );
    expect(fixture.nativeElement.querySelector('.catalog')).toBeNull();
  });
});
