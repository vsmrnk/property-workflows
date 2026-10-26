"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

      <Card className="p-5">
        <div className="flex max-w-xl flex-col gap-1.5">
          <Label htmlFor="caseName">Case name</Label>
          <Input
            id="caseName"
            name="caseName"
            autoComplete="off"
            defaultValue={state.caseName ?? ""}
            placeholder="Apartment 12, move-in"
            aria-describedby={state.error ? "caseName-help launch-error" : "caseName-help"}
            aria-invalid={state.error ? true : undefined}
            data-testid="case-name"
          />
          <p id="caseName-help" className="text-sm text-muted-foreground">
            Up to 100 characters. You become the run manager.
          </p>
        </div>
        {state.error ? (
          <Alert variant="destructive" id="launch-error" className="mt-3 max-w-xl" data-testid="launch-error">
            <AlertDescription className="text-destructive">{state.error}</AlertDescription>
          </Alert>
        ) : null}
      </Card>

      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Assignees</h2>
        <p className="text-sm text-muted-foreground">Tasks you don&apos;t assign stay with you.</p>
      </div>

      {sections.map((section) => (
        <Card key={section.id}>
          <fieldset>
            <legend className="sr-only">{section.name}</legend>
            <div aria-hidden="true" className="border-b border-border px-5 py-3 text-sm font-semibold">
              {section.name}
            </div>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Task</TableHead>
                  <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
                  <TableHead className="w-56 pr-5 sm:w-72">Assignee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="pl-5">
                      <span id={`task-label-${task.id}`} className="font-medium">
                        {task.name}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <RequirementTag required={task.required} />
                    </TableCell>
                    <TableCell className="pr-5">
                      <AssigneeSelect
                        id={`assignee-${task.id}`}
                        name={`assignee:${task.id}`}
                        labelId={`task-label-${task.id}`}
                        options={others.map((p) => ({ id: p.id, email: p.email }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
