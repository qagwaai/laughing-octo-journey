import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Presentation only: never parse, translate, normalize or reconstruct API labels. */
@Component({
  selector: 'app-solar-system-name',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bdi dir="auto" data-testid="system-display-name">{{ name().displayName }}</bdi>
    @if (secondaryCatalog(); as catalog) {
      <bdi dir="auto" class="catalog" data-testid="system-catalog-name">{{ catalog }}</bdi>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
      white-space: normal;
      user-select: text;
    }
    bdi {
      unicode-bidi: isolate;
      user-select: text;
    }
    .catalog {
      display: block;
      font-size: 0.85rem;
      font-weight: normal;
      color: #b4cfff;
    }
  `,
})
export class SolarSystemName {
  readonly name = input.required<{
    displayName: string;
    settlementName: string | null;
    catalogName?: string | null;
  }>();
  protected readonly secondaryCatalog = computed(() => {
    const { displayName, settlementName, catalogName } = this.name();
    if (!catalogName?.trim()) return null;

    // Suppress only exact catalog-only or documented settlement-plus-catalog labels.
    // Do not infer inclusion from substrings or parse authoritative display text.
    const assignedDisplayName = settlementName === null ? null : `${settlementName} (${catalogName})`;
    return displayName === catalogName || displayName === assignedDisplayName ? null : catalogName;
  });
}
