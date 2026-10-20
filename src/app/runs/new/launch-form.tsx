"use client";

import { useActionState } from "react";
import { Card, RequiredTag, btnPrimary, inputClass } from "../../_components/ui";
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

      <Card tint="peach" className="settle p-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="caseName">
          Case name
          <input
            id="caseName"
            name="caseName"
            defaultValue={state.caseName ?? ""}
            placeholder="Apartment 12, move-in"
            aria-describedby="caseName-help"
            aria-invalid={state.error ? true : undefined}
            className={inputClass}
            data-testid="case-name"
          />
        </label>
        <p id="caseName-help" className="mt-1.5 text-xs text-muted-foreground">
          Up to 100 characters. You become the run manager.
        </p>
        {state.error ? (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" data-testid="launch-error">
            {state.error}
          </p>
        ) : null}
      </Card>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold tracking-[-0.02em]">Assignees</h2>
        <p className="text-sm text-muted-foreground">Tasks you don&apos;t assign stay with you.</p>
      </div>

      {sections.map((section) => (
        <Card key={section.id} className="settle settle-2 overflow-hidden">
          <fieldset>
            <legend className="w-full border-b border-border px-5 py-3 text-sm font-bold tracking-[-0.01em]">{section.name}</legend>
            <ul className="divide-y divide-border">
              {section.tasks.map((task) => (
                <li key={task.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor={`assignee-${task.id}`} className="flex items-center gap-2 text-sm font-medium">
                    {task.name}
                    {task.required ? <RequiredTag /> : null}
                  </label>
                  <select
                    id={`assignee-${task.id}`}
                    name={`assignee:${task.id}`}
                    defaultValue=""
                    className={`${inputClass} cursor-pointer sm:w-72`}
                  >
                    <option value="">Me (run manager)</option>
                    {others.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </fieldset>
        </Card>
      ))}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Launching…" : "Launch run"}
        </button>
      </div>
    </form>
  );
}
