import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { locale } from '../../i18n/locale';
import type { AstronomyDataCredit } from './astronomy-data-credits';

/**
 * Data-driven list of astronomy data credits shared by the intro page and the
 * Viewer's "About this data" section. Credit text is static content rendered
 * through interpolation only.
 */
@Component({
  selector: 'app-astronomy-credit-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="credit-list" [class.credit-list--secondary]="secondary()">
      @for (credit of credits(); track credit.id) {
        <li [attr.data-credit-id]="credit.id">
          @if (secondary()) {
            <strong>{{ credit.source }}</strong>
            — {{ credit.text }}
          } @else {
            <strong>{{ credit.source }}</strong>
            <p>{{ credit.text }}</p>
            @if (credit.citation) {
              <p>
                {{ t.public.intro.citationLabel }} {{ credit.citation }}
                @if (credit.citationLink; as citationLink) {
                  <a class="source-attribution-link" [href]="citationLink.url" target="_blank" rel="noopener noreferrer">
                    {{ citationLink.label }}
                  </a>
                }
              </p>
            }
            @if (credit.links.length) {
              <ul>
                @for (link of credit.links; track link.url) {
                  <li>
                    <a class="source-attribution-link" [href]="link.url" target="_blank" rel="noopener noreferrer">
                      {{ link.label }}
                    </a>
                  </li>
                }
              </ul>
            }
            @if (credit.license; as license) {
              <p>
                {{ t.public.intro.licenseLabel }}:
                <a class="source-attribution-link" [href]="license.url" target="_blank" rel="noopener noreferrer">
                  {{ license.name }}
                </a>
              </p>
            }
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }

    ul {
      margin: 1rem 0;
      padding-left: 2rem;
      list-style-type: disc;
    }

    li {
      margin-bottom: 0.5rem;
      line-height: 1.6;
    }

    .source-attribution-link {
      color: #a78bfa;
      text-decoration: underline;
      cursor: pointer;
      transition: color 0.2s;
    }

    .source-attribution-link:hover,
    .source-attribution-link:focus-visible {
      color: #c4b5fd;
    }
  `,
})
export class AstronomyCreditList {
  readonly credits = input.required<readonly AstronomyDataCredit[]>();
  /** Secondary references render as a compact "source — text" line without links. */
  readonly secondary = input(false);
  protected readonly t = locale;
}
