import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadPeople } from "@/lib/runs/people";
import { createClient } from "@/lib/supabase/server";
import { AppShell, Card, Icon, PageHeader } from "../../_components/ui";
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
      <AppShell email={email} role={role} crumbs={[{ label: "Launch a template" }]}>
        <PageHeader title="Launch a template" description="Choose the process to start for a case." />
        {(templates ?? []).length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-muted-foreground">
            No templates yet. An administrator prepares templates before they can be launched.
          </Card>
        ) : (
          <Card>
            <Table data-testid="templates">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Template</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Required</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(templates ?? []).map((t) => {
                  const count = counts.get(t.id) ?? { total: 0, required: 0 };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="pl-5">
                        <span className="flex items-center gap-2.5 font-medium">
                          <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground">
                            <Icon name="list" className="size-4" />
                          </span>
                          {t.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{count.total} tasks</TableCell>
                      <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                        {count.required} required
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Link href={`/runs/new?template=${t.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                          Launch
                          <span className="sr-only"> “{t.name}”</span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
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
    <AppShell
      email={email}
      role={role}
      crumbs={[{ label: "Launch a template", href: "/runs/new" }, { label: chosen?.name ?? "Template" }]}
    >
      <PageHeader title={`Launch “${chosen?.name ?? "template"}”`} description="Name the case and choose who does each task." />
      {chosen ? (
        <LaunchForm templateId={templateId} sections={grouped} people={people} meId={claims.sub} />
      ) : (
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">Template not found</AlertDescription>
        </Alert>
      )}
    </AppShell>
  );
}
