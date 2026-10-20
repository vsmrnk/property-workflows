"use client";

import { useActionState } from "react";
import { Icon, btnSecondary } from "../../_components/ui";
import { markTaskDone, type MarkState } from "./actions";

export function MarkDoneButton({ runId, taskId }: { runId: string; taskId: string }) {
  const [state, formAction, pending] = useActionState<MarkState>(markTaskDone.bind(null, runId, taskId), {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={pending} className={`${btnSecondary} min-h-9 px-3 py-1.5`}>
        <Icon name="check" />
        {pending ? "Saving…" : "Mark as done"}
      </button>
      {state.error ? (
        <p role="alert" className="max-w-64 text-right text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
