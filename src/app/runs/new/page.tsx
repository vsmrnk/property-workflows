import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadPeople } from "@/lib/runs/people";
import { createClient } from "@/lib/supabase/server";
import { SAVE_TO_LAUNCH, publishedSections, versionLabel } from "@/lib/templates/format";
import { AppShell, Card, PageHeader } from "../../_components/ui";
import { LaunchForm } from "./launch-form";

// Запуск шаблону для кейсу (openspec/specs/run-launch/spec.md): вибір шаблону → назва кейсу й виконавці задач.
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { template } = await searchParams;
  const templateId = typeof template === "string" ? template : "";
  if (!templateId) return chooseTemplate(claims.sub, claims.email);

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

/**
 * Вибір шаблону у формі запуску. Шаблон без збереженої версії адміністратор бачить недоступним із приміткою «Save the
 * template to launch it» (AC-EDITOR-10, impl-template-versions-2 U3); менеджеру RLS таких шаблонів не віддає.
 */
async function chooseTemplate(userId: string, fallbackEmail: unknown) {
  const supabase = await createClient();
  const [{ data: templates }, { data: me }] = await Promise.all([
    supabase.from("templates").select("id, name, current_version").order("name"),
    supabase.from("profiles").select("email, role").eq("id", userId).maybeSingle(),
  ]);
  const email = me?.email ?? (typeof fallbackEmail === "string" ? fallbackEmail : "—");

  return (
    <AppShell email={email} role={me?.role ?? null} crumbs={[{ label: "Runs", href: "/" }, { label: "Launch a template" }]}>
      <PageHeader title="Launch a template" description="Choose the process to start for a case." />
      <Card>
        <Table data-testid="launch-templates">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Template</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(templates ?? []).map((t) => (
              <TableRow key={t.id} data-testid="launch-template" aria-disabled={t.current_version ? undefined : true}>
                <TableCell className="pl-5 font-medium">
                  {t.name}
                  {t.current_version ? null : (
                    <span className="block text-sm font-normal text-muted-foreground" id={`unavailable-${t.id}`} data-testid="launch-unavailable">
                      {SAVE_TO_LAUNCH}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{t.current_version ? versionLabel(t.current_version) : "—"}</TableCell>
                <TableCell className="pr-5 text-right">
                  {t.current_version ? (
                    <Link href={`/runs/new?template=${t.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Launch<span className="sr-only"> “{t.name}”</span>
                    </Link>
                  ) : (
                    <Button variant="secondary" size="sm" disabled aria-describedby={`unavailable-${t.id}`}>
                      Launch<span className="sr-only"> “{t.name}”</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
