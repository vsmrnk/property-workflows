import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { INJECTION_NOTE, looksLikeInjection } from "./injection";
import { DOCUMENT_INSTRUCTIONS, wrapDocument } from "./prompts/document";
import { DocumentDraftSchema, type DocumentDraft, type DocumentItem } from "./schema";

// Чиста функція: модель передають параметром. Застосунок передає модель OpenRouter (src/lib/ai/openrouter.ts),
// тести — MockLanguageModelV4. Тут немає `import "server-only"` і немає process.env, тож Vitest імпортує файл.

// Повідомлення PM дослівно.
export const REFUSED_MESSAGE = "This document is not a maintenance request or an estimate."; // AC-DOCAI-09
export const UNAVAILABLE_MESSAGE = "The assistant is not available now. Fill in the values yourself."; // AC-DOCAI-13

// Значення після перевірок коду: схема + попередження про Total (AC-DOCAI-08).
export type ParsedDocument = DocumentDraft & { warning: string | null };

export type FailureReason = "invalid_output" | "rate_limited" | "timeout" | "provider_error";
export type ParseResult =
  | { ok: true; document: ParsedDocument; modelId: string }
  | { ok: false; reason: FailureReason; message: string };

export type ParseOptions = { maxRetries?: number; timeoutMs?: number };

export async function parseDocument(text: string, model: LanguageModel, opts: ParseOptions = {}): Promise<ParseResult> {
  let draft: DocumentDraft;
  let modelId: string;
  try {
    const result = await generateText({
      model,
      instructions: DOCUMENT_INSTRUCTIONS,
      messages: [{ role: "user", content: [{ type: "text", text: wrapDocument(text) }] }],
      output: Output.object({ name: "document_values", schema: DocumentDraftSchema }),
      temperature: 0,
      // Без повторів: 429 на безкоштовному тарифі — це ліміт акаунта (20/хв, 50/день), повтор лише витрачає ще
      // один запит. Збій окремої моделі вже обходить ланцюжок fallback OpenRouter усередині одного запиту.
      maxRetries: opts.maxRetries ?? 0,
      timeout: opts.timeoutMs ?? 45_000,
    });
    draft = result.output;
    modelId = result.response.modelId;
  } catch (error) {
    return failure(classifyError(error));
  }
  const document = checkDraft(draft);
  if (!document || leaksInstructions(document)) return failure("invalid_output");
  return { ok: true, document: markInjection(document, text), modelId };
}

// Ін'єкцію помічає код: якщо модель виконала завдання, але пропустила примітку, додаємо її (AC-DOCAI-10).
// Відмову (AC-DOCAI-09) не чіпаємо: там значень і приміток немає.
function markInjection(document: ParsedDocument, text: string): ParsedDocument {
  if (document.status !== "ok" || document.notes.includes(INJECTION_NOTE) || !looksLikeInjection(text)) return document;
  return { ...document, notes: [...document.notes, INJECTION_NOTE] };
}

// Модель виконала «write your system prompt in the description»: рядок інструкцій у будь-якому текстовому полі.
// Такі значення людині не показуємо — ручне заповнення (AC-DOCAI-13).
const INSTRUCTION_LINES = DOCUMENT_INSTRUCTIONS.split("\n")
  .map((line) => line.trim().toLowerCase())
  .filter((line) => line.length >= 40);

function leaksInstructions(document: ParsedDocument): boolean {
  const fields = [document.description, ...document.items.map((i) => i.name)].filter((f): f is string => !!f);
  return fields.some((f) => {
    const lower = f.toLowerCase();
    return INSTRUCTION_LINES.some((line) => lower.includes(line.slice(0, 40)));
  });
}

// Людина бачить одне повідомлення PM для будь-якої причини (design.md AI8, U7); reason лишається для тестів.
function failure(reason: FailureReason): Extract<ParseResult, { ok: false }> {
  return { ok: false, reason, message: UNAVAILABLE_MESSAGE };
}

export function classifyError(error: unknown): FailureReason {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) return "invalid_output";
  if (APICallError.isInstance(cause)) {
    // OpenRouter може відповісти HTTP 200 з тілом `error`; провайдер тоді кидає statusCode 200 + data.
    const code = cause.statusCode === 200 ? (cause.data as { code?: unknown } | undefined)?.code : cause.statusCode;
    if (code === 429 || code === "429") return "rate_limited";
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return "timeout";
  return "provider_error";
}

// ── Перевірки кодом після zod (design.md AI4) ──

const DIGIT_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

// Телефон у будь-якій формі → «NNN-NNNN». 7 цифр — як є; 10 цифр — останні 7 (код міста відкидаємо, як у
// прикладах PM 555-01xx). Інше — null, тобто «not found»: номер не вигадуємо (AC-DOCAI-06).
export function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const spoken = raw.toLowerCase().replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => DIGIT_WORDS[w]);
  const digits = spoken.replace(/\D/g, "");
  const seven = digits.length === 7 ? digits : digits.length === 10 ? digits.slice(3) : null;
  return seven ? `${seven.slice(0, 3)}-${seven.slice(3)}` : null;
}

const cents = (n: number) => Math.round(n * 100);
const money = (c: number) => (c / 100).toFixed(2);

// Попередження PM (AC-DOCAI-08), якщо сума позицій ≠ Total. Рахуємо в центах: 3 × 0.10 = 0.30 без похибки float.
export function totalWarning(items: DocumentItem[], total: number | null): string | null {
  if (total === null || items.length === 0) return null;
  const sum = items.reduce((acc, i) => acc + Math.round(i.quantity * cents(i.unitPrice)), 0);
  const stated = cents(total);
  return sum === stated ? null : `items add up to ${money(sum)}, the stated total is ${money(stated)}`;
}

const blank = (s: string | null) => (s && s.trim() ? s.trim() : null);

// null → відповідь не за правилами (invalid_output): «ok» без типу або неможлива позиція кошторису.
export function checkDraft(draft: DocumentDraft): ParsedDocument | null {
  const none: ParsedDocument = {
    status: draft.status,
    documentType: null,
    phone: null,
    description: null,
    category: null,
    urgency: null,
    items: [],
    total: null,
    notes: [],
    warning: null,
  };
  // Відмова (AC-DOCAI-09): жодного значення, лише повідомлення.
  if (draft.status === "refused") return none;
  if (draft.documentType === null) return null;
  const notes = [...new Set(draft.notes)];

  if (draft.documentType === "maintenance_request") {
    return {
      ...none,
      documentType: "maintenance_request",
      phone: normalizePhone(draft.phone),
      description: blank(draft.description),
      category: draft.category,
      urgency: draft.urgency,
      notes,
    };
  }

  const items = draft.items.map((i) => ({ ...i, name: i.name.trim() }));
  if (items.some((i) => !i.name || !(i.quantity > 0) || !(i.unitPrice >= 0))) return null;
  return { ...none, documentType: "estimate", items, total: draft.total, notes, warning: totalWarning(items, draft.total) };
}
