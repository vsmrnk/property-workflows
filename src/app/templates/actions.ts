"use server";

import { redirect } from "next/navigation";
import { denyUnlessAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ENTER_TEMPLATE_NAME } from "@/lib/templates/format";

export type CreateState = { error?: string; name?: string };

/** Створити новий шаблон з назвою (Основний сценарій #20, крок 1) і відкрити його в редакторі. Лише admin (A2). */
export async function createTemplate(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const supabase = await createClient();
  const denied = await denyUnlessAdmin(supabase, await supabase.auth.getClaims());
  if (denied) return { error: denied };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: ENTER_TEMPLATE_NAME, name };
  const { data, error } = await supabase.from("templates").insert({ name }).select("id").single();
  if (error || !data) {
    return { error: error?.code === "23505" ? "A template with this name already exists" : "Something went wrong. Try again.", name };
  }
  redirect(`/templates/${data.id}/edit`);
}
