import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { currentUser } from "@/lib/auth/require-role";
import { UNPUBLISHED_CHANGES, versionLabel } from "@/lib/templates/format";
import { AccessDenied, AppShell, PageHeader } from "../../../_components/ui";
import { Editor } from "./editor";
import { SaveVersion } from "./save-version";

// Редактор шаблону (design.md impl-template-versions, U3, U5): робоча копія (незбережені зміни) — лише для
// адміністратора. Менеджер за прямим посиланням бачить «Not enough rights» і «Back to templates» у тому самому каркасі,
// без вмісту редактора (AC-DSYS-02): сторінка не робить для нього запитів до шаблону.
export default async function EditTemplatePage({ params }: PageProps<"/templates/[id]/edit">) {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");

  if (user.role !== "admin") {
    return (
      <AppShell email={user.email} role={user.role} crumbs={[{ label: "Templates", href: "/templates" }, { label: "Edit" }]}>
        <AccessDenied />
      </AppShell>
    );
  }

  const { id } = await params;
  const [{ data: template }, { data: sections }, { data: tasks }] = await Promise.all([
    supabase.from("templates").select("id, name, current_version, has_unpublished_changes").eq("id", id).maybeSingle(),
    supabase.from("template_sections").select("id, name, position").eq("template_id", id).order("position"),
    supabase.from("template_tasks").select("id, section_id, name, required, position").eq("template_id", id).order("position"),
  ]);
  if (!template) notFound();
  const list = sections ?? [];
  const fingerprint = JSON.stringify([list, tasks ?? []]);

  return (
    <AppShell
      email={user.email}
      role={user.role}
      crumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }, { label: "Edit" }]}
    >
      <PageHeader
        title={`Edit “${template.name}”`}
        badge={
          template.has_unpublished_changes ? (
            <Badge variant="draft" data-testid="unpublished">
              {UNPUBLISHED_CHANGES}
            </Badge>
          ) : null
        }
        description={
          template.current_version
            ? `Current version: ${versionLabel(template.current_version)}. Changes are kept automatically; managers see them after you save.`
            : "Not saved yet. Changes are kept automatically; managers see the template after you save it."
        }
        // key — відбиток робочої копії: будь-яка правка монтує «Save» наново й прибирає застаріле повідомлення.
        actions={<SaveVersion key={fingerprint} templateId={template.id} hasChanges={template.has_unpublished_changes} />}
      />

      <Editor templateId={template.id} sections={list} tasks={tasks ?? []} />
    </AppShell>
  );
}
