import { redirect } from "next/navigation";
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

type Supabase = Awaited<ReturnType<typeof createClient>>;
type ClaimsResult = Awaited<ReturnType<Supabase["auth"]["getClaims"]>>;

/**
 * Перевірка ролі в Server Action редактора (ADR 0002, design.md impl-template-versions A2): дія сама викликає
 * supabase.auth.getClaims() і передає результат сюди; роль — з public.profiles. Повертає текст відмови або null.
 * Перевірка йде ДО будь-якого запису; запис однаково обмежують RLS і GRANT (лише admin).
 */
export async function denyUnlessAdmin(supabase: Supabase, claimsResult: ClaimsResult): Promise<string | null> {
  const sub = claimsResult.data?.claims?.sub;
  // Без входу — на сторінку входу, нічого не записано (AC-EDITOR-26).
  if (!sub) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", sub).maybeSingle();
  return profile?.role === "admin" ? null : "Not enough rights";
}
