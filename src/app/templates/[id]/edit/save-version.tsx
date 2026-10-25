"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveVersion, type SaveState } from "./actions";

/**
 * «Save» — основна дія редактора (AC-EDITOR-03, AC-EDITOR-04). Недоступна, доки немає незбережених змін (Q3 #22,
 * варіант A). Помилка — Alert з текстом PM; успіх — «Version N saved» на місці, без спливних вікон. Сторінка монтує
 * компонент наново після кожної правки (key), тож старе повідомлення не лишається.
 */
export function SaveVersion({ templateId, hasChanges }: { templateId: string; hasChanges: boolean }) {
  const [state, formAction, pending] = useActionState<SaveState>(saveVersion.bind(null, templateId), {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <Button type="submit" disabled={!hasChanges || pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error ? (
        <Alert variant="destructive" className="max-w-sm" data-testid="save-error">
          <AlertDescription className="text-destructive">{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.saved && !state.error && !hasChanges ? (
        <p role="status" className="text-sm text-status-done-foreground" data-testid="save-success">
          {state.saved}
        </p>
      ) : null}
    </form>
  );
}
