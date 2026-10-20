import { notFound, redirect } from "next/navigation";
import { loadPeople, nameOf } from "@/lib/runs/people";
import { canMarkDone, countProgress, progressOf } from "@/lib/runs/progress";
import { createClient } from "@/lib/supabase/server";
import { AppShell, BackLink, Card, Icon, ProgressBar, RequiredTag, RunStatusBadge, TaskStatusBadge } from "../../_components/ui";
import { MarkDoneButton } from "./mark-done-button";

// Сторінка рану: прогрес «N of M done» (AC-TASK-05), статус кожної задачі (AC-TASK-08), «Mark as done» лише для
// виконавця, менеджера рану чи адміністратора (AC-TASK-01, 02, 07). Ран, якого RLS не віддає (AC-TASK-06), —
// notFound() (design.md impl-run-launch, D9 — тимчасово до відповіді PM на Q2, solomchaak/property-workflows-spec#4).
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

  // Групуємо за позицією секції (а не назвою): дві секції з однаковою назвою не зливаються.
  const sections: { key: number; name: string; tasks: typeof allTasks }[] = [];
  for (const task of allTasks) {
    const last = sections.at(-1);
    if (last && last.key === task.section_position) last.tasks.push(task);
    else sections.push({ key: task.section_position, name: task.section_name, tasks: [task] });
  }

  const launched = new Date(run.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  });

  return (
    <AppShell email={me?.email ?? claims.email ?? "—"} role={viewer.role}>
      <BackLink href="/">Runs</BackLink>

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-accent">
              <Icon name="list" className="size-4" />
              {run.templates?.name ?? "—"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight" data-testid="case-name">
              {run.case_name}
            </h1>
          </div>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-3">
          <ProgressBar done={done} total={total} label={progressOf(allTasks)} />
          <div className="text-sm">
            <p className="text-muted-foreground">Run manager</p>
            <p className="mt-0.5 font-medium">{nameOf(people, run.manager_id)}</p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Launched</p>
            <p className="mt-0.5 font-medium tabular-nums">{launched}</p>
          </div>
        </div>
      </Card>

      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-3">
          <h2 className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {section.name}
            <span className="font-medium normal-case tabular-nums">{progressOf(section.tasks)}</span>
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {section.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="run-task"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={`flex items-center gap-2 font-medium ${task.status === "done" ? "text-muted-foreground line-through decoration-1" : ""}`}>
                      {task.name}
                      {task.required ? <RequiredTag /> : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="user" className="size-3.5" />
                      {nameOf(people, task.assignee_id)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <TaskStatusBadge status={task.status} />
                    {canMarkDone(task, run, viewer) ? <MarkDoneButton runId={run.id} taskId={task.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </AppShell>
  );
}
