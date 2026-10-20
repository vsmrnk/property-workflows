import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadPeople, nameOf } from "@/lib/runs/people";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = { in_progress: "in progress", completed: "completed" };
const TASK_LABEL: Record<string, string> = { to_do: "to do", done: "done" };

// Сторінка рану. Ран, якого RLS не віддає (AC-TASK-06), — notFound()
// (design.md impl-run-launch, D9 — тимчасово до відповіді PM на Q2, solomchaak/property-workflows-spec#4).
export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { id } = await params;
  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, status, manager_id, templates(name)")
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();

  const [{ data: tasks }, people] = await Promise.all([
    supabase
      .from("run_tasks")
      .select("id, section_name, section_position, name, required, position, assignee_id, status")
      .eq("run_id", id)
      .order("section_position")
      .order("position"),
    loadPeople(supabase),
  ]);

  const sections: { name: string; tasks: NonNullable<typeof tasks> }[] = [];
  for (const task of tasks ?? []) {
    const last = sections.at(-1);
    if (last && last.name === task.section_name) last.tasks.push(task);
    else sections.push({ name: task.section_name, tasks: [task] });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500">
        ← Runs
      </Link>
      <h1 className="text-2xl font-semibold" data-testid="case-name">
        {run.case_name}
      </h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Template</dt>
        <dd>{run.templates?.name ?? "—"}</dd>
        <dt className="text-zinc-500">Status</dt>
        <dd data-testid="run-status">{STATUS_LABEL[run.status] ?? run.status}</dd>
        <dt className="text-zinc-500">Run manager</dt>
        <dd>{nameOf(people, run.manager_id)}</dd>
      </dl>

      {sections.map((section) => (
        <section key={section.name} className="flex flex-col gap-2">
          <h2 className="font-medium">{section.name}</h2>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-300 dark:divide-zinc-800 dark:border-zinc-700">
            {section.tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm" data-testid="run-task">
                <div className="flex flex-col">
                  <span>
                    {task.name}
                    {task.required ? <span className="ml-2 text-xs text-zinc-500">required</span> : null}
                  </span>
                  <span className="text-xs text-zinc-500">Assignee: {nameOf(people, task.assignee_id)}</span>
                </div>
                <span data-testid="task-status">{TASK_LABEL[task.status] ?? task.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
