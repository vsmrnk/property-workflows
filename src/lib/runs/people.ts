import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Person = { id: string; label: string };

/**
 * Менеджери й адміністратори для вибору й показу виконавця: лише ім'я та email
 * (design.md impl-run-launch, D8 — тимчасово до відповіді PM на Q3, solomchaak/property-workflows-spec#5).
 */
export async function loadPeople(supabase: Client): Promise<Person[]> {
  const { data } = await supabase.rpc("list_assignable_users");
  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ? `${p.full_name} (${p.email ?? "—"})` : (p.email ?? p.id),
  }));
}

export function nameOf(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.label ?? "—";
}
