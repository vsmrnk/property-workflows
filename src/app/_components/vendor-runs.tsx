import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NO_VENDOR_TASKS } from "@/lib/runs/messages";
import { yourTasksLabel } from "@/lib/runs/progress";
import type { createClient } from "@/lib/supabase/server";
import { AppShell, CLICKABLE_ROW, Card, Icon, PageHeader, RowLink, RunStatusBadge } from "./ui";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Список ранів вендора (impl-vendor-access, U2): лише рани, де він виконавець, — назва кейсу, статус рану й «Your
 * tasks: N of K done» (AC-VENDOR-03). Дані — з public.vendor_runs(): таблиці runs вендору RLS не віддає (D4, D5).
 * Без жодної задачі — «No tasks assigned to you yet.» замість таблиці (AC-VENDOR-10). Запуску шаблону немає.
 */
export async function vendorHome({ supabase, email }: { supabase: Client; email: string }) {
  const { data, error } = await supabase.rpc("vendor_runs");
  // Помилка бази — не «задач немає»: «No tasks assigned to you yet.» сказав би неправду (AC-VENDOR-10).
  if (error) throw new Error(`vendor_runs failed: ${error.message}`);
  const runs = data ?? [];

  return (
    <AppShell email={email} role="vendor" crumbs={[{ label: "Runs" }]}>
      <PageHeader title="Runs" description="Runs where tasks are assigned to you." />
      {runs.length > 0 ? (
        <Card>
          <Table data-testid="vendor-runs">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Case</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5">Your tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} data-testid="vendor-run" className={CLICKABLE_ROW}>
                  <TableCell className="pl-5">
                    <RowLink href={`/runs/${run.id}`}>{run.case_name}</RowLink>
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="pr-5 tabular-nums" data-testid="your-tasks">
                    {yourTasksLabel(run.my_done, run.my_total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <Icon name="list" className="size-5" />
          </span>
          <p className="font-medium" data-testid="vendor-runs-empty">
            {NO_VENDOR_TASKS}
          </p>
        </Card>
      )}
    </AppShell>
  );
}
