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
