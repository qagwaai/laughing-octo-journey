import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExternalAnchorItem, ExternalAnchorsComponent } from './external-anchors';

@Component({
  template: `<app-external-anchors [anchors]="anchors" [layout]="layout" />`,
  imports: [ExternalAnchorsComponent],
})
class HostComponent {
  anchors: ReadonlyArray<ExternalAnchorItem> = [];
  layout: 'inline' | 'stack' = 'inline';
}

describe('ExternalAnchorsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('should render nothing when no anchors are provided', () => {
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('a.angular-three-mark');
    expect(links.length).toBe(0);
  });

  it('should render each provided anchor with secure defaults', () => {
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