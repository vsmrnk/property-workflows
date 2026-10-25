// Тексти й формати версій шаблону (AC-EDITOR-05, AC-EDITOR-06, AC-EDITOR-07) — дослівно як у PM.

export const NOT_ENOUGH_RIGHTS = "Not enough rights";
export const UNPUBLISHED_CHANGES = "Unpublished changes";

export const versionLabel = (n: number) => `Version ${n}`;
/** «Template version N» (AC-EDITOR-06); ран, запущений до версіонування, версії не має. */
export const runVersionLabel = (n: number | null) =>
  n == null ? "Launched before template versions" : `Template version ${n}`;

/** Дата й час збереження версії за Києвом у форматі DD.MM.YYYY HH:MM (AC-EDITOR-05). */
export function formatSavedAt(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Kyiv",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

export type PublishedSection = {
  name: string;
  position: number;
  tasks: { id: string; name: string; required: boolean; position: number }[];
};

/** Знімок поточної версії з templates.published_sections. */
export function publishedSections(value: unknown): PublishedSection[] {
  return Array.isArray(value) ? (value as PublishedSection[]) : [];
}
