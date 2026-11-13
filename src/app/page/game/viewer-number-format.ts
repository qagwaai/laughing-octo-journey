import { getActiveLocaleCode, type SupportedLocaleCode } from '../../i18n/locale';

const formatters = new Map<SupportedLocaleCode, Intl.NumberFormat>();

export function formatViewerNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  const localeCode = getActiveLocaleCode();
  let formatter = formatters.get(localeCode);
  if (!formatter) {
    formatter = new Intl.NumberFormat(localeCode, {
      useGrouping: true,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    formatters.set(localeCode, formatter);
  }
  return formatter.format(value);
}
