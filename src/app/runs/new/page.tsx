import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPeople } from "@/lib/runs/people";
import { createClient } from "@/lib/supabase/server";
import { LaunchForm } from "./launch-form";

// Запуск шаблону для кейсу (openspec/specs/run-launch/spec.md): вибір шаблону → назва кейсу й виконавці задач.
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { template } = await searchParams;
  const templateId = typeof template === "string" ? template : "";

  const { data: templates } = await supabase.from("templates").select("id, name").order("name");

  if (!templateId) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
        <Link href="/" className="text-sm text-zinc-500">
          ← Runs
        </Link>
        <h1 className="text-2xl font-semibold">Launch a template</h1>
        <ul className="flex flex-col gap-2" data-testid="templates">
          {(templates ?? []).map((t) => (
            <li key={t.id}>
              <Link
                href={`/runs/new?template=${t.id}`}
                className="block rounded border border-zinc-300 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </main>
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/runs/new" className="text-sm text-zinc-500">
        ← Templates
      </Link>
      <h1 className="text-2xl font-semibold">Launch “{chosen?.name ?? "template"}”</h1>
      {chosen ? (
        <LaunchForm templateId={templateId} sections={grouped} people={people} meId={claims.sub} />
      ) : (
        <p role="alert" className="text-sm text-red-600">
          Template not found
        </p>
      )}
    </main>
  );
}
