// Назва кейсу: вільний текст 1–100 символів; назва з самих пробілів — порожня (AC-RUN-03, AC-RUN-07).
// Пробіли на краях обрізаємо й довжину рахуємо після обрізання — власне припущення в add-run-launch.
// Ту саму перевірку робить public.launch_run у базі (design.md impl-run-launch, D3).

export const CASE_NAME_MAX = 100;

export type CaseNameResult = { ok: true; value: string } | { ok: false; code: "CASE_NAME_REQUIRED" | "CASE_NAME_TOO_LONG" };

export function validateCaseName(raw: unknown): CaseNameResult {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return { ok: false, code: "CASE_NAME_REQUIRED" };
  // Символи (code points), як char_length у Postgres, а не UTF-16 одиниці (emoji — 1 символ, а не 2).
  if ([...value].length > CASE_NAME_MAX) return { ok: false, code: "CASE_NAME_TOO_LONG" };
  return { ok: true, value };
}
