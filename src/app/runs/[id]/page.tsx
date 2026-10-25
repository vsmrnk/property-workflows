import { notFound, redirect } from "next/navigation";
import { emailOf, loadPeople } from "@/lib/runs/people";
import { canMarkDone, countProgress, groupBySection, needsConfirmation, progressOf } from "@/lib/runs/progress";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppShell, Card, Icon, PageHeader, ProgressBar, RequirementTag, RunStatusBadge, TaskStatusBadge } from "../../_components/ui";
import { MarkDoneButton } from "./mark-done-button";

// Сторінка рану: прогрес «N of M done» (AC-TASK-05), статус кожної задачі (AC-TASK-08), «Mark as done» лише для
// виконавця, менеджера рану чи адміністратора (AC-TASK-01, 02, 07). Ран, якого RLS не віддає (AC-TASK-06), —
// notFound() — «Run not found» (AC-TASK-10, рішення PM: solomchaak/property-workflows-spec#4).
export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { id } = await params;
  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, status, manager_id, created_at, templates(name)")
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();

  const [{ data: tasks }, people, { data: me }] = await Promise.all([
    supabase
      .from("run_tasks")
      .select("id, section_name, section_position, name, required, position, assignee_id, status")
      .eq("run_id", id)
      .order("section_position")
      .order("position"),
    loadPeople(supabase),
    supabase.from("profiles").select("email, role").eq("id", claims.sub).maybeSingle(),
  ]);
  const viewer = { id: claims.sub, role: me?.role ?? null };
  const allTasks = tasks ?? [];
  const { done, total } = countProgress(allTasks);

  const sections = groupBySection(allTasks);

  const launched = new Date(run.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  });

  const manager = emailOf(people, run.manager_id);

  return (
    <AppShell
      email={me?.email ?? claims.email ?? "—"}
      role={viewer.role}
      crumbs={[{ label: "Runs", href: "/" }, { label: run.case_name }]}
    >
      <PageHeader
        title={run.case_name}
        titleTestId="case-name"
        badge={<RunStatusBadge status={run.status} />}
        description={
          <span className="flex items-center gap-2">
            <Icon name="list" className="size-4" />
            {run.templates?.name ?? "—"}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="mb-2 text-sm text-muted-foreground">Progress</p>
          <ProgressBar
            status={run.status}
            done={done}
            total={total}
            label={progressOf(allTasks)}
            required={countProgress(allTasks.filter((t) => t.required))}
          />
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Run manager</p>
          <p className="mt-2 truncate text-sm font-semibold">{manager}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Launched</p>
          <p className="mt-2 text-sm font-semibold tabular-nums">{launched}</p>
        </Card>
      </div>

      <p className="-mt-2 text-sm text-muted-foreground">
        The run completes when every required task is done; optional tasks don&apos;t block it.
      </p>

      {sections.map((section) => (
        <Card key={section.key} className="overflow-visible">
          <section aria-labelledby={`section-${section.key}`}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 id={`section-${section.key}`} className="text-sm font-semibold">
                {section.name}
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">{progressOf(section.tasks)}</span>
            </div>
            <Table className="table-fixed" containerClassName="overflow-visible">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Task</TableHead>
                  <TableHead className="hidden w-1/4 md:table-cell">Assignee</TableHead>
                  <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-40 pr-5 text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.tasks.map((task) => (
                  <TableRow key={task.id} data-testid="run-task">
                    <TableCell className="truncate pl-5">
                      <span className={cn("font-medium", task.status === "done" && "text-muted-foreground line-through decoration-1")}>
                        {task.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground md:hidden">
                        <Icon name="user" className="size-3.5" />
                        {emailOf(people, task.assignee_id)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden truncate text-muted-foreground md:table-cell">
                      <span data-testid="task-assignee">{emailOf(people, task.assignee_id)}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <RequirementTag required={task.required} />
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className="overflow-visible pr-5 text-right">
                      {canMarkDone(task, run, viewer) ? (
                        <MarkDoneButton
                          runId={run.id}
                          taskId={task.id}
                          taskName={task.name}
                          confirm={needsConfirmation(task, allTasks)}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </Card>
      ))}
    </AppShell>
  );
}
