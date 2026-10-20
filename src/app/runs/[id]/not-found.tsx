import { RUN_NOT_FOUND } from "@/lib/runs/messages";
import { BackLink, Card } from "../../_components/ui";

// Чужий або неіснуючий ран (AC-TASK-10; відповідь PM на #4): лише «Run not found», жодної задачі.
export default function RunNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/">Runs</BackLink>
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]" data-testid="run-not-found">
          {RUN_NOT_FOUND}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The link may be wrong, or the run is not shared with you.
        </p>
      </Card>
    </main>
  );
}
