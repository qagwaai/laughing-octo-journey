/**
 * Viewer data attribution (EX-7.3): contextual credits, per-planet references and
 * the catalog snapshot date. Forge sends only plain text and URLs; Nova renders
 * them through interpolation and never as HTML.
 */
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import {
  type AstronomyDataCredit,
  EXOPLANET_DATA_CREDITS,
  secondaryExoplanetDataCredits,
  SOLAR_SYSTEM_DATA_CREDITS,
} from '../public/astronomy-data-credits';
import { appLogger } from '../../services/logger';

export type ViewerCreditContext = 'sol' | 'exoplanet' | 'stellar';

export interface ViewerDataCredits {
  context: ViewerCreditContext;
  primary: readonly AstronomyDataCredit[];
  secondary: readonly AstronomyDataCredit[];
}

export const SOL_SYSTEM_ID = 'sol';
/** Planet reference lists longer than this collapse behind "Show all". */
export const REFERENCE_COLLAPSE_LIMIT = 5;

const HYG_STAR_CREDIT_ID = 'S7';
const SNAPSHOT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function resolveViewerCreditContext(
  system: Pick<SolarSystemSummary, 'id' | 'source'> | null | undefined,
): ViewerCreditContext | null {
  if (!system) return null;
  if (system.id === SOL_SYSTEM_ID) return 'sol';
  if (system.source === 'exoplanet-catalog') return 'exoplanet';
  return 'stellar';
}

/** Credits for the current system only: Sol S1–S7, catalog A1–A8 (+A10 when enabled), otherwise HYG star data. */
export function resolveViewerDataCredits(
  system: Pick<SolarSystemSummary, 'id' | 'source'> | null | undefined,
  includeNameExoWorlds: boolean,
): ViewerDataCredits | null {
  const context = resolveViewerCreditContext(system);
  switch (context) {
    case 'sol':
      return { context, primary: SOLAR_SYSTEM_DATA_CREDITS, secondary: [] };
    case 'exoplanet':
      return {
        context,
        primary: EXOPLANET_DATA_CREDITS,
        secondary: secondaryExoplanetDataCredits(includeNameExoWorlds),
      };
    case 'stellar':
      return {
        context,
        primary: SOLAR_SYSTEM_DATA_CREDITS.filter((credit) => credit.id === HYG_STAR_CREDIT_ID),
        secondary: [],
      };
    default:
      return null;
  }
}

/** The server-supplied `YYYY-MM-DD` snapshot date, shown verbatim; never inferred or hard-coded. */
export function catalogSnapshotDate(
  system: Pick<SolarSystemSummary, 'catalogSnapshotDate'> | null | undefined,
): string | null {
  const value = system?.catalogSnapshotDate?.trim();
  return value && SNAPSHOT_DATE_PATTERN.test(value) ? value : null;
}

export interface ViewerBodyReference {
  label: string;
  /** Absolute http(s) URL, or null when the server URL is missing or unsafe. */
  url: string | null;
  discovery: boolean;
}

/** Accepts only absolute http/https URLs; everything else (javascript:, data:, relative) is rejected. */
export function safeReferenceUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** References in server order; the first one is the discovery reference. */
export function viewerBodyReferences(body: Pick<ViewerBody, 'id' | 'discovery'>): ViewerBodyReference[] {
  const references = body.discovery?.references;
  if (!Array.isArray(references)) return [];
  const result: ViewerBodyReference[] = [];
  references.forEach((reference, index) => {
    const rawLabel = typeof reference?.label === 'string' ? reference.label.trim() : '';
    const rawUrl = reference?.url;
    const url = safeReferenceUrl(rawUrl);
    if (rawUrl && !url) {
      appLogger.warn('[viewer-references] unsafe or invalid reference URL; rendering label as plain text', {
        bodyId: body.id,
        index,
      });
    }
    const label = rawLabel || url;
    if (!label) return;
    result.push({ label, url, discovery: index === 0 });
  });
  return result;
}

export function visibleBodyReferences(
  references: readonly ViewerBodyReference[],
  expanded: boolean,
): readonly ViewerBodyReference[] {
  return expanded || references.length <= REFERENCE_COLLAPSE_LIMIT
    ? references
    : references.slice(0, REFERENCE_COLLAPSE_LIMIT);
}
