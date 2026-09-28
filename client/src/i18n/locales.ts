export type LocaleDirection = "ltr" | "rtl";

export interface LocaleConfig {
  id: string;
  languageName: string;
  endonym: string;
  flag: string;
  shortCode: string;
  direction: LocaleDirection;
  displayOrder: number;
  isDefault: boolean;
  fallbackLocaleId?: string;
}

/**
 * Supported locales, ordered by total speaker count (L1 + L2).
 * Config-driven — not hardcoded in components.
 * Source: design doc §3.4.1
 */
export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { id: "en-US", languageName: "English", endonym: "English", flag: "🇺🇸", shortCode: "EN", direction: "ltr", displayOrder: 1, isDefault: false, fallbackLocaleId: undefined },
  { id: "zh-CN", languageName: "Chinese (Mandarin, Simplified)", endonym: "中文（简体）", flag: "🇨🇳", shortCode: "中", direction: "ltr", displayOrder: 2, isDefault: true, fallbackLocaleId: "en-US" },
  { id: "ja-JP", languageName: "Japanese", endonym: "日本語", flag: "🇯🇵", shortCode: "日", direction: "ltr", displayOrder: 3, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "ko-KR", languageName: "Korean", endonym: "한국어", flag: "🇰🇷", shortCode: "한", direction: "ltr", displayOrder: 4, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "ru-RU", languageName: "Russian", endonym: "Русский", flag: "🇷🇺", shortCode: "RU", direction: "ltr", displayOrder: 5, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "hi-IN", languageName: "Hindi", endonym: "हिन्दी", flag: "🇮🇳", shortCode: "हिं", direction: "ltr", displayOrder: 6, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "es", languageName: "Spanish", endonym: "Español", flag: "🇪🇸", shortCode: "ES", direction: "ltr", displayOrder: 7, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "fr-FR", languageName: "French", endonym: "Français", flag: "🇫🇷", shortCode: "FR", direction: "ltr", displayOrder: 8, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "ar", languageName: "Arabic", endonym: "العربية", flag: "🇸🇦", shortCode: "ع", direction: "rtl", displayOrder: 9, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "bn-BD", languageName: "Bengali", endonym: "বাংলা", flag: "🇧🇩", shortCode: "বাং", direction: "ltr", displayOrder: 10, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "pt-BR", languageName: "Portuguese (Brazil)", endonym: "Português", flag: "🇧🇷", shortCode: "PT", direction: "ltr", displayOrder: 11, isDefault: false, fallbackLocaleId: "en-US" },
  { id: "ur-PK", languageName: "Urdu", endonym: "اردو", flag: "🇵🇰", shortCode: "ارد", direction: "rtl", displayOrder: 12, isDefault: false, fallbackLocaleId: "en-US" },
];

export const DEFAULT_LOCALE = "zh-CN";
export const FALLBACK_LOCALE = "en-US";

const localeMap = new Map(SUPPORTED_LOCALES.map((l) => [l.id, l]));

export function getLocaleConfig(localeId: string): LocaleConfig | undefined {
  return localeMap.get(localeId);
}

export function isSupportedLocale(localeId: string): boolean {
  return localeMap.has(localeId);
}

export function getLocaleDirection(localeId: string): LocaleDirection {
  return localeMap.get(localeId)?.direction ?? "ltr";
}

export function isRTL(localeId: string): boolean {
  return getLocaleDirection(localeId) === "rtl";
}

/**
 * Language selection order (design §3.4.2):
 * URL locale -> user profile -> localStorage -> Accept-Language -> zh-CN
 */
export function detectLocale(urlLocale?: string | null): string {
  if (urlLocale && isSupportedLocale(urlLocale)) return urlLocale;

  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("hsk_locale") : null;
  if (stored && isSupportedLocale(stored)) return stored;

  const nav = typeof navigator !== "undefined" ? navigator.language : undefined;
  if (nav) {
    const exact = SUPPORTED_LOCALES.find((l) => l.id.toLowerCase() === nav.toLowerCase());
    if (exact) return exact.id;
    const lang = nav.split("-")[0];
    const partial = SUPPORTED_LOCALES.find((l) => l.id.startsWith(lang));
    if (partial) return partial.id;
  }

  return DEFAULT_LOCALE;
}
