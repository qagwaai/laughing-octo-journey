import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExternalAnchorItem, ExternalAnchorsComponent } from './external-anchors';

@Component({
  template: `<app-external-anchors [layout]="layout" />`,
  imports: [ExternalAnchorsComponent],
})
class DefaultHostComponent {
  layout: 'inline' | 'stack' = 'inline';
}

@Component({
  template: `<app-external-anchors [anchors]="anchors" [layout]="layout" />`,
  imports: [ExternalAnchorsComponent],
})
class AnchoredHostComponent {
  anchors: ReadonlyArray<ExternalAnchorItem> = [];
  layout: 'inline' | 'stack' = 'inline';
}

describe('ExternalAnchorsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultHostComponent, AnchoredHostComponent],
    }).compileComponents();
  });

  it('should render the shared default anchor when no anchors are provided', () => {
    const fixture = TestBed.createComponent(DefaultHostComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('a.angular-three-mark');
    expect(links.length).toBe(4);
    expect(links[0].getAttribute('href')).toBe('https://angularthree.org');
    expect(links[0].textContent?.trim()).toContain('Angular Three');
  });

  it('should render each provided anchor with secure defaults', () => {
    const fixture = TestBed.createComponent(AnchoredHostComponent);
    const host = fixture.componentInstance;
    host.anchors = [
      {
        href: 'https://angularthree.org',
        text: 'Angular Three',
        ariaLabel: 'Visit Angular Three website',
      },
      {
        href: 'https://codeberg.org/astronexus/hyg',
        text: 'HYG Catalog',
        ariaLabel: 'Visit HYG catalog source',
      },
    ];

    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('a.angular-three-mark') as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('https://angularthree.org');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[1].textContent?.trim()).toContain('HYG Catalog');
  });

  it('should support stack layout class', () => {
    const fixture = TestBed.createComponent(AnchoredHostComponent);
    const host = fixture.componentInstance;
    host.anchors = [
      {
        href: 'https://angularthree.org',
        text: 'Angular Three',
        ariaLabel: 'Visit Angular Three website',
      },
    ];
    host.layout = 'stack';

    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.external-anchors') as HTMLDivElement | null;
    expect(container).not.toBeNull();
    expect(container?.classList.contains('external-anchors-stack')).toBe(true);
  });

  it('should hide orb when showOrb is false', () => {
    const fixture = TestBed.createComponent(AnchoredHostComponent);
    const host = fixture.componentInstance;
    host.anchors = [
      {
        href: 'https://angularthree.org',
        text: 'Angular Three',
        ariaLabel: 'Visit Angular Three website',
        showOrb: false,
      },
    ];

    fixture.detectChanges();

    const orb = fixture.nativeElement.querySelector('.angular-three-orb');
    expect(orb).toBeNull();
  });
});