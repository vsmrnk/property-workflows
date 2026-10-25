import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AppShell, Card, Icon, PageHeader } from "./ui";

// Скелетони лише на місці даних з бази. Заголовки, підписи, кнопки й навігація — справжні й показуються одразу.

function Bar({ className }: { className: string }) {
  return <span className={`skeleton block ${className}`} />;
}

function TableRows({ rows, cols }: { rows: number; cols: string[] }) {
  return (
    <div className="divide-y divide-border">
      <div className="flex gap-6 px-5 py-3">
        {cols.map((w, i) => (
          <Bar key={i} className={`h-3 ${w}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 px-5 py-3.5">
          {cols.map((w, i) => (
            <Bar key={i} className={`h-4 ${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function RunsListSkeleton() {
  return (
    <AppShell email={null} role={null} crumbs={[{ label: "Runs" }]} busy>
      <PageHeader
        title="Runs"
        description={<Bar className="mt-1 h-3.5 w-40" />}
        actions={
          <Link href="/templates" className={buttonVariants()}>
            <Icon name="plus" />
            Launch a template
          </Link>
        }
      />
      <Card>
        <TableRows rows={4} cols={["w-48", "w-32", "w-40", "w-20", "w-32"]} />
      </Card>
    </AppShell>
  );
}

export function RunDetailSkeleton() {
  return (
    <AppShell email={null} role={null} crumbs={[{ label: "Runs", href: "/" }, { label: "…" }]} busy>
      <div className="flex flex-col gap-2">
        <Bar className="h-7 w-64" />
        <Bar className="h-3.5 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {["Progress", "Run manager", "Launched"].map((label) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <Bar className="mt-2.5 h-4 w-32" />
          </Card>
        ))}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        The run completes when every required task is done; optional tasks don&apos;t block it.
      </p>
      {[3, 2].map((rows, s) => (
        <Card key={s}>
          <div className="border-b border-border px-5 py-3">
            <Bar className="h-4 w-32" />
          </div>
          <TableRows rows={rows} cols={["w-48", "w-40", "w-16", "w-16"]} />
        </Card>
      ))}
    </AppShell>
  );
}

export function TemplatesSkeleton() {
  return (
    <AppShell email={null} role={null} crumbs={[{ label: "Launch a template" }]} busy>
      <PageHeader title="Launch a template" description="Choose the process to start for a case." />
      <Card>
        <TableRows rows={2} cols={["w-48", "w-16", "w-20", "w-16"]} />
      </Card>
    </AppShell>
  );
}
