"use server";

import { revalidatePath } from "next/cache";
import { denyUnlessAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { saveErrorMessage, versionSaved } from "@/lib/templates/format";

// Дії редактора шаблону (design.md impl-template-versions, U3, A2). Кожна зміна робочої копії — окрема дія, тож
// зберігається одразу (автозбереження, AC-EDITOR-01). Кожна дія — публічний POST-ендпойнт: getClaims() і роль admin
// перевіряються в самій дії до будь-якого запису (ADR 0002); не admin — нічого не записано (AC-EDITOR-08).

export type SaveState = { error?: string; saved?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const editorPath = (templateId: string) => `/templates/${templateId}/edit`;

function refresh(templateId: string) {
  revalidatePath(editorPath(templateId));
  revalidatePath("/templates");
}

/** Додати секцію в кінець робочої копії. */
export async function addSection(templateId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const name = text(formData, "name");
  if (!name) return;
  const { data: last } = await supabase
    .from("template_sections")
    .select("position")
    .eq("template_id", templateId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("template_sections").insert({ template_id: templateId, name, position: (last?.position ?? 0) + 1 });
  refresh(templateId);
}

/** Перейменувати секцію. */
export async function renameSection(templateId: string, sectionId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const name = text(formData, "name");
  if (!name) return;
  await supabase.from("template_sections").update({ name }).eq("id", sectionId).eq("template_id", templateId);
  refresh(templateId);
}

/** Прибрати секцію разом з її задачами. */
export async function removeSection(templateId: string, sectionId: string): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  await supabase.from("template_sections").delete().eq("id", sectionId).eq("template_id", templateId);
  refresh(templateId);
}

/** Поміняти секцію місцями із сусідньою (вгору чи вниз). */
export async function moveSection(templateId: string, sectionId: string, direction: "up" | "down"): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const { data: rows } = await supabase
    .from("template_sections")
    .select("id, position")
    .eq("template_id", templateId)
    .order("position");
  await swapWithNeighbour(supabase, "template_sections", rows ?? [], sectionId, direction);
  refresh(templateId);
}

/** Додати задачу в кінець секції. */
export async function addTask(templateId: string, sectionId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const name = text(formData, "name");
  if (!name) return;
  // Секція має належати цьому шаблону: задача з чужою секцією не потрапила б у знімок жодного шаблону.
  const { data: section } = await supabase
    .from("template_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("template_id", templateId)
    .maybeSingle();
  if (!section) return;
  const { data: last } = await supabase
    .from("template_tasks")
    .select("position")
    .eq("section_id", sectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("template_tasks").insert({
    template_id: templateId,
    section_id: sectionId,
    name,
    required: formData.get("required") === "on",
    position: (last?.position ?? 0) + 1,
  });
  refresh(templateId);
}

/** Перейменувати задачу. */
export async function renameTask(templateId: string, taskId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const name = text(formData, "name");
  if (!name) return;
  await supabase.from("template_tasks").update({ name }).eq("id", taskId).eq("template_id", templateId);
  refresh(templateId);
}

/** Позначити задачу обов'язковою чи необов'язковою. */
export async function setTaskRequired(templateId: string, taskId: string, required: boolean): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  await supabase.from("template_tasks").update({ required }).eq("id", taskId).eq("template_id", templateId);
  refresh(templateId);
}

/** Прибрати задачу. */
export async function removeTask(templateId: string, taskId: string): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  await supabase.from("template_tasks").delete().eq("id", taskId).eq("template_id", templateId);
  refresh(templateId);
}

/** Поміняти задачу місцями із сусідньою в тій самій секції. */
export async function moveTask(templateId: string, sectionId: string, taskId: string, direction: "up" | "down"): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const { data: rows } = await supabase
    .from("template_tasks")
    .select("id, position")
    .eq("template_id", templateId)
    .eq("section_id", sectionId)
    .order("position");
  await swapWithNeighbour(supabase, "template_tasks", rows ?? [], taskId, direction);
  refresh(templateId);
}

/** Новий порядок секцій після перетягування: позиції 1..N за списком id (лише секції цього шаблону). */
export async function reorderSections(templateId: string, ids: string[]): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const { data: rows } = await supabase.from("template_sections").select("id, position").eq("template_id", templateId);
  await applyOrder(supabase, "template_sections", rows ?? [], ids);
  refresh(templateId);
}

/** Новий порядок задач секції після перетягування (лише задачі цієї секції цього шаблону). */
export async function reorderTasks(templateId: string, sectionId: string, ids: string[]): Promise<void> {
  const supabase = await createClient();
  if (await denyUnlessAdmin(supabase, await supabase.auth.getClaims())) return;
  const { data: rows } = await supabase
    .from("template_tasks")
    .select("id, position")
    .eq("template_id", templateId)
    .eq("section_id", sectionId);
  await applyOrder(supabase, "template_tasks", rows ?? [], ids);
  refresh(templateId);
}

/** Зберегти шаблон як нову версію (AC-EDITOR-03, AC-EDITOR-04): лише функцією бази. */
export async function saveVersion(templateId: string): Promise<SaveState> {
  const supabase = await createClient();
  const denied = await denyUnlessAdmin(supabase, await supabase.auth.getClaims());
  if (denied) return { error: denied };
  const { data: number, error } = await supabase.rpc("save_template_version", { p_template_id: templateId });
  if (error || typeof number !== "number") return { error: saveErrorMessage(error?.message) };
  refresh(templateId);
  return { saved: versionSaved(number) };
}

async function swapWithNeighbour(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "template_sections" | "template_tasks",
  rows: { id: string; position: number }[],
  id: string,
  direction: "up" | "down",
) {
  const i = rows.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  // Позиції можуть збігатися — тоді нумеруємо за поточним порядком і міняємо двох сусідів.
  const a = { id: rows[i].id, position: j + 1 };
  const b = { id: rows[j].id, position: i + 1 };
  await supabase.from(table).update({ position: a.position }).eq("id", a.id);
  await supabase.from(table).update({ position: b.position }).eq("id", b.id);
}

async function applyOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "template_sections" | "template_tasks",
  rows: { id: string; position: number }[],
  ids: string[],
) {
  // Той самий набір рядків, лише в іншому порядку: чужі чи пропущені id — нічого не змінюємо.
  if (ids.length !== rows.length || new Set(ids).size !== ids.length) return;
  const current = new Map(rows.map((r) => [r.id, r.position]));
  if (ids.some((id) => !current.has(id))) return;
  for (const [i, id] of ids.entries()) {
    if (current.get(id) !== i + 1) await supabase.from(table).update({ position: i + 1 }).eq("id", id);
  }
}
