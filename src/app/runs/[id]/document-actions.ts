"use server";

import { revalidatePath } from "next/cache";
import { proposeDocument, saveDocument, type ProposeState, type SaveState } from "@/lib/documents/service";
import { MESSAGES } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";

// Дії блоку «Parse a document» (design.md A1, A2). Кожна сама перевіряє вхід (getClaims, ADR 0002), а право на ран,
// перевірку тексту, модель і запис робить src/lib/documents/service.ts.

/** Модуль з ключем (server-only) вантажиться лише тоді, коли всі ворота пройдено й модель справді потрібна. */
async function loadModel() {
  const { productModel } = await import("@/lib/ai/openrouter");
  return productModel();
}

/** «Propose values»: запропоновані значення без запису в базу (AC-DOCAI-01, 03, 09, 11, 13, 16). */
export async function proposeValues(runId: string, _prev: ProposeState, formData: FormData): Promise<ProposeState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { kind: "error", id: crypto.randomUUID(), message: MESSAGES.NOT_AUTHENTICATED };
  const text = formData.get("text");
  return proposeDocument(supabase, runId, typeof text === "string" ? text : "", loadModel);
}

/** «Save values»: один запис із тим, що підтвердила людина (AC-DOCAI-04, 13, 16). */
export async function saveValues(runId: string, raw: unknown): Promise<SaveState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: MESSAGES.NOT_AUTHENTICATED };
  const result = await saveDocument(supabase, runId, raw);
  if (result.ok) revalidatePath(`/runs/${runId}`);
  return result;
}
