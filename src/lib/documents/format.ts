import type { ParsedDocument } from "@/lib/ai/parse";
import { CATEGORIES, DOCUMENT_TYPES, MAX_DOCUMENT_CHARS, URGENCIES, type DocumentType } from "@/lib/ai/vocabulary";

// Тексти й перетворення блоку «Parse a document» (design.md U2–U9). Модуль без залежностей від сервера, zod і AI SDK:
// його імпортує клієнтський блок. Тексти AC — дослівно як у PM (#59).

export const DOC_MESSAGES = {
  PASTE_TEXT: "Paste the text of a document", // AC-DOCAI-11 (і підпис поля, U2)
  ONLY_TXT: "Only plain text files (.txt) are accepted", // AC-DOCAI-12
  READING: "Reading the document…", // AC-DOCAI-03
  NOT_FOUND: "not found", // AC-DOCAI-06
  // Межа довжини — рішення розробника (PM дозволяє «a reasonable limit»), а не AC; design.md U3.
  TOO_LONG: `The text is too long (at most ${MAX_DOCUMENT_CHARS.toLocaleString("en-US")} characters)`,
} as const;

export { MAX_DOCUMENT_CHARS };

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  maintenance_request: "Maintenance request",
  estimate: "Estimate",
};

const option = <T extends string>(value: T, label: string = value) => ({ value, label });
export const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.map((t) => option(t, DOCUMENT_TYPE_LABELS[t]));
export const CATEGORY_OPTIONS = CATEGORIES.map((c) => option(c));
export const URGENCY_OPTIONS = URGENCIES.map((u) => option(u));

export const isDocumentType = (v: unknown): v is DocumentType => DOCUMENT_TYPES.includes(v as DocumentType);

/** Дата й час підтвердження за Києвом, як у припущенні PM: «12 Nov 2026, 10:15» (design.md U9). */
export function formatConfirmedAt(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Kyiv",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}`;
}

/** Гроші з двома знаками: 60 → «60.00» (як у документах PM). */
export const money = (n: number) => n.toFixed(2);

/** Лише текстовий файл .txt (design.md U3): розширення .txt і тип text/plain або порожній (так браузер подає .txt без типу). */
export function isPlainTextFile(file: { name: string; type: string }): boolean {
  return /\.txt$/i.test(file.name) && (file.type === "" || file.type === "text/plain");
}

// ── Значення у формі перевірки (U5, U7) ──

export type ItemValues = { name: string; quantity: string; unitPrice: string };
export type FormValues = {
  documentType: DocumentType | "";
  phone: string;
  description: string;
  category: string;
  urgency: string;
  items: ItemValues[];
  total: string;
};

export const EMPTY_VALUES: FormValues = { documentType: "", phone: "", description: "", category: "", urgency: "", items: [], total: "" };

/** Запропоновані значення → поля форми; «невідоме» (null) — порожнє поле. */
export function toFormValues(doc: ParsedDocument): FormValues {
  return {
    documentType: doc.documentType ?? "",
    phone: doc.phone ?? "",
    description: doc.description ?? "",
    category: doc.category ?? "",
    urgency: doc.urgency ?? "",
    items: doc.items.map((i) => ({ name: i.name, quantity: String(i.quantity), unitPrice: money(i.unitPrice) })),
    total: doc.total === null ? "" : money(doc.total),
  };
}

const textOrNull = (s: string) => (s.trim() ? s.trim() : null);
// Порожнє чи нечислове поле → null: сервер (ConfirmSchema) таке число відхиляє, а не зберігає 0.
const numberOrNull = (s: string) => {
  if (!s.trim()) return null;
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Поля форми → те, що підтвердила людина (дія saveValues). Значення іншого типу документа не надсилаються.
 * Сервер не довіряє цьому об'єкту: повторна перевірка — ConfirmSchema у src/lib/documents/service.ts.
 */
export function toSavePayload(v: FormValues) {
  const estimate = v.documentType === "estimate";
  return {
    documentType: v.documentType || null,
    phone: estimate ? null : textOrNull(v.phone),
    description: estimate ? null : textOrNull(v.description),
    category: estimate ? null : textOrNull(v.category),
    urgency: estimate ? null : textOrNull(v.urgency),
    items: estimate ? v.items.map((i) => ({ name: i.name.trim(), quantity: numberOrNull(i.quantity), unitPrice: numberOrNull(i.unitPrice) })) : [],
    total: estimate ? numberOrNull(v.total) : null,
  };
}
