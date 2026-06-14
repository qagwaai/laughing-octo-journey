import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ExternalAnchorItem {
  href: string;
  text: string;
  ariaLabel: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  rel?: string;
  showOrb?: boolean;
}

const defaultExternalAnchors: ReadonlyArray<ExternalAnchorItem> = [
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
  {
    href: 'https://www.midjourney.com/',
    text: 'MidJourney',
    ariaLabel: 'Visit MidJourney website',
  },
  {
    href: 'https://www.meshy.ai/',
    text: 'Meshy',
    ariaLabel: 'Visit Meshy website',
  }
];

@Component({
  selector: 'app-external-anchors',
  template: `
    @if (anchors().length > 0) {
    <div class="external-anchors" [class.external-anchors-stack]="layout() === 'stack'">
      @for (anchor of anchors(); track anchor.href + anchor.text) {
      <a
        class="angular-three-mark"
        [href]="anchor.href"
        [target]="anchor.target ?? '_blank'"
        [rel]="anchor.rel ?? 'noopener noreferrer'"
        [attr.aria-label]="anchor.ariaLabel"
      >
        @if (anchor.showOrb !== false) {
        <span class="angular-three-orb" aria-hidden="true"></span>
        }
        <span class="angular-three-text">{{ anchor.text }}</span>
      </a>
      }
    </div>
    }
  `,
  styleUrl: './external-anchors.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalAnchorsComponent {
  anchors = input<ReadonlyArray<ExternalAnchorItem>>(defaultExternalAnchors);
  layout = input<'inline' | 'stack'>('inline');
}