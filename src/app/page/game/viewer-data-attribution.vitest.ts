import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViewerBody } from '../../model/solar-system-get';
import { appLogger } from '../../services/logger';
import { EXOPLANET_DATA_CREDITS, SOLAR_SYSTEM_DATA_CREDITS } from '../public/astronomy-data-credits';
import {
  catalogSnapshotDate,
  REFERENCE_COLLAPSE_LIMIT,
  resolveViewerCreditContext,
  resolveViewerDataCredits,
  safeReferenceUrl,
  viewerBodyReferences,
  visibleBodyReferences,
} from './viewer-data-attribution';

// Built at runtime so lint's no-script-url rule does not flag the fixture itself.
const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

function bodyWithReferences(references: unknown): Pick<ViewerBody, 'id' | 'discovery'> {
  return { id: 'exo-55-cnc-b', discovery: { references } as ViewerBody['discovery'] };
}

describe('viewer data attribution', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('credit context', () => {
    it('maps Sol, exoplanet catalog and other systems to their credit contexts', () => {
      expect(resolveViewerCreditContext({ id: 'sol', source: 'curated' })).toBe('sol');
      expect(resolveViewerCreditContext({ id: 'exo-55-cnc', source: 'exoplanet-catalog' })).toBe('exoplanet');
      expect(resolveViewerCreditContext({ id: 'hyg-123', source: 'procedural' })).toBe('stellar');
      expect(resolveViewerCreditContext({ id: 'alpha-centauri', source: 'curated' })).toBe('stellar');
      expect(resolveViewerCreditContext(null)).toBeNull();
    });

    it('shows only Sol credits in Sol', () => {
      const credits = resolveViewerDataCredits({ id: 'sol', source: 'curated' }, true);
      expect(credits?.primary).toBe(SOLAR_SYSTEM_DATA_CREDITS);
      expect(credits?.secondary).toEqual([]);
    });

    it('shows exoplanet credits A1–A8 and hides A10 unless the flag is enabled', () => {
      const off = resolveViewerDataCredits({ id: 'exo-55-cnc', source: 'exoplanet-catalog' }, false);
      expect(off?.primary).toBe(EXOPLANET_DATA_CREDITS);
      expect(off?.secondary.map((credit) => credit.id)).not.toContain('A10');

      const on = resolveViewerDataCredits({ id: 'exo-55-cnc', source: 'exoplanet-catalog' }, true);
      expect(on?.secondary.map((credit) => credit.id)).toContain('A10');
    });

    it('credits only HYG star data for other systems', () => {
      const credits = resolveViewerDataCredits({ id: 'hyg-123', source: 'procedural' }, false);
      expect(credits?.primary.map((credit) => credit.id)).toEqual(['S7']);
    });

    it('returns null without a system', () => {
      expect(resolveViewerDataCredits(null, false)).toBeNull();
    });
  });

  describe('catalog snapshot date', () => {
    it('returns the server date verbatim', () => {
      expect(catalogSnapshotDate({ catalogSnapshotDate: '2026-11-01' })).toBe('2026-11-01');
    });

    it('rejects missing or malformed dates', () => {
      expect(catalogSnapshotDate({})).toBeNull();
      expect(catalogSnapshotDate(null)).toBeNull();
      expect(catalogSnapshotDate({ catalogSnapshotDate: '' })).toBeNull();
      expect(catalogSnapshotDate({ catalogSnapshotDate: 'November 2026' })).toBeNull();
      expect(catalogSnapshotDate({ catalogSnapshotDate: '2026-11-01T00:00:00Z' })).toBeNull();
    });
  });

  describe('reference URLs', () => {
    it('accepts absolute http and https URLs', () => {
      expect(safeReferenceUrl('https://ui.adsabs.harvard.edu/abs/1996ApJ...464L.147B')).toBe(
        'https://ui.adsabs.harvard.edu/abs/1996ApJ...464L.147B',
      );
      expect(safeReferenceUrl('http://example.org/paper')).toBe('http://example.org/paper');
    });

    it('rejects javascript:, data:, relative and non-string URLs', () => {
      expect(safeReferenceUrl(SCRIPT_URL)).toBeNull();
      expect(safeReferenceUrl(' JavaScript:alert(1)')).toBeNull();
      expect(safeReferenceUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(safeReferenceUrl('/abs/1996ApJ')).toBeNull();
      expect(safeReferenceUrl('ftp://example.org/file')).toBeNull();
      expect(safeReferenceUrl(42)).toBeNull();
      expect(safeReferenceUrl(undefined)).toBeNull();
    });
  });

  describe('body references', () => {
    it('keeps server order and marks the first reference as the discovery', () => {
      const refs = viewerBodyReferences(
        bodyWithReferences([
          { label: 'Butler et al. 1997', url: 'https://example.org/discovery' },
          { label: 'Fischer et al. 2008', url: 'https://example.org/second' },
        ]),
      );
      expect(refs).toEqual([
        { label: 'Butler et al. 1997', url: 'https://example.org/discovery', discovery: true },
        { label: 'Fischer et al. 2008', url: 'https://example.org/second', discovery: false },
      ]);
    });

    it('renders unsafe links as plain labels and logs a warning', () => {
      const warn = vi.spyOn(appLogger, 'warn').mockImplementation(() => undefined);
      const refs = viewerBodyReferences(bodyWithReferences([{ label: 'Bad link', url: SCRIPT_URL }]));
      expect(refs).toEqual([{ label: 'Bad link', url: null, discovery: true }]);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('keeps HTML-looking labels as literal text', () => {
      const refs = viewerBodyReferences(bodyWithReferences([{ label: '<b>x</b>', url: 'https://example.org' }]));
      expect(refs[0].label).toBe('<b>x</b>');
    });

    it('falls back to the URL when the label is missing and skips empty entries', () => {
      const refs = viewerBodyReferences(
        bodyWithReferences([{ url: 'https://example.org/only-url' }, {}, { label: 'Label only' }]),
      );
      expect(refs).toEqual([
        { label: 'https://example.org/only-url', url: 'https://example.org/only-url', discovery: true },
        { label: 'Label only', url: null, discovery: false },
      ]);
    });

    it('returns no references when discovery data is absent', () => {
      expect(viewerBodyReferences({ id: 'earth' })).toEqual([]);
      expect(viewerBodyReferences(bodyWithReferences('not-an-array'))).toEqual([]);
    });

    it('collapses long reference lists until expanded', () => {
      const refs = viewerBodyReferences(
        bodyWithReferences(
          Array.from({ length: 9 }, (_, i) => ({ label: `Ref ${i}`, url: `https://example.org/${i}` })),
        ),
      );
      expect(visibleBodyReferences(refs, false)).toHaveLength(REFERENCE_COLLAPSE_LIMIT);
      expect(visibleBodyReferences(refs, true)).toHaveLength(9);
      expect(visibleBodyReferences(refs.slice(0, 3), false)).toHaveLength(3);
    });
  });
});
