import type { LanguageModel } from "ai";
import { z } from "zod";
import { normalizePhone, parseDocument, REFUSED_MESSAGE, UNAVAILABLE_MESSAGE, type FailureReason, type ParsedDocument } from "@/lib/ai/parse";
import { CATEGORIES, DOCUMENT_TYPES, MAX_DOCUMENT_CHARS, URGENCIES } from "@/lib/ai/vocabulary";
import { MESSAGES, messageFor } from "@/lib/runs/messages";
import type { createClient } from "@/lib/supabase/server";
import { DOC_MESSAGES } from "./format";

// Логіка дій блоку «Parse a document» (design.md A1, A2) без "use server": дія сама перевіряє вхід (getClaims, ADR 0002)
// і передає сюди клієнт Supabase й фабрику моделі. Так тести перевіряють і ворота, і гілку AI без ключа й мережі, а
// файл з ключем (src/lib/ai/openrouter.ts, server-only) дія вантажить лише тоді, коли модель справді потрібна.

type Client = Awaited<ReturnType<typeof createClient>>;
type ModelFactory = () => LanguageModel | null | Promise<LanguageModel | null>;

export type ProposeState =
  | { kind: "idle" }
  | { kind: "error"; id: string; message: string }
  | { kind: "proposed"; id: string; document: ParsedDocument }
  | { kind: "refused"; id: string; message: string }
  // reason — для тестів і журналу; людина бачить одне повідомлення PM (AC-DOCAI-13, design.md U7).
  | { kind: "unavailable"; id: string; message: string; reason: FailureReason | "no_key" };

export type SaveState = { ok: true; id: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const newId = () => crypto.randomUUID();
const failed = (message: string): ProposeState => ({ kind: "error", id: newId(), message });

/**
 * «Propose values» (A1). Порядок — від дешевого до дорогого: право на ран → текст → модель. Без права чи з порожнім
 * текстом модель не створюється й не викликається, тож чужий запит не витрачає денного ліміту безкоштовної моделі.
 * Нічого не пише в базу.
 */
/** Право на ран (AC-DOCAI-16): той самий can_parse_documents, що й політика RLS run_documents. */
async function canParse(supabase: Client, runId: string): Promise<boolean> {
  if (!UUID.test(runId)) return false;
  const { data, error } = await supabase.rpc("can_parse_documents", { p_run_id: runId });
  return !error && data === true;
}

export async function proposeDocument(supabase: Client, runId: string, text: string, getModel: ModelFactory): Promise<ProposeState> {
  if (!(await canParse(supabase, runId))) return failed(MESSAGES.NOT_ENOUGH_RIGHTS);

  const trimmed = text.trim();
  if (!trimmed) return failed(DOC_MESSAGES.PASTE_TEXT); // AC-DOCAI-11
  if (trimmed.length > MAX_DOCUMENT_CHARS) return failed(DOC_MESSAGES.TOO_LONG);

  const model = await getModel();
  if (!model) return { kind: "unavailable", id: newId(), message: UNAVAILABLE_MESSAGE, reason: "no_key" }; // AC-DOCAI-13

  const result = await parseDocument(trimmed, model);
  if (!result.ok) return { kind: "unavailable", id: newId(), message: result.message, reason: result.reason };
  if (result.document.status === "refused") return { kind: "refused", id: newId(), message: REFUSED_MESSAGE }; // AC-DOCAI-09
  return { kind: "proposed", id: newId(), document: result.document };
}

// ── «Save values» (A2): повторна перевірка того, що надіслав браузер ──

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const ConfirmItem = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

/** Значення, які підтвердила людина: тип обов'язковий, решта може бути порожньою (AC-DOCAI-13), переліки — PM. */
export const ConfirmSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  phone: optionalText(100),
  description: optionalText(1000),
  category: z.enum(CATEGORIES).nullish().transform((v) => v ?? null),
  urgency: z.enum(URGENCIES).nullish().transform((v) => v ?? null),
  items: z.array(ConfirmItem).max(100).default([]),
  total: z.number().min(0).nullish().transform((v) => v ?? null),
});

function invalidMessage(issues: z.core.$ZodIssue[]): string {
  const fields = new Set(issues.map((i) => i.path[0]));
  if (fields.has("documentType")) return MESSAGES.DOCUMENT_TYPE_REQUIRED;
  if (fields.has("items")) return MESSAGES.ITEM_INVALID;
  return MESSAGES.VALUES_INVALID;
}

/** Вісім аргументів save_run_document: значення іншого типу документа — null чи [], телефон — у вигляді 555-0101. */
function rpcArgs(runId: string, v: z.infer<typeof ConfirmSchema>) {
  const estimate = v.documentType === "estimate";
  // Номер, який людина ввела у своїй формі, лишається як є, якщо його не вдається звести до 555-0101.
  const phone = v.phone ? (normalizePhone(v.phone) ?? v.phone) : null;
  const request = estimate
    ? { p_phone: null, p_description: null, p_category: null, p_urgency: null }
    : { p_phone: phone, p_description: v.description, p_category: v.category, p_urgency: v.urgency };
  return {
    p_run_id: runId,
    p_document_type: v.documentType,
    ...request,
    p_items: estimate ? v.items : [],
    p_total: estimate ? v.total : null,
  };
}

/**
 * Запис значень (AC-DOCAI-04, AC-DOCAI-13). Право перевіряється спершу тут і ще раз атомарно з записом у функції
 * бази save_run_document (D4); між ними — повторна валідація zod (браузеру не довіряємо) і нормалізація телефону.
 * Вставлений текст і відповідь моделі не зберігаються («Out of scope» PM): у базу йдуть лише вісім підтверджених значень.
 */
export async function saveDocument(supabase: Client, runId: string, raw: unknown): Promise<SaveState> {
  // Право — до перевірки значень: чужий ран дає «Not enough rights», а не підказку, що саме не так зі значеннями.
  // save_run_document перевіряє право ще раз у тій самій транзакції, що й запис (D4).
  if (!(await canParse(supabase, runId))) return { ok: false, error: MESSAGES.NOT_ENOUGH_RIGHTS };
  const parsed = ConfirmSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: invalidMessage(parsed.error.issues) };

  const { data, error } = await supabase.rpc("save_run_document", rpcArgs(runId, parsed.data));
  if (error || !data) return { ok: false, error: messageFor(error?.message) };
  return { ok: true, id: data };
}
