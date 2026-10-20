"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateCaseName } from "@/lib/runs/case-name";
import { MESSAGES, messageFor } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";

export type LaunchState = { error?: string; caseName?: string };

const ASSIGNEE_PREFIX = "assignee:";

/** Запуск шаблону для кейсу (AC-RUN-01…AC-RUN-09): одна транзакція в public.launch_run. */
export async function launchRun(_prev: LaunchState, formData: FormData): Promise<LaunchState> {
  const templateId = String(formData.get("templateId") ?? "");
  const rawName = formData.get("caseName");
  const caseName = typeof rawName === "string" ? rawName : "";

  const name = validateCaseName(caseName);
  if (!name.ok) return { error: MESSAGES[name.code], caseName };
  if (!templateId) return { error: MESSAGES.TEMPLATE_NOT_FOUND, caseName };

  // Порожнє значення — «me, the run manager»: такі задачі launch_run віддає менеджеру рану (AC-RUN-04, 08, 09).
  const assignments: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(ASSIGNEE_PREFIX) && typeof value === "string" && value !== "") {
      assignments[key.slice(ASSIGNEE_PREFIX.length)] = value;
    }
  }

  const supabase = await createClient();
  const { data: runId, error } = await supabase.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: name.value,
    p_assignments: assignments,
  });
  if (error || !runId) return { error: messageFor(error?.message), caseName };

  revalidatePath("/");
  redirect(`/runs/${runId}`);
}
