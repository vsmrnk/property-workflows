"use client";

import { useActionState, useState } from "react";
import { CONFIRM_NOTICE } from "@/lib/runs/progress";
import { Icon, btnPrimary, btnSecondary } from "../../_components/ui";
import { markTaskDone, type MarkState } from "./actions";

/**
 * «Mark as done». Для останньої обов'язкової задачі рану (confirm) спершу питаємо підтвердження з назвою задачі
 * й «This cannot be undone»; «Cancel» нічого не надсилає — задача лишається «to do» (AC-TASK-04, AC-TASK-16).
 */
export function MarkDoneButton({
  runId,
  taskId,
  taskName,
  confirm = false,
}: {
  runId: string;
  taskId: string;
  taskName: string;
  confirm?: boolean;
}) {
  const [state, formAction, pending] = useActionState<MarkState>(markTaskDone.bind(null, runId, taskId), {});
  const [asking, setAsking] = useState(false);
  const markLabel = pending ? "Saving…" : "Mark as done";

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      {confirm && !asking ? (
        <button
          type="button"
          onClick={() => setAsking(true)}
          aria-label={`Mark “${taskName}” as done`}
          className={`${btnSecondary} min-h-9 border-accent/40 px-3 py-1.5 text-accent hover:bg-accent-soft`}
        >
          <Icon name="check" />
          Mark as done
        </button>
      ) : null}

      {confirm && asking ? (
        <div
          role="alertdialog"
          aria-labelledby={`confirm-${taskId}`}
          aria-describedby={`confirm-${taskId}-notice`}
          className="dropdown-pop flex max-w-80 flex-col gap-3 rounded-2xl border-[1.6px] border-card-edge bg-surface p-4 text-sm shadow-[0_14px_36px_rgba(70,66,120,0.18)]"
          data-testid="confirm-last-required"
        >
          <p id={`confirm-${taskId}`} className="font-bold">
            Mark “{taskName}” as done?
          </p>
          <p id={`confirm-${taskId}-notice`} className="text-muted-foreground">
            This is the last required task: the run will be completed. {CONFIRM_NOTICE}.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(false)} className={`${btnSecondary} min-h-9 px-3 py-1.5`} autoFocus>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={`${btnPrimary} min-h-9 px-4 py-1.5`}>
              {pending ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      ) : null}

      {!confirm ? (
        <button
          type="submit"
          disabled={pending}
          aria-label={`Mark “${taskName}” as done`}
          className={`${btnSecondary} min-h-9 border-accent/40 px-3 py-1.5 text-accent hover:bg-accent-soft`}
        >
          <Icon name="check" />
          {markLabel}
        </button>
      ) : null}

      {state.error ? (
        <p role="alert" className="max-w-64 text-right text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
