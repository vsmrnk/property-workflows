// D0: чи відповіла база на запит /api/health. Чиста функція — щоб перевірити всі гілки тестом без мережі.
// Запит — публічним ключем до таблиці без доступу для anon: «немає прав» (42501) теж означає, що Postgres живий.

/** Код SQLSTATE Postgres, напр. 42501 «permission denied»: запит дійшов до бази. */
const SQLSTATE = /^[0-9A-Z]{5}$/;
/** PostgREST не може під'єднатися до бази. */
const PGRST_DB_DOWN = /^PGRST00[0-3]$/;
/** Supabase відповідає 540, коли безкоштовний проєкт призупинено (Dashboard → Resume project). */
const SUPABASE_PAUSED = 540;

export type DbProbe = { status: number; error: { code?: string; message?: string } | null };
export type DbHealth = { db: "ok" | "down"; reason: string };

export function classifyDbProbe({ status, error }: DbProbe): DbHealth {
  if (status === SUPABASE_PAUSED) return { db: "down", reason: "paused" };
  const code = error?.code ?? "";
  // 0 — мережа, 5xx — збій на боці Supabase (зокрема 53300 «забагато з'єднань», 57P03 «база запускається»):
  // спершу статус, лише потім SQLSTATE — інакше 503 з кодом Postgres виглядав би «живою» базою.
  if (status === 0 || status >= 500) return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
  if (!error || SQLSTATE.test(code) || (code.startsWith("PGRST") && !PGRST_DB_DOWN.test(code))) {
    return { db: "ok", reason: "" };
  }
  if (/api key/i.test(error.message ?? "")) return { db: "down", reason: "invalid-api-key" };
  // PGRST000–003 (PostgREST не під'єднався до бази) та інше.
  return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
}

// WS11 (A): у якому середовищі й на якій базі цей деплой. Обидва значення — не секрети: APP_ENV задаємо у Vercel лише
// для гілки staging (на staging VERCEL_ENV теж «preview»), ref — перший сегмент публічної адреси проєкту Supabase.

/** APP_ENV → коротка мітка середовища (напр. «staging»); без змінної чи з дивним значенням — null. */
export function appEnvOf(value: string | undefined): string | null {
  const v = value?.trim().toLowerCase() ?? "";
  return /^[a-z][a-z0-9-]{0,31}$/.test(v) ? v : null;
}

/** NEXT_PUBLIC_SUPABASE_URL → ref проєкту: https://<ref>.supabase.co → <ref>; інша адреса (локальний стек) — null. */
export function supabaseRefOf(url: string | undefined): string | null {
  try {
    const host = new URL(url ?? "").hostname;
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(host);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
