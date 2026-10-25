import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { emailOf, loadPeople } from "@/lib/runs/people";
import { countProgress, progressOf } from "@/lib/runs/progress";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Card, Icon, PageHeader, ProgressBar, RunStatusBadge } from "./_components/ui";

const launchedOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Kyiv" });

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
  const [{ data: profile }, { data: runs }, people] = await Promise.all([
    supabase.from("profiles").select("email, full_name, role").eq("id", claims.sub).maybeSingle(),
    supabase
      .from("runs")
      .select("id, case_name, status, manager_id, created_at, templates(name), run_tasks(status, required)")
      .order("created_at", { ascending: false }),
    loadPeople(supabase),
  ]);

  const inProgress = (runs ?? []).filter((r) => r.status === "in_progress").length;
  const completed = (runs ?? []).filter((r) => r.status === "completed").length;
  const launch = (
    <Link href="/runs/new" className={buttonVariants()}>
      <Icon name="plus" />
      Launch a template
    </Link>
  );

  return (
    <AppShell email={profile?.email ?? claims.email ?? "—"} role={profile?.role ?? null} crumbs={[{ label: "Runs" }]}>
      <PageHeader title="Runs" description={`${inProgress} in progress · ${completed} completed`} actions={launch} />

      {runs && runs.length > 0 ? (
        <Card>
          <Table data-testid="runs">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Case</TableHead>
                <TableHead className="hidden md:table-cell">Template</TableHead>
                <TableHead className="hidden lg:table-cell">Run manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">Launched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const tasks = run.run_tasks ?? [];
                const { done, total } = countProgress(tasks);
                return (
                  <TableRow key={run.id}>
                    <TableCell className="pl-5">
                      <Link href={`/runs/${run.id}`} className="rounded-sm font-medium hover:text-primary hover:underline">
                        {run.case_name}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">{run.templates?.name ?? "—"}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{run.templates?.name ?? "—"}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{emailOf(people, run.manager_id)}</TableCell>
                    <TableCell>
                      <RunStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="w-32 sm:w-44">
                      <ProgressBar
                        compact
                        done={done}
                        total={total}
                        label={progressOf(tasks)}
                        required={countProgress(tasks.filter((t) => t.required))}
                      />
                    </TableCell>
                    <TableCell className="hidden pr-5 text-right text-muted-foreground tabular-nums sm:table-cell">
                      {launchedOn(run.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <Icon name="list" className="size-5" />
          </span>
          <p className="font-semibold">No runs yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Launch a template for a case to start tracking its tasks and progress.</p>
          <div className="mt-2">{launch}</div>
        </Card>
      )}
    </AppShell>
  );
}
