/**
 * Locales offered by the preview language button (from .plan/locale.md).
 */
export const PREVIEW_LOCALES: readonly string[] = [
  "ar", "de", "en", "es", "fil", "fr", "hi", "id", "it", "ja",
  "ko", "pl", "pt", "ro", "ru", "tr", "uk", "ur", "uz", "zh",
];

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "language" })
    : null;

/** English display name for a locale code, falling back to the code itself. */
export function localeLabel(code: string): string {
  try {
    return displayNames?.of(code) ?? code;
  } catch {
    return code;
  }
}
