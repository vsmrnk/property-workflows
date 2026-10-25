import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AppShell, BackLink, Card, Icon } from "./ui";

// Скелетони лише на місці даних з бази. Заголовки, підписи, кнопки й навігація — справжні й показуються одразу.

function Bar({ className }: { className: string }) {
  return <span className={`skeleton block ${className}`} />;
}

export function RunsListSkeleton() {
  return (
    <AppShell email={null} role={null} busy>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title font-extrabold">Runs</h1>
          <Bar className="mt-2 h-3.5 w-40" />
        </div>
        <Link href="/runs/new" className={buttonVariants()}>
          <Icon name="plus" />
          Launch a template
        </Link>
      </div>
      <Card className="divide-y divide-border overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <Bar className="h-4 w-48" />
              <Bar className="h-3 w-28" />
            </div>
            <div className="flex items-center gap-4 sm:w-80 sm:justify-end">
              <Bar className="h-6 w-24" />
              <div className="flex w-36 flex-col gap-2">
                <Bar className="h-3.5 w-20" />
                <Bar className="h-2 w-full" />
              </div>
            </div>
          </div>
        ))}
      </Card>
    </AppShell>
  );
}

export function RunDetailSkeleton() {
  return (
    <AppShell email={null} role={null} busy>
      <BackLink href="/">Runs</BackLink>
      <Card tint="lavender" className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <Bar className="h-7 w-64" />
            <Bar className="h-3.5 w-32" />
          </div>
          <Bar className="h-6 w-24" />
        </div>
        <div className="grid gap-5 border-t border-foreground/10 pt-5 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Bar className="h-3.5 w-24" />
            <Bar className="h-2 w-full" />
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Run manager</p>
            <Bar className="mt-1.5 h-4 w-36" />
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Launched</p>
            <Bar className="mt-1.5 h-4 w-24" />
          </div>
        </div>
      </Card>
      <p className="-mt-2 text-sm text-muted-foreground">
        The run completes when every required task is done; optional tasks don&apos;t block it.
      </p>
      {[3, 2].map((rows, s) => (
        <div key={s} className="flex flex-col gap-3">
          <Bar className="h-3.5 w-32" />
          <Card className="divide-y divide-border overflow-hidden">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="flex flex-col gap-2">
                  <Bar className="h-4 w-44" />
                  <Bar className="h-3 w-24" />
                </div>
                <Bar className="h-6 w-16" />
              </div>
            ))}
          </Card>
        </div>
      ))}
    </AppShell>
  );
}

export function TemplatesSkeleton() {
  return (
    <AppShell email={null} role={null} busy>
      <BackLink href="/">Runs</BackLink>
      <div>
        <h1 className="text-title font-extrabold">Launch a template</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose the process to start for a case.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["lavender", "peach"] as const).map((tint) => (
          <Card key={tint} tint={tint} className="flex flex-col gap-3 p-6">
            <span className="grid size-10 place-items-center rounded-full bg-card text-accent-foreground shadow-outline">
              <Icon name="list" className="size-5" />
            </span>
            <Bar className="h-5 w-40" />
            <Bar className="h-3.5 w-28" />
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
