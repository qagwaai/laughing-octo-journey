import { en, type EnLocale } from './locales/en';
import { it } from './locales/it';

export const supportedLocales = {
	en,
	it,
} as const;

export type SupportedLocaleCode = keyof typeof supportedLocales;
export type AppLocale = EnLocale;
export const supportedLocaleCodes = Object.keys(supportedLocales) as SupportedLocaleCode[];
const LOCALE_STORAGE_KEY = 'stellar.preferredLocale';

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeLocale(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...base };

	for (const key of Object.keys(override)) {
		const overrideValue = override[key];
		if (overrideValue === undefined) {
			continue;
		}

		const baseValue = merged[key];
		if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
			merged[key] = mergeLocale(baseValue, overrideValue);
			continue;
		}

		merged[key] = overrideValue;
	}

	return merged;
}

function resolveLocaleCode(): SupportedLocaleCode {
	const persisted = readPersistedLocaleCode();
	if (persisted) {
		return persisted;
	}

	const htmlLang = (typeof document !== 'undefined' ? document.documentElement.lang : '').trim().toLowerCase();
	const normalized = htmlLang.split('-')[0];
	if (normalized && normalized in supportedLocales) {
		return normalized as SupportedLocaleCode;
	}
	return 'en';
}

export function isSupportedLocaleCode(value: string): value is SupportedLocaleCode {
	return value in supportedLocales;
}

function readPersistedLocaleCode(): SupportedLocaleCode | null {
	if (typeof window === 'undefined' || !window.localStorage) {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY)?.trim().toLowerCase() ?? '';
		if (raw && isSupportedLocaleCode(raw)) {
			return raw;
		}
	} catch {
		return null;
	}

	return null;
}

let activeLocaleCode: SupportedLocaleCode = resolveLocaleCode();
export let currentLocaleCode: SupportedLocaleCode = activeLocaleCode;

export function setActiveLocaleCode(code: string): SupportedLocaleCode {
	const normalized = code.trim().toLowerCase().split('-')[0];
	const resolved: SupportedLocaleCode = isSupportedLocaleCode(normalized) ? normalized : 'en';
	activeLocaleCode = resolved;
	currentLocaleCode = resolved;

	if (typeof document !== 'undefined') {
		document.documentElement.lang = resolved;
	}

	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			window.localStorage.setItem(LOCALE_STORAGE_KEY, resolved);
		} catch {
			// Ignore storage failures (privacy mode, denied quota, etc.).
		}
	}

	return resolved;
}

function resolveLocale(): AppLocale {
	const localeCode = activeLocaleCode;
	if (localeCode === 'en') {
		return en;
	}

	const override = supportedLocales[localeCode] as Record<string, unknown>;
	return mergeLocale(en as Record<string, unknown>, override) as AppLocale;
}

const localeProxyCache = new Map<string, unknown>();

function createLocaleProxy(path: string[]): unknown {
	const cacheKey = path.join('.');
	const cached = localeProxyCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const proxy = new Proxy(
		{},
		{
			get(_target, prop) {
				if (typeof prop !== 'string') {
					return undefined;
				}

				const current = resolveLocale() as unknown as Record<string, unknown>;
				let value: unknown = current;
				for (const key of path) {
					if (!isPlainObject(value)) {
						return undefined;
					}
					value = value[key];
				}

				if (!isPlainObject(value)) {
					return undefined;
				}

				const next = value[prop];
				if (isPlainObject(next)) {
					return createLocaleProxy([...path, prop]);
				}

				return next;
			},
		},
	);

	localeProxyCache.set(cacheKey, proxy);
	return proxy;
}

export const locale = createLocaleProxy([]) as AppLocale;
