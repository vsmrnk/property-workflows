import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

const STATUS_LABEL: Record<string, string> = { in_progress: "in progress", completed: "completed" };

// Головна: хто увійшов і рани, які він бачить (RLS: менеджер — свої й ті, де він виконавець; admin — усі).
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
      .select("id, case_name, status, created_at, templates(name)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Runs</h1>
          <p className="text-sm text-zinc-500">
            <span data-testid="user-email">{profile?.email ?? claims.email ?? "—"}</span> ·{" "}
            <span data-testid="user-role">{profile?.role ?? "профіль не знайдено"}</span>
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Вийти
          </button>
        </form>
      </div>

      <Link
        href="/runs/new"
        className="self-start rounded bg-foreground px-4 py-2 font-medium text-background"
      >
        Launch a template
      </Link>

      {runs && runs.length > 0 ? (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-300 dark:divide-zinc-800 dark:border-zinc-700" data-testid="runs">
          {runs.map((run) => (
            <li key={run.id}>
              <Link href={`/runs/${run.id}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <span className="flex flex-col">
                  <span className="font-medium">{run.case_name}</span>
                  <span className="text-xs text-zinc-500">{run.templates?.name ?? "—"}</span>
                </span>
                <span className="text-xs text-zinc-500">{STATUS_LABEL[run.status] ?? run.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No runs yet.</p>
      )}
    </main>
  );
}
