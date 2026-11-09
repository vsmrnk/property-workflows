// Синтетичні дані UAT зрізу 3 (вендор, AC-VENDOR-01…10) на проді: користувачі uat-<run>-…@example.test і їхні рани.
// Створює їх проєкт setup (auth.setup.ts) — без відео й trace: тут паролі. Специфікація читає готові дані з файлу
// playwright/.auth/uat-vendor.json (тека в .gitignore) і входить через збережений стан сесії.
// Прямі запити «оминаючи сторінки» (AC-VENDOR-07, AC-VENDOR-09) — supabase-js у Node з публічним ключем і паролем
// синтетичного вендора: це не виклики Playwright, тож ні пароль, ні токен не потрапляють у trace.
// Прибирання — deleteUatUsers (support/admin.ts, OWNED_ROWS: рани менеджера й задачі виконавця).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, randomPassword, uatEmail } from "./admin";

export const VENDOR_DATA_FILE = "playwright/.auth/uat-vendor.json";
export const stateOf = (key: UatKey) => `playwright/.auth/uat-${key}.json`;

/** manager-a — менеджер A; vendor-v — вендор V з AC; vendor-x — V для запуску (AC-01, 02); vendor-y — V для позначки
 * (AC-05); vendor-w — вендор без задач (AC-10). Окремі вендори — щоб «Тоді» одного AC не залежало від іншого. */
export type UatKey = "manager-a" | "vendor-v" | "vendor-x" | "vendor-y" | "vendor-w";
export type UatUser = { key: UatKey; email: string; password: string; id: string; role: "manager" | "vendor" };
export type TemplateTask = { id: string; name: string; required: boolean; section: string };
export type VendorData = {
  users: Record<UatKey, UatUser>;
  template: { id: string; name: string; version: number; tasks: TemplateTask[] };
  /** «Apartment 12, move-in»: задачі 3 і 4 — vendor-v; «Apartment 14, repair» — без вендора; ран vendor-y. */
  runs: { run12: string; run14: string; run12y: string };
};

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Для UAT зрізу 3 потрібна змінна ${name} (.env.local)`);
  return value;
};

/** Синтетичний користувач із роллю: Auth → тригер профілю → роль ставить service_role (як npm run users:demo). */
export async function createUatUser(key: UatKey, role: UatUser["role"]): Promise<UatUser> {
  const admin = adminClient();
  const email = uatEmail(key);
  const password = randomPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", data.user.id);
  if (roleError) throw roleError;
  return { key, email, password, id: data.user.id, role };
}

/** Клієнт від імені користувача — як застосунок у браузері (публічний ключ, RLS), але з Node. */
export async function apiAs(user: UatUser): Promise<SupabaseClient> {
  const client = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`вхід ${user.email} через API не вдався: ${error.message}`);
  return client;
}

/** Поточна версія шаблону очима менеджера: задачі в порядку секцій і задач (задача 3 — третя в цьому списку). */
export async function templateAsManager(manager: SupabaseClient, name: string): Promise<VendorData["template"]> {
  const { data, error } = await manager
    .from("templates")
    .select("id, name, current_version, published_sections")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data?.current_version) throw new Error(`на проді немає збереженого шаблону «${name}»`);
  type Section = { name: string; position: number; tasks: { id: string; name: string; required: boolean; position: number }[] };
  const sections = [...((data.published_sections ?? []) as Section[])].sort((a, b) => a.position - b.position);
  const tasks = sections.flatMap((s) =>
    [...s.tasks].sort((a, b) => a.position - b.position).map((t) => ({ id: t.id, name: t.name, required: t.required, section: s.name })),
  );
  return { id: data.id, name: data.name, version: data.current_version, tasks };
}

export async function launchAs(
  client: SupabaseClient,
  templateId: string,
  caseName: string,
  assignments: Record<string, string> = {},
): Promise<string> {
  const { data, error } = await client.rpc("launch_run", { p_template_id: templateId, p_case_name: caseName, p_assignments: assignments });
  if (error || !data) throw new Error(`launch_run «${caseName}»: ${error?.message ?? "немає id"}`);
  return data as string;
}

export function saveVendorData(data: VendorData) {
  mkdirSync("playwright/.auth", { recursive: true });
  writeFileSync(VENDOR_DATA_FILE, JSON.stringify(data, null, 2));
}

export function vendorData(): VendorData {
  if (!existsSync(VENDOR_DATA_FILE)) {
    throw new Error(`Немає ${VENDOR_DATA_FILE}: дані зрізу 3 створює проєкт setup, лише з SUPABASE_SECRET_KEY у .env.local`);
  }
  return JSON.parse(readFileSync(VENDOR_DATA_FILE, "utf8")) as VendorData;
}
