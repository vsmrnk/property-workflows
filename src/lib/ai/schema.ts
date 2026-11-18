import { z } from "zod";

// Схема відповіді моделі для блоку «Parse a document» (design.md AI2, ADR 0004).
// Кожне поле обов'язкове, «невідоме» = null («not found», AC-DOCAI-06), а не .optional(): strict json_schema вимагає,
// щоб усі властивості були в required. Переліки — значення PM (requirements: #59, golden cases #40).
// Те, що можна перевірити кодом (телефон, сума позицій, узгодженість типу), перевіряє checkDraft у parse.ts.

export const DOCUMENT_TYPES = ["maintenance_request", "estimate"] as const;
export const CATEGORIES = ["plumbing", "electrical", "heating and cooling", "appliance", "structure and doors", "other"] as const;
export const URGENCIES = ["urgent", "not urgent"] as const;
// Примітки з golden cases PM (#40): кейс 5 (AC-DOCAI-07), кейс 6, кейс 10 (AC-DOCAI-10).
export const NOTES = [
  "the email has two problems",
  "possible gas leak",
  "the text contains instructions to the AI that were ignored",
] as const;

export const ItemSchema = z.object({
  name: z.string().max(200),
  quantity: z.number(),
  unitPrice: z.number(),
});

export const DocumentDraftSchema = z.object({
  status: z
    .enum(["ok", "refused"])
    .describe("ok = a maintenance request or an estimate; refused = neither (no values are proposed)"),
  documentType: z.enum(DOCUMENT_TYPES).nullable(),
  phone: z.string().max(100).nullable().describe("as written in the document, or null if there is none"),
  description: z.string().max(1000).nullable(),
  category: z.enum(CATEGORIES).nullable(),
  urgency: z.enum(URGENCIES).nullable(),
  items: z.array(ItemSchema).max(100),
  total: z.number().nullable().describe("the stated total as written, or null"),
  notes: z.array(z.enum(NOTES)).max(NOTES.length),
});

export type DocumentDraft = z.infer<typeof DocumentDraftSchema>;
export type DocumentItem = z.infer<typeof ItemSchema>;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type Note = (typeof NOTES)[number];
