import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPeople } from "@/lib/runs/people";
import { createClient } from "@/lib/supabase/server";
import { AppShell, BackLink, Card, Icon } from "../../_components/ui";
import { LaunchForm } from "./launch-form";

// Запуск шаблону для кейсу (openspec/specs/run-launch/spec.md): вибір шаблону → назва кейсу й виконавці задач.
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { template } = await searchParams;
  const templateId = typeof template === "string" ? template : "";

  const [{ data: templates }, { data: me }, { data: counts }] = await Promise.all([
    supabase.from("templates").select("id, name").order("name"),
    supabase.from("profiles").select("email, role").eq("id", claims.sub).maybeSingle(),
    supabase.from("template_tasks").select("template_id, required"),
  ]);
  const email = me?.email ?? claims.email ?? "—";
  const role = me?.role ?? null;

  if (!templateId) {
    return (
      <AppShell email={email} role={role}>
        <BackLink href="/">Runs</BackLink>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Launch a template</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose the process to start for a case.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="templates">
          {(templates ?? []).map((t) => {
            const tasks = (counts ?? []).filter((c) => c.template_id === t.id);
            const required = tasks.filter((c) => c.required).length;
            return (
              <li key={t.id}>
                <Link
                  href={`/runs/new?template=${t.id}`}
                  className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors duration-200 hover:border-accent"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon name="list" className="size-5" />
                  </span>
                  <span className="font-semibold group-hover:text-accent">{t.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {tasks.length} tasks · {required} required
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </AppShell>
    );
  }

  const chosen = (templates ?? []).find((t) => t.id === templateId);
  const [{ data: sections }, { data: tasks }, people] = await Promise.all([
    supabase.from("template_sections").select("id, name, position").eq("template_id", templateId).order("position"),
    supabase
      .from("template_tasks")
      .select("id, section_id, name, required, position")
      .eq("template_id", templateId)
      .order("position"),
    loadPeople(supabase),
  ]);

  const grouped = (sections ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    tasks: (tasks ?? []).filter((t) => t.section_id === s.id).map((t) => ({ id: t.id, name: t.name, required: t.required })),
  }));

  return (
    <AppShell email={email} role={role}>
      <BackLink href="/runs/new">Templates</BackLink>
      <div>
        <p className="text-sm font-medium text-accent">Launch a template</p>
        <h1 className="text-2xl font-bold tracking-tight">{chosen?.name ?? "Template"}</h1>
      </div>
      {chosen ? (
        <LaunchForm templateId={templateId} sections={grouped} people={people} meId={claims.sub} />
      ) : (
        <Card className="p-6">
          <p role="alert" className="text-sm text-danger">
            Template not found
          </p>
        </Card>
      )}
    </AppShell>
  );
}
