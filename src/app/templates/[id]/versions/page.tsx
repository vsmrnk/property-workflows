import { notFound, redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentUser } from "@/lib/auth/require-role";
import { formatSavedAt, versionLabel } from "@/lib/templates/format";
import { AccessDenied, AppShell, Card, PageHeader } from "../../../_components/ui";

// Список версій шаблону (design.md impl-template-versions, U4, U5): лише адміністратор (AC-EDITOR-05). Менеджер за
// прямим посиланням бачить «Not enough rights» і жодної версії (AC-EDITOR-07) — сторінка не робить для нього запитів
// до версій; дані однаково захищає RLS (template_versions_select_admin).
export default async function TemplateVersionsPage({ params }: PageProps<"/templates/[id]/versions">) {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const crumbs = [{ label: "Templates", href: "/templates" }, { label: "Versions" }];

  if (user.role !== "admin") {
    return (
      <AppShell email={user.email} role={user.role} crumbs={crumbs}>
        <AccessDenied />
      </AppShell>
    );
  }

  const { id } = await params;
  const [{ data: template }, { data: versions }] = await Promise.all([
    supabase.from("templates").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("template_versions")
      .select("number, created_at, author:profiles(email)")
      .eq("template_id", id)
      .order("number", { ascending: false }),
  ]);
  if (!template) notFound();

  return (
    <AppShell email={user.email} role={user.role} crumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }, { label: "Versions" }]}>
      <PageHeader title={`Versions of “${template.name}”`} description="Every saved version, newest first." />
      {(versions ?? []).length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-muted-foreground">
          No versions yet. Save the template to create version 1.
        </Card>
      ) : (
        <Card>
          <Table data-testid="versions">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Version</TableHead>
                <TableHead>Saved</TableHead>
                <TableHead className="pr-5">Saved by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(versions ?? []).map((v) => (
                <TableRow key={v.number} data-testid="version">
                  <TableCell className="pl-5 font-medium tabular-nums">{versionLabel(v.number)}</TableCell>
                  <TableCell className="tabular-nums">{formatSavedAt(v.created_at)}</TableCell>
                  <TableCell className="pr-5 text-muted-foreground">{v.author?.email ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppShell>
  );
}
