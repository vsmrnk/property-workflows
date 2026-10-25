import { createClient } from "@/lib/supabase/server";

export type AppRole = "manager" | "admin";

/**
 * Хто користувач і яка в нього роль: getClaims() перевіряє підпис JWT, роль — з public.profiles (RLS: свій профіль),
 * ніколи з user_metadata (ADR 0002). Для сторінок — щоб показати відмову; дані однаково захищає RLS.
 */
export async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return { supabase, user: null } as const;
  const { data: profile } = await supabase.from("profiles").select("email, role").eq("id", claims.sub).maybeSingle();
  return {
    supabase,
    user: {
      id: claims.sub,
      email: profile?.email ?? (typeof claims.email === "string" ? claims.email : "—"),
      role: (profile?.role ?? null) as AppRole | null,
    },
  } as const;
}
