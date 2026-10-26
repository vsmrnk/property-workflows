"use client";

import { CircleCheck } from "lucide-react";
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
      {/* Статус збереження — ліворуч від кнопки, в одному рядку з нею. */}
      <div className="flex items-center gap-3">
        {state.saved && !state.error && !hasChanges ? (
          <p
            role="status"
            className="flex items-center gap-1.5 text-sm font-medium text-status-done-foreground select-none animate-in fade-in-0 slide-in-from-right-1 duration-200"
            data-testid="save-success"
          >
            <CircleCheck className="size-4" aria-hidden />
            {state.saved}
          </p>
        ) : null}
        <Button type="submit" disabled={!hasChanges || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {state.error ? (
        <Alert variant="destructive" className="max-w-sm" data-testid="save-error">
          <AlertDescription className="text-destructive">{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
