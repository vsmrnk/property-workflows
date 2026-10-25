"use client";

import { useActionState, useState } from "react";
import { CONFIRM_NOTICE } from "@/lib/runs/progress";
import { Button } from "@/components/ui/button";
import { Icon } from "../../_components/ui";
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
        <Button type="button" variant="outline" size="sm" onClick={() => setAsking(true)} aria-label={`Mark “${taskName}” as done`}>
          <Icon name="check" />
          Mark as done
        </Button>
      ) : null}

      {confirm && asking ? (
        <div
          role="alertdialog"
          aria-labelledby={`confirm-${taskId}`}
          aria-describedby={`confirm-${taskId}-notice`}
          className="flex max-w-80 animate-in flex-col gap-3 rounded-2xl border-[1.6px] border-card-edge bg-popover p-4 text-sm text-popover-foreground shadow-float fade-in-0 zoom-in-95"
          data-testid="confirm-last-required"
        >
          <p id={`confirm-${taskId}`} className="font-bold">
            Mark “{taskName}” as done?
          </p>
          <p id={`confirm-${taskId}-notice`} className="text-muted-foreground">
            This is the last required task: the run will be completed. {CONFIRM_NOTICE}.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAsking(false)} autoFocus>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </div>
      ) : null}

      {!confirm ? (
        <Button type="submit" variant="outline" size="sm" disabled={pending} aria-label={`Mark “${taskName}” as done`}>
          <Icon name="check" />
          {markLabel}
        </Button>
      ) : null}

      {state.error ? (
        <p role="alert" className="max-w-64 text-right text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
