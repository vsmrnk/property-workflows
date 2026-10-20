"use client";

import { useActionState } from "react";
import { launchRun, type LaunchState } from "../actions";

type Task = { id: string; name: string; required: boolean };
type Section = { id: string; name: string; tasks: Task[] };
type Person = { id: string; label: string };

export function LaunchForm({
  templateId,
  sections,
  people,
  meId,
}: {
  templateId: string;
  sections: Section[];
  people: Person[];
  meId: string;
}) {
  const [state, formAction, pending] = useActionState<LaunchState, FormData>(launchRun, {});
  const others = people.filter((p) => p.id !== meId);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="templateId" value={templateId} />

      <label className="flex flex-col gap-1 text-sm">
        Case name
        <input
          name="caseName"
          defaultValue={state.caseName ?? ""}
          placeholder="Apartment 12, move-in"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          data-testid="case-name"
        />
      </label>

      {sections.map((section) => (
        <fieldset key={section.id} className="flex flex-col gap-3">
          <legend className="mb-2 font-medium">{section.name}</legend>
          {section.tasks.map((task) => (
            <label key={task.id} className="grid grid-cols-[1fr_14rem] items-center gap-3 text-sm">
              <span>
                {task.name}
                {task.required ? <span className="ml-2 text-xs text-zinc-500">required</span> : null}
              </span>
              <select
                name={`assignee:${task.id}`}
                defaultValue=""
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Me (run manager)</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ))}

      {state.error ? (
        <p role="alert" className="text-sm text-red-600" data-testid="launch-error">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Launching…" : "Launch"}
      </button>
    </form>
  );
}
