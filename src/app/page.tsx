import Link from "next/link";
import { redirect } from "next/navigation";
import { countProgress, progressOf } from "@/lib/runs/progress";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Card, Icon, ProgressBar, RunStatusBadge, btnPrimary } from "./_components/ui";

// Головна: рани, які бачить користувач (RLS: менеджер — свої й ті, де він виконавець; admin — усі) з прогресом
// «N of M done» (AC-TASK-06, AC-TASK-09).
export default async function Home() {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  // RLS: користувач бачить лише власний профіль.
  const [{ data: profile }, { data: runs }] = await Promise.all([
    supabase.from("profiles").select("email, full_name, role").eq("id", claims.sub).maybeSingle(),
    supabase
      .from("runs")
      .select("id, case_name, status, created_at, templates(name), run_tasks(status, required)")
      .order("created_at", { ascending: false }),
  ]);

  const inProgress = (runs ?? []).filter((r) => r.status === "in_progress").length;
  const completed = (runs ?? []).filter((r) => r.status === "completed").length;

  return (
    <AppShell email={profile?.email ?? claims.email ?? "—"} role={profile?.role ?? null}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inProgress} in progress · {completed} completed
          </p>
        </div>
        <Link href="/runs/new" className={btnPrimary}>
          <Icon name="plus" />
          Launch a template
        </Link>
      </div>

      {runs && runs.length > 0 ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border" data-testid="runs">
            {runs.map((run) => {
              const tasks = run.run_tasks ?? [];
              const { done, total } = countProgress(tasks);
              return (
                <li key={run.id}>
                  <Link
                    href={`/runs/${run.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition-colors duration-200 hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-semibold">{run.case_name}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon name="list" className="size-3.5" />
                        {run.templates?.name ?? "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-4 sm:w-80 sm:justify-end">
                      <RunStatusBadge status={run.status} />
                      <ProgressBar
                        done={done}
                        total={total}
                        label={progressOf(tasks)}
                        required={countProgress(tasks.filter((t) => t.required))}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="list" className="size-5" />
          </span>
          <p className="font-semibold">No runs yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Launch a template for a case to start tracking its tasks and progress.</p>
          <Link href="/runs/new" className={`${btnPrimary} mt-2`}>
            <Icon name="plus" />
            Launch a template
          </Link>
        </Card>
      )}
    </AppShell>
  );
}
