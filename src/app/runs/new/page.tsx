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

  const [{ data: templates }, { data: me }] = await Promise.all([
    supabase.from("templates").select("id, name").order("name"),
    supabase.from("profiles").select("email, role").eq("id", claims.sub).maybeSingle(),
  ]);
  // Лічильники рахує база (count, без рядків), тож ліміт відповіді в 1000 рядків їх не обрізає.
  const counts = new Map(
    await Promise.all(
      (templates ?? []).map(async (t) => {
        const [all, required] = await Promise.all([
          supabase.from("template_tasks").select("id", { count: "exact", head: true }).eq("template_id", t.id),
          supabase
            .from("template_tasks")
            .select("id", { count: "exact", head: true })
            .eq("template_id", t.id)
            .eq("required", true),
        ]);
        return [t.id, { total: all.count ?? 0, required: required.count ?? 0 }] as const;
      }),
    ),
  );
  const email = me?.email ?? claims.email ?? "—";
  const role = me?.role ?? null;

  if (!templateId) {
    return (
      <AppShell email={email} role={role}>
        <BackLink href="/">Runs</BackLink>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">Launch a template</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose the process to start for a case.</p>
        </div>
        {(templates ?? []).length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-muted-foreground">
            No templates yet. An administrator prepares templates before they can be launched.
          </Card>
        ) : null}
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="templates">
          {(templates ?? []).map((t, i) => {
            const tint = (["tint-lavender", "tint-peach", "tint-lime"] as const)[i % 3];
            const count = counts.get(t.id) ?? { total: 0, required: 0 };
            return (
              <li key={t.id}>
                <Link
                  href={`/runs/new?template=${t.id}`}
                  className={`settle ${tint} group flex h-full flex-col gap-3 rounded-[22px] border-[1.6px] border-card-edge p-6 shadow-[0_2px_16px_rgba(24,30,45,0.045)] transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(24,30,45,0.10)]`}
                >
                  <span className="grid size-10 place-items-center rounded-full bg-surface text-accent shadow-[0_0_0_3px_rgba(0,0,0,0.047)]">
                    <Icon name="list" className="size-5" />
                  </span>
                  <span className="text-lg font-extrabold tracking-[-0.02em]">{t.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {count.total} tasks · {count.required} required
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
      <BackLink href="/runs/new">Launch a template</BackLink>
      <div>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">Launch “{chosen?.name ?? "template"}”</h1>
        <p className="mt-1 text-sm text-muted-foreground">Name the case and choose who does each task.</p>
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
