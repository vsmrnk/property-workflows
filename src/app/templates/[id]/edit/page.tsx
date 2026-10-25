import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentUser } from "@/lib/auth/require-role";
import { UNPUBLISHED_CHANGES, versionLabel } from "@/lib/templates/format";
import { AccessDenied, AppShell, Card, PageHeader, RequirementTag } from "../../../_components/ui";
import {
  addSection,
  addTask,
  moveSection,
  moveTask,
  removeSection,
  removeTask,
  renameSection,
  renameTask,
  setTaskRequired,
} from "./actions";
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
        actions={<SaveVersion templateId={template.id} hasChanges={template.has_unpublished_changes} />}
      />

      {list.map((section, si) => {
        const sectionTasks = (tasks ?? []).filter((t) => t.section_id === section.id);
        return (
          <Card key={section.id}>
            <section aria-label={section.name} data-testid="editor-section">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                <form action={renameSection.bind(null, template.id, section.id)} className="flex min-w-0 flex-1 items-center gap-2">
                  <Label htmlFor={`section-${section.id}`} className="sr-only">
                    Section name
                  </Label>
                  <Input id={`section-${section.id}`} name="name" defaultValue={section.name} className="max-w-sm font-semibold" />
                  <Button type="submit" variant="ghost" size="sm">
                    Rename
                  </Button>
                </form>
                <form action={moveSection.bind(null, template.id, section.id, "up")}>
                  <Button type="submit" variant="ghost" size="sm" disabled={si === 0}>
                    Move up
                  </Button>
                </form>
                <form action={moveSection.bind(null, template.id, section.id, "down")}>
                  <Button type="submit" variant="ghost" size="sm" disabled={si === list.length - 1}>
                    Move down
                  </Button>
                </form>
                <form action={removeSection.bind(null, template.id, section.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Remove section
                  </Button>
                </form>
              </div>
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Task</TableHead>
                    <TableHead className="w-28">Type</TableHead>
                    <TableHead className="w-96 pr-5 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectionTasks.map((task, ti) => (
                    <TableRow key={task.id} data-testid="editor-task">
                      <TableCell className="pl-5">
                        <form action={renameTask.bind(null, template.id, task.id)} className="flex items-center gap-2">
                          <Label htmlFor={`task-${task.id}`} className="sr-only">
                            Task name
                          </Label>
                          <Input id={`task-${task.id}`} name="name" defaultValue={task.name} />
                          <Button type="submit" variant="ghost" size="sm">
                            Rename
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell>
                        <RequirementTag required={task.required} />
                      </TableCell>
                      <TableCell className="pr-5">
                        <span className="flex justify-end gap-1">
                          <form action={setTaskRequired.bind(null, template.id, task.id, !task.required)}>
                            <Button type="submit" variant="outline" size="sm">
                              {task.required ? "Make optional" : "Make required"}
                            </Button>
                          </form>
                          <form action={moveTask.bind(null, template.id, section.id, task.id, "up")}>
                            <Button type="submit" variant="ghost" size="sm" disabled={ti === 0}>
                              Up
                            </Button>
                          </form>
                          <form action={moveTask.bind(null, template.id, section.id, task.id, "down")}>
                            <Button type="submit" variant="ghost" size="sm" disabled={ti === sectionTasks.length - 1}>
                              Down
                            </Button>
                          </form>
                          <form action={removeTask.bind(null, template.id, task.id)}>
                            <Button type="submit" variant="ghost" size="sm">
                              Remove
                            </Button>
                          </form>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <form action={addTask.bind(null, template.id, section.id)} className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3">
                <Label htmlFor={`new-task-${section.id}`} className="sr-only">
                  New task name
                </Label>
                <Input id={`new-task-${section.id}`} name="name" placeholder="New task" className="max-w-sm" required />
                <Label className="flex items-center gap-2 font-normal">
                  <input type="checkbox" name="required" className="size-4 accent-foreground" />
                  Required
                </Label>
                <Button type="submit" variant="secondary" size="sm">
                  Add task
                </Button>
              </form>
            </section>
          </Card>
        );
      })}

      <Card className="p-5">
        <form action={addSection.bind(null, template.id)} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor="new-section">New section</Label>
            <Input id="new-section" name="name" placeholder="Move-in day" required className="max-w-sm" />
          </div>
          <Button type="submit" variant="secondary">
            Add section
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
