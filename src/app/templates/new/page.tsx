import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/require-role";
import { AccessDenied, AppShell, Card, PageHeader } from "../../_components/ui";
import { CreateTemplateForm } from "./create-form";

// Новий шаблон — лише адміністратор (матриця прав: «Create a template, edit it and save it as a new version»).
export default async function NewTemplatePage() {
  const { user } = await currentUser();
  if (!user) redirect("/login");
  const crumbs = [{ label: "Templates", href: "/templates" }, { label: "New template" }];
  if (user.role !== "admin") {
    return (
      <AppShell email={user.email} role={user.role} crumbs={crumbs}>
        <AccessDenied />
      </AppShell>
    );
  }
  return (
    <AppShell email={user.email} role={user.role} crumbs={crumbs}>
      <PageHeader title="New template" description="Name the template, then add sections and tasks in the editor." />
      <Card className="p-5">
        <CreateTemplateForm />
      </Card>
    </AppShell>
  );
}
