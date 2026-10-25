import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loadPeople } from "@/lib/runs/people";
import { createClient } from "@/lib/supabase/server";
import { publishedSections, versionLabel } from "@/lib/templates/format";
import { AppShell, PageHeader } from "../../_components/ui";
import { LaunchForm } from "./launch-form";

// Запуск шаблону для кейсу (openspec/specs/run-launch/spec.md): вибір шаблону → назва кейсу й виконавці задач.
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { template } = await searchParams;
  const templateId = typeof template === "string" ? template : "";
  // Вибір шаблону — на сторінці «Templates» (U2).
  if (!templateId) redirect("/templates");

  // Секції й задачі — з поточної версії (U7): робочої копії менеджер не бачить (RLS, AC-EDITOR-02).
  const [{ data: chosen }, { data: me }, people] = await Promise.all([
    supabase.from("templates").select("id, name, current_version, published_sections").eq("id", templateId).maybeSingle(),
    supabase.from("profiles").select("email, role").eq("id", claims.sub).maybeSingle(),
    loadPeople(supabase),
  ]);
  const email = me?.email ?? claims.email ?? "—";
  const role = me?.role ?? null;
  const launchable = chosen?.current_version ? chosen : null;

  const grouped = publishedSections(launchable?.published_sections).map((s, i) => ({
    id: `${i}-${s.name}`,
    name: s.name,
    tasks: s.tasks.map((t) => ({ id: t.id, name: t.name, required: t.required })),
  }));

  return (
    <AppShell
      email={email}
      role={role}
      crumbs={[{ label: "Templates", href: "/templates" }, { label: launchable?.name ?? "Template" }]}
    >
      <PageHeader
        title={`Launch “${launchable?.name ?? "template"}”`}
        description={
          launchable ? `${versionLabel(launchable.current_version!)} · Name the case and choose who does each task.` : undefined
        }
      />
      {launchable ? (
        <LaunchForm templateId={templateId} sections={grouped} people={people} meId={claims.sub} />
      ) : (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">Template not found</AlertDescription>
        </Alert>
      )}
    </AppShell>
  );
}
