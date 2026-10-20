import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Person = { id: string; email: string };

/**
 * Менеджери й адміністратори для вибору й показу виконавця — лише email
 * (відповідь PM на Q3, https://github.com/solomchaak/property-workflows-spec/issues/5; AC-RUN-10, AC-TASK-11).
 */
export async function loadPeople(supabase: Client): Promise<Person[]> {
  const { data } = await supabase.rpc("list_assignable_users");
  return (data ?? []).map((p) => ({ id: p.id, email: p.email ?? "—" }));
}

/** Email користувача за id (AC-TASK-11): без імен і ролей. */
export function emailOf(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.email ?? "—";
}
