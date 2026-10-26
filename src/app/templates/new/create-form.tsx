"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTemplate, type CreateState } from "../actions";

/** Назва нового шаблону → редактор (Основний сценарій #20, крок 1). */
export function CreateTemplateForm() {
  const [state, formAction, pending] = useActionState<CreateState, FormData>(createTemplate, {});
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-name">Template name</Label>
        <Input
          id="template-name"
          name="name"
          autoComplete="off"
          defaultValue={state.name ?? ""}
          placeholder="Repair"
          aria-describedby={state.error ? "create-error" : undefined}
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      {state.error ? (
        <Alert variant="destructive" id="create-error">
          <AlertDescription className="text-destructive">{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create template"}
        </Button>
      </div>
    </form>
  );
}
