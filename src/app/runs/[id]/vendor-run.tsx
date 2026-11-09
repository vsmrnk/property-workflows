import { notFound } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { groupBySection, yourTasksLabel } from "@/lib/runs/progress";
import type { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AppShell, PageHeader, RequirementTag, TaskStatusBadge } from "../../_components/ui";
import { MarkDoneButton } from "./mark-done-button";
import { TaskSection } from "./task-section";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Сторінка рану для вендора (impl-vendor-access, U3). Ран, якого немає у vendor_runs() (у вендора там немає задач),
 * — notFound() → «Run not found» без задач (AC-VENDOR-06). Інакше лише його задачі з vendor_run_tasks(): назва,
 * секція, «required»/«optional», статус (AC-VENDOR-04) і «Mark as done» для «to do» (AC-VENDOR-05). Без виконавців,
 * менеджера рану, версії шаблону й прогресу всього рану. Таблиць runs і run_tasks сторінка не читає (D4, D5).
 */
export async function vendorRun({ supabase, runId, email }: { supabase: Client; runId: string; email: string }) {
  const { data: runs } = await supabase.rpc("vendor_runs");
  const run = (runs ?? []).find((r) => r.id === runId);
  if (!run) notFound();

  const { data: tasks } = await supabase.rpc("vendor_run_tasks", { p_run_id: runId });
  const sections = groupBySection(tasks ?? []);

  return (
    <AppShell email={email} role="vendor" crumbs={[{ label: "Runs", href: "/" }, { label: run.case_name }]}>
      <PageHeader
        title={run.case_name}
        titleTestId="case-name"
        description={
          <span className="tabular-nums" data-testid="your-tasks">
            {yourTasksLabel(run.my_done, run.my_total)}
          </span>
        }
      />

      {sections.map((section) => (
        <TaskSection
          key={section.key}
          sectionKey={section.key}
          name={section.name}
          secondColumn="Section"
        >
          {section.tasks.map((task) => (
            <TableRow key={task.id} data-testid="run-task">
              <TableCell className="truncate pl-5">
                <span
                  data-testid="task-name"
                  className={cn("font-medium", task.status === "done" && "text-muted-foreground line-through decoration-1")}
                >
                  {task.name}
                </span>
              </TableCell>
              <TableCell className="hidden truncate text-muted-foreground md:table-cell">
                <span data-testid="task-section">{task.section_name}</span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <RequirementTag required={task.required} />
              </TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status} />
              </TableCell>
              <TableCell className="overflow-visible pr-5 text-right">
                {task.status === "to_do" ? (
                  <MarkDoneButton runId={runId} taskId={task.id} taskName={task.name} confirm={task.completes_run} />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TaskSection>
      ))}
    </AppShell>
  );
}
