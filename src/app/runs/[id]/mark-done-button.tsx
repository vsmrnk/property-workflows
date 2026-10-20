"use client";

import { useActionState } from "react";
import { markTaskDone, type MarkState } from "./actions";

export function MarkDoneButton({ runId, taskId }: { runId: string; taskId: string }) {
  const [state, formAction, pending] = useActionState<MarkState>(markTaskDone.bind(null, runId, taskId), {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark as done"}
      </button>
      {state.error ? (
        <p role="alert" className="max-w-56 text-right text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
