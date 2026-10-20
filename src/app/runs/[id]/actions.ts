"use server";

import { revalidatePath } from "next/cache";
import { messageFor } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";

export type MarkState = { error?: string };

/** Позначити задачу виконаною (AC-TASK-01, 02, 03, 07): право перевіряє public.mark_task_done і RLS. */
export async function markTaskDone(runId: string, taskId: string): Promise<MarkState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId });
  if (error) return { error: messageFor(error.message) };

  revalidatePath(`/runs/${runId}`);
  revalidatePath("/");
  return {};
}
