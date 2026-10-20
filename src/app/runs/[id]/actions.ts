"use server";

import { revalidatePath } from "next/cache";
import { messageFor } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";

export type MarkState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Позначити задачу виконаною (AC-TASK-01, 02, 03, 07): право перевіряє private.mark_task_done. */
export async function markTaskDone(runId: string, taskId: string): Promise<MarkState> {
  if (!UUID.test(runId) || !UUID.test(taskId)) return { error: messageFor("NOT_ALLOWED") };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: messageFor("NOT_AUTHENTICATED") };

  const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId });
  if (error) return { error: messageFor(error.message) };

  revalidatePath(`/runs/${runId}`);
  revalidatePath("/");
  return {};
}
