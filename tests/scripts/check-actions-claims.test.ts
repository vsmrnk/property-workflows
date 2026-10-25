import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runScript } from "./run-script";

// Кожен випадок — тимчасовий проєкт із файлами src/…; скрипт перевіряє його як корінь.
const temps: string[] = [];

function project(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "actions-claims-"));
  temps.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

const guarded = `"use server";
export async function save(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Sign in again" };
  return {};
}
`;

describe("check-actions-claims", () => {
  it("OK: кожна дія викликає getClaims, getSession лише в коментарі, дія входу — виняток", () => {
    const dir = project({
      "src/app/runs/actions.ts": guarded,
      "src/app/login/actions.ts": `"use server";\nexport async function login() { return signInWithPassword(); }\n`,
      "src/app/page.tsx": "// getSession() для авторизації не використовуємо\nexport default function P() { return null; }\n",
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("OK — 1 дій");
  });

  it("Server Action без getClaims — порушення з назвою дії й рядком", () => {
    const dir = project({
      "src/app/runs/actions.ts": `"use server";\n\nexport async function launch() {\n  return supabase.rpc("launch_run");\n}\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/app/runs/actions.ts:3  launch: Server Action без supabase.auth.getClaims()");
  });

  it("перевіряє кожну дію окремо: одна з двох без getClaims", () => {
    const dir = project({
      "src/app/x/actions.ts": `${guarded}\nexport const remove = async (id: string) => {\n  return db.delete(id);\n};\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("remove: Server Action");
    expect(r.out).not.toContain("save:");
  });

  it("стрілкова дія з типом результату без getClaims — порушення (раніше її не було видно)", () => {
    const dir = project({
      "src/app/x/actions.ts": `"use server";\nexport const save = async (id: string): Promise<{ error?: string }> => {\n  return db.save(id);\n};\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("save: Server Action без supabase.auth.getClaims()");
  });

  it("getClaims у сусідній неекспортованій функції не захищає незахищену дію", () => {
    const dir = project({
      "src/app/x/actions.ts": `"use server";\nexport async function launch() {\n  return db.launch();\n}\n\nasync function helper() {\n  const supabase = await createClient();\n  return supabase.auth.getClaims();\n}\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("launch: Server Action без supabase.auth.getClaims()");
  });

  it("getClaims лише в рядковому літералі — не виклик, порушення", () => {
    const dir = project({
      "src/app/x/actions.ts": `"use server";\nexport async function launch() {\n  const hint = "call supabase.auth.getClaims() first";\n  return db.launch(hint);\n}\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("launch: Server Action без supabase.auth.getClaims()");
  });

  it("функції, експортовані окремим списком (export { POST }, export { save as act }), теж перевіряються", () => {
    const dir = project({
      "src/app/api/runs/route.ts": "async function POST() {\n  return Response.json(await db.list());\n}\nexport { POST };\n",
      "src/app/x/actions.ts": `"use server";\nconst save = async (id: string) => db.save(id);\nasync function guarded() {\n  const supabase = await createClient();\n  await supabase.auth.getClaims();\n}\nexport { save as act, guarded };\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("POST: Route Handler без supabase.auth.getClaims()");
    expect(r.out).toContain("act: Server Action без supabase.auth.getClaims()");
    expect(r.out).not.toContain("guarded:");
  });

  it("ім'я з $ і оголошення з анотацією типу теж перевіряються (export { $save }, const typed: Action = …)", () => {
    const dir = project({
      "src/app/x/actions.ts": `"use server";\nconst $save = async () => db.save();\nconst typed: Action = async (id: string) => {\n  return db.save(id);\n};\nexport { $save, typed };\nexport const inline: Action = async () => db.save();\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("$save: Server Action без supabase.auth.getClaims()");
    expect(r.out).toContain("typed: Server Action без supabase.auth.getClaims()");
    expect(r.out).toContain("inline: Server Action без supabase.auth.getClaims()");
  });

  it("анотація типу зі стрілкою (const save: (id: string) => Promise<void> = async …) не ховає дію", () => {
    const dir = project({
      "src/app/x/actions.ts": `"use server";\nexport const inline: (id: string) => Promise<void> = async (id) => {\n  await db.save(id);\n};\nconst listed: (id: string) => Promise<void> = async (id) => {\n  await db.save(id);\n};\nexport { listed };\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("inline: Server Action без supabase.auth.getClaims()");
    expect(r.out).toContain("listed: Server Action без supabase.auth.getClaims()");
  });

  it("getSession() у виразі \${…} шаблонного рядка — порушення; текст шаблону — не виклик", () => {
    const dir = project({
      "src/app/x/actions.ts":
        '"use server";\nexport async function save() {\n  const supabase = await createClient();\n  await supabase.auth.getClaims();\n  const label = `${({ a: 1 }).a ? await supabase.auth.getSession() : ""} getClaims() in text`;\n  return label;\n}\n',
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("getSession() — не перевіряє підпис JWT");
    expect(r.out).not.toContain("save: Server Action");
  });

  it("регулярний вираз з лапкою не ховає getSession() далі в рядку", () => {
    const dir = project({
      "src/app/x/actions.ts": `"use server";\nexport async function save() {\n  const supabase = await createClient();\n  await supabase.auth.getClaims();\n  const pattern = /'/; await supabase.auth.getSession();\n  return pattern;\n}\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/app/x/actions.ts:5  getSession() — не перевіряє підпис JWT");
  });

  it("тип результату з фігурними дужками в анотації (const save: (id) => { ok: boolean } = …) не плутається з тілом", () => {
    const dir = project({
      "src/app/x/actions.ts": `"use server";\nexport const save: (id: string) => { ok: boolean } = async (id) => {\n  const supabase = await createClient();\n  await supabase.auth.getClaims();\n  return { ok: true };\n};\nconst listed: (id: string) => { ok: boolean } = async (id) => {\n  const supabase = await createClient();\n  await supabase.auth.getClaims();\n  return { ok: true };\n};\nexport { listed };\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("OK — 2 дій");
  });

  it("export default async function і export default <ім'я> теж перевіряються", () => {
    const dir = project({
      "src/app/a/actions.ts": `"use server";\nexport default async function () {\n  return db.save();\n}\n`,
      "src/app/b/actions.ts": `"use server";\nconst save = async () => db.save();\nexport default save;\n`,
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/app/a/actions.ts:2  default: Server Action");
    expect(r.out).toContain("src/app/b/actions.ts:2  default: Server Action");
  });

  it("Route Handler без getClaims і getSession у коді — порушення", () => {
    const dir = project({
      "src/app/api/runs/route.ts": "export async function GET() {\n  const s = await supabase.auth.getSession();\n  return Response.json(s);\n}\n",
    });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("getSession() — не перевіряє підпис JWT");
    expect(r.out).toContain("GET: Route Handler без supabase.auth.getClaims()");
  });

  it("middleware.ts — порушення", () => {
    const dir = project({ "src/middleware.ts": "export function middleware() {}\n", "src/app/page.tsx": "export default 1;\n" });
    const r = runScript("check-actions-claims.mjs", dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/middleware.ts:1  middleware.ts");
  });

  it("немає ні src/, ні app/ — код 2", () => {
    const r = runScript("check-actions-claims.mjs", project({ "README.md": "" }));
    expect(r.code).toBe(2);
  });
});
