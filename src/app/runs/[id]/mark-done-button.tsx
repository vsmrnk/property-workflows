"use client";

import { useActionState } from "react";
import { Icon, btnSecondary } from "../../_components/ui";
import { markTaskDone, type MarkState } from "./actions";

export function MarkDoneButton({ runId, taskId, taskName }: { runId: string; taskId: string; taskName: string }) {
  const [state, formAction, pending] = useActionState<MarkState>(markTaskDone.bind(null, runId, taskId), {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        aria-label={`Mark “${taskName}” as done`}
        className={`${btnSecondary} min-h-9 border-accent/40 px-3 py-1.5 text-accent hover:bg-accent-soft`}
      >
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
