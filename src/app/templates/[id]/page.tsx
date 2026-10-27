import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentUser } from "@/lib/auth/require-role";
import { TEMPLATE_NOT_FOUND, publishedSections, taskSummary, versionLabel } from "@/lib/templates/format";
import { AppShell, BackLink, Card, PageHeader, RequirementTag } from "../../_components/ui";

// Сторінка шаблону для менеджера (impl-template-versions-2 U1): лише читання поточної версії — назва, «Version N»,
// секції із задачами й позначкою «required»/«optional», посилання «Launch» (AC-EDITOR-02). Дані — лише
// templates.published_sections. Шаблон без версії RLS менеджеру не віддає — «Template not found» (AC-EDITOR-16).
// Адміністратор працює з шаблоном у редакторі.
export default async function TemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (user.role === "admin") redirect(`/templates/${id}/edit`);

  const { data: template } = await supabase
    .from("templates")
    .select("id, name, current_version, published_sections")
    .eq("id", id)
    .maybeSingle();

  if (!template?.current_version) {
    return (
      <AppShell email={user.email} role={user.role} crumbs={[{ label: "Templates", href: "/templates" }, { label: "Not found" }]}>
        <BackLink href="/templates">Templates</BackLink>
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <h1 className="text-title font-semibold" data-testid="template-not-found">
            {TEMPLATE_NOT_FOUND}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">The link may be wrong, or the template is not available yet.</p>
        </Card>
      </AppShell>
    );
  }

  const sections = publishedSections(template.published_sections);
  const tasks = sections.flatMap((s) => s.tasks);

  return (
    <AppShell email={user.email} role={user.role} crumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }]}>
      <PageHeader
        title={template.name}
        titleTestId="template-name"
        description={
          <span className="tabular-nums" data-testid="template-version">
            {versionLabel(template.current_version)} · {taskSummary(tasks.length, tasks.filter((t) => t.required).length)}
          </span>
        }
        actions={
          <Link href={`/runs/new?template=${template.id}`} className={buttonVariants()}>
            Launch<span className="sr-only"> “{template.name}”</span>
          </Link>
        }
      />
      {sections.map((section) => (
        <Card key={section.position} data-testid="template-section">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">{section.name}</h2>
          </div>
          <Table>
            <TableHeader className="sr-only">
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.tasks.map((task) => (
                <TableRow key={task.id} data-testid="template-task">
                  <TableCell className="pl-5 font-medium">{task.name}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <RequirementTag required={task.required} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </AppShell>
  );
}
