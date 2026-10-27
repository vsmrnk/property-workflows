import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentUser } from "@/lib/auth/require-role";
import { cn } from "@/lib/utils";
import {
  NO_TEMPLATES_ADMIN,
  NO_TEMPLATES_MANAGER,
  UNPUBLISHED_CHANGES,
  publishedSections,
  taskSummary,
  versionLabel,
} from "@/lib/templates/format";
import { AppShell, Card, Icon, PageHeader } from "../_components/ui";

// Список шаблонів (design.md impl-template-versions, U2): адміністратор бачить усі шаблони й позначку
// «Unpublished changes», менеджер — лише збережені шаблони в поточній версії, без позначки (RLS, AC-EDITOR-02).
// Назва для адміністратора — незбережена нова назва, якщо вона є (impl-template-versions-2 D1); менеджер відкриває
// шаблон на сторінці для читання (U1). Порожній список — повідомлення замість таблиці (AC-EDITOR-17, U2).
export default async function TemplatesPage() {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "admin";

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, current_version, has_unpublished_changes, published_sections, template_drafts(name)")
    .order("name");

  return (
    <AppShell email={user.email} role={user.role} crumbs={[{ label: "Templates" }]}>
      <PageHeader
        title="Templates"
        description={isAdmin ? "Edit templates and save them as versions; launch the current version for a case." : "Choose the process to start for a case."}
        actions={
          isAdmin ? (
            <Link href="/templates/new" className={buttonVariants()}>
              <Icon name="plus" />
              New template
            </Link>
          ) : null
        }
      />
      {(templates ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center" data-testid="templates-empty">
          <p className="text-sm text-muted-foreground">{isAdmin ? NO_TEMPLATES_ADMIN : NO_TEMPLATES_MANAGER}</p>
          {isAdmin ? (
            <Link href="/templates/new" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Create a template
            </Link>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Table data-testid="templates">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Template</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Tasks</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(templates ?? []).map((t) => {
                const tasks = publishedSections(t.published_sections).flatMap((s) => s.tasks);
                const name = (isAdmin && t.template_drafts?.name) || t.name;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="pl-5">
                      <span className="flex flex-wrap items-center gap-2.5 font-medium">
                        <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground">
                          <Icon name="list" className="size-4" />
                        </span>
                        {isAdmin ? (
                          name
                        ) : (
                          <Link href={`/templates/${t.id}`} className="underline-offset-4 hover:underline">
                            {name}
                          </Link>
                        )}
                        {isAdmin && t.has_unpublished_changes ? (
                          <Badge variant="draft" data-testid="unpublished">
                            {UNPUBLISHED_CHANGES}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{t.current_version ? versionLabel(t.current_version) : "—"}</TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                      {t.current_version ? taskSummary(tasks.length, tasks.filter((x) => x.required).length) : "—"}
                    </TableCell>
                    <TableCell className="pr-5">
                      <span className="flex justify-end gap-2">
                        {isAdmin ? (
                          <Link href={`/templates/${t.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Edit<span className="sr-only"> “{name}”</span>
                          </Link>
                        ) : null}
                        {isAdmin ? (
                          <Link href={`/templates/${t.id}/versions`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                            Versions<span className="sr-only"> of “{name}”</span>
                          </Link>
                        ) : null}
                        {t.current_version ? (
                          <Link href={`/runs/new?template=${t.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                            Launch<span className="sr-only"> “{name}”</span>
                          </Link>
                        ) : (
                          // Шаблон без версії не запускають; порожнє місце тієї ж ширини тримає Edit і Versions в одну лінію.
                          <span aria-hidden className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "invisible")}>
                            Launch
                          </span>
                        )}
                      </span>
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
