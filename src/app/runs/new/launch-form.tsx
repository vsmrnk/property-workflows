"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, RequirementTag } from "../../_components/ui";
import { launchRun, type LaunchState } from "../actions";
import { AssigneeSelect } from "./assignee-select";

type Task = { id: string; name: string; required: boolean };
type Section = { id: string; name: string; tasks: Task[] };
type Person = { id: string; email: string };

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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="caseName">Case name</Label>
          <Input
            id="caseName"
            name="caseName"
            defaultValue={state.caseName ?? ""}
            placeholder="Apartment 12, move-in"
            aria-describedby={state.error ? "caseName-help launch-error" : "caseName-help"}
            aria-invalid={state.error ? true : undefined}
            data-testid="case-name"
          />
        </div>
        <p id="caseName-help" className="mt-1.5 text-xs text-muted-foreground">
          Up to 100 characters. You become the run manager.
        </p>
        {state.error ? (
          <Alert variant="destructive" id="launch-error" className="mt-3" data-testid="launch-error">
            <AlertDescription className="text-destructive">{state.error}</AlertDescription>
          </Alert>
        ) : null}
      </Card>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold tracking-tight">Assignees</h2>
        <p className="text-sm text-muted-foreground">Tasks you don&apos;t assign stay with you.</p>
      </div>

      {sections.map((section) => (
        <Card key={section.id} className="settle settle-2">
          <fieldset>
            <legend className="w-full border-b border-border px-5 py-3 text-sm font-bold tracking-tight">{section.name}</legend>
            <ul className="divide-y divide-border">
              {section.tasks.map((task) => (
                <li key={task.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span id={`task-label-${task.id}`} className="flex items-center gap-2 text-sm font-medium">
                    {task.name}
                    <RequirementTag required={task.required} />
                  </span>
                  <AssigneeSelect
                    id={`assignee-${task.id}`}
                    name={`assignee:${task.id}`}
                    labelId={`task-label-${task.id}`}
                    options={others.map((p) => ({ id: p.id, email: p.email }))}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Launching…" : "Launch run"}
        </Button>
      </div>
    </form>
  );
}
