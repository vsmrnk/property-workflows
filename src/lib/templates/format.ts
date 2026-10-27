// Тексти й формати версій шаблону (AC-EDITOR-05, AC-EDITOR-06, AC-EDITOR-07) — дослівно як у PM.

export const NOT_ENOUGH_RIGHTS = "Not enough rights";
export const UNPUBLISHED_CHANGES = "Unpublished changes";

/** Підказка під порожнім полем редактора замість системної підказки браузера. */

export const versionLabel = (n: number) => `Version ${n}`;
/** «Template version N» (AC-EDITOR-06); ран, запущений до появи версій, — версія 1 (AC-EDITOR-27, припущення PM). */
export const runVersionLabel = (n: number | null) => `Template version ${n ?? 1}`;

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

/** Помилка збереження без обов'язкової задачі (AC-EDITOR-04) — дослівно як у PM. */
export const NO_REQUIRED_TASK = "A template needs at least one required task";
/** Успіх збереження — без спливних вікон, на місці (приклад PM: «Version 2 saved»). */
export const versionSaved = (n: number) => `Version ${n} saved`;

/** Секція без задач (AC-EDITOR-15), порожня назва (AC-EDITOR-19, AC-EDITOR-20), наявна назва (AC-EDITOR-23, AC-EDITOR-24). */
export const EMPTY_SECTION = "Every section needs at least one task";
export const NO_NAME = "Every section and task needs a name";
export const ENTER_TEMPLATE_NAME = "Enter a template name";
export const DUPLICATE_NAME = "A template with this name already exists";

/** Порожні стани (AC-EDITOR-17, AC-EDITOR-18, припущення PM про список шаблонів адміністратора). */
export const NO_TEMPLATES_MANAGER = "No templates yet. An administrator creates them.";
export const NO_TEMPLATES_ADMIN = "No templates yet. Create a template to start.";
/** Шаблон без версії за прямим посиланням менеджера (AC-EDITOR-16). */
export const TEMPLATE_NOT_FOUND = "Template not found";
export const NO_VERSIONS = "No versions yet. Save the template to create version 1.";
/** Шаблон без версії у формі запуску адміністратора (AC-EDITOR-10). */
export const SAVE_TO_LAUNCH = "Save the template to launch it";
/** Стан змін у редакторі (AC-EDITOR-25, припущення PM). */
export const ALL_CHANGES_KEPT = "All changes kept";
export const CHANGE_NOT_KEPT = "Your last change was not kept. Try again.";

/** Текст для коду помилки save_template_version (raise exception '<CODE>'). */
export function saveErrorMessage(message: string | null | undefined): string {
  if (message?.includes("NO_NAME")) return NO_NAME;
  if (message?.includes("EMPTY_SECTION")) return EMPTY_SECTION;
  if (message?.includes("DUPLICATE_NAME")) return DUPLICATE_NAME;
  if (message?.includes("NO_REQUIRED_TASK")) return NO_REQUIRED_TASK;
  if (message?.includes("NOT_ALLOWED")) return NOT_ENOUGH_RIGHTS;
  if (message?.includes("NO_CHANGES")) return "There are no unpublished changes to save";
  return "Something went wrong. Try again.";
}

/** Зведення поточної версії в списку шаблонів: «1 task · 1 required», «5 tasks · 3 required». */
export const taskSummary = (total: number, required: number) =>
  `${total} ${total === 1 ? "task" : "tasks"} · ${required} required`;
