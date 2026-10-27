"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

// Вхід email + пароль. Реєстрації в шаблоні немає: користувачів створює
// scripts/create-demo-users.mjs (Admin API), бо вбудований SMTP Supabase
// надсилає лише 2 листи/год і лише членам команди проєкту.
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  // Помилка входу лишає next, щоб друга спроба теж повернула на сторінку з посилання.
  const retry = (error: string) => `/login?error=${error}${next === "/" ? "" : `&next=${encodeURIComponent(next)}`}`;

  if (!email || !password) {
    redirect(retry("missing"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Не показуємо текст помилки Auth: він може підказати, чи існує email.
    redirect(retry("invalid"));
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
