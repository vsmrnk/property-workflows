// AC-EDITOR-11…29 (уточнення зрізу 2, impl-template-versions-2 D1–D7): назва належить версії, перевірки збереження,
// назва шаблону в рані, прямі запити — від імені конкретних користувачів, під RLS і GRANT зі справжніх міграцій.
// Відмовні AC перевіряють і відмову, і те, що дані не змінились (asService).
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let adminA: string;
let managerA: string;
let managerB: string;

type Section = { name: string; tasks: { name: string; required: boolean }[] };

const MOVE_IN: Section[] = [
  {
    name: "Before move-in",
    tasks: [
      { name: "Inspect the unit", required: true },
      { name: "Prepare the lease", required: true },
    ],
  },
  {
    name: "Move-in day",
    tasks: [
      { name: "Hand over the keys", required: true },
      { name: "Record meter readings", required: false },
      { name: "Order cleaning", required: false },
    ],
  },
];

async function createTemplate(name: string, sections: Section[]) {
  const [{ id }] = await t.asUser<{ id: string }>(adminA, "insert into public.templates (name) values ($1) returning id", [name]);
  const sectionIds: string[] = [];
  for (const [si, s] of sections.entries()) {
    const [{ id: sid }] = await t.asUser<{ id: string }>(
      adminA,
      "insert into public.template_sections (template_id, name, position) values ($1, $2, $3) returning id",
      [id, s.name, si + 1],
    );
    sectionIds.push(sid);
    for (const [ti, task] of s.tasks.entries()) {
      await t.asUser(
        adminA,
        "insert into public.template_tasks (template_id, section_id, name, required, position) values ($1, $2, $3, $4, $5)",
        [id, sid, task.name, task.required, ti + 1],
      );
    }
  }
  return { id, sectionIds };
}

const save = (userId: string, templateId: string) =>
  t.asUser<{ n: number }>(userId, "select public.save_template_version($1) as n", [templateId]).then((r) => r[0].n);

const launch = (userId: string, templateId: string, caseName: string) =>
  t
    .asUser<{ run: string }>(userId, "select public.launch_run($1, $2, '{}') as run", [templateId, caseName])
    .then((r) => r[0].run);

const rename = (templateId: string, name: string) =>
  t.asUser(
    adminA,
    "insert into public.template_drafts (template_id, name) values ($1, $2) on conflict (template_id) do update set name = excluded.name",
    [templateId, name],
  );

const state = (id: string) =>
  t
    .asService<{ name: string; current_version: number | null; has_unpublished_changes: boolean; versions: number }>(
      `select tp.name, tp.current_version, tp.has_unpublished_changes,
              (select count(*)::int from public.template_versions as v where v.template_id = tp.id) as versions
       from public.templates as tp where tp.id = $1`,
      [id],
    )
    .then((r) => r[0]);

const count = (sql: string, params: unknown[]) =>
  t.asService<{ n: number }>(sql, params).then((r) => r[0].n);

const publishedSectionSizes = (id: string) =>
  t
    .asService<{ published_sections: { name: string; tasks: unknown[] }[] }>(
      "select published_sections from public.templates where id = $1",
      [id],
    )
    .then((r) => r[0].published_sections.map((s) => [s.name, s.tasks.length]));

beforeAll(async () => {
  t = await createTestDb();
  adminA = t.users["admin@example.test"];
  managerA = t.users["manager-a@example.test"];
  managerB = t.users["manager-b@example.test"];
});

describe("template-versions (уточнення)", () => {
  it("AC-EDITOR-11: запуск шаблону без версії напряму — рану не створено, список ранів не змінився", async () => {
    const { id } = await createTemplate("Repair 11", [{ name: "Repair", tasks: [{ name: "Fix", required: true }] }]);
    const before = await count("select count(*)::int as n from public.runs", []);

    await expect(launch(adminA, id, "Apartment 5, repair")).rejects.toThrow(/TEMPLATE_NOT_FOUND/);
    expect(await count("select count(*)::int as n from public.runs", [])).toBe(before);
  });

  it("AC-EDITOR-12: збереження без незбережених змін — версії 3 немає, поточна лишається 2", async () => {
    const { id, sectionIds } = await createTemplate("Tenant move-in 12", MOVE_IN);
    await save(adminA, id);
    await t.asUser(adminA, "update public.template_tasks set required = true where section_id = $1", [sectionIds[1]]);
    await save(adminA, id);

    await expect(save(adminA, id)).rejects.toThrow(/NO_CHANGES/);
    const after = await state(id);
    expect(after.current_version).toBe(2);
    expect(after.versions).toBe(2);
  });

  it("AC-EDITOR-14: підтверджене видалення секції «Move-in day» — немає в незбережених змінах, версія 1 з 2 секціями й 5 задачами", async () => {
    const { id, sectionIds } = await createTemplate("Tenant move-in 14", MOVE_IN);
    await save(adminA, id);

    await t.asUser(adminA, "delete from public.template_sections where id = $1 and template_id = $2", [sectionIds[1], id]);
    expect(await count("select count(*)::int as n from public.template_sections where template_id = $1", [id])).toBe(1);
    expect(await count("select count(*)::int as n from public.template_tasks where template_id = $1", [id])).toBe(2);
    expect(await publishedSectionSizes(id)).toEqual([
      ["Before move-in", 2],
      ["Move-in day", 3],
    ]);
    expect((await state(id)).has_unpublished_changes).toBe(true);
  });

  it("AC-EDITOR-15: третя секція «After move-in» без задач — EMPTY_SECTION, версії 2 немає, незбережені зміни лишаються", async () => {
    const { id } = await createTemplate("Tenant move-in 15", MOVE_IN);
    await save(adminA, id);
    await t.asUser(adminA, "insert into public.template_sections (template_id, name, position) values ($1, 'After move-in', 3)", [id]);

    await expect(save(adminA, id)).rejects.toThrow(/EMPTY_SECTION/);
    const after = await state(id);
    expect(after.current_version).toBe(1);
    expect(after.versions).toBe(1);
    expect(after.has_unpublished_changes).toBe(true);
    expect(await count("select count(*)::int as n from public.template_sections where template_id = $1", [id])).toBe(3);
  });

  it("AC-EDITOR-20: задача з назвою лише з пробілів — NO_NAME, версії 2 немає, незбережені зміни лишаються", async () => {
    const { id, sectionIds } = await createTemplate("Tenant move-in 20", MOVE_IN);
    await save(adminA, id);
    // Очищена назва лишається в робочій копії (D5) — її відхиляє збереження.
    await t.asUser(adminA, "update public.template_tasks set name = '   ' where section_id = $1 and position = 1", [sectionIds[0]]);

    await expect(save(adminA, id)).rejects.toThrow(/NO_NAME/);
    const after = await state(id);
    expect(after.current_version).toBe(1);
    expect(after.has_unpublished_changes).toBe(true);
    expect(await count("select count(*)::int as n from public.template_tasks where template_id = $1 and btrim(name) = ''", [id])).toBe(1);
  });

  it("AC-EDITOR-21: перейменування на «Tenant move-in (2026)» діє з версією 2; до збереження менеджер бачить стару назву", async () => {
    const { id } = await createTemplate("Tenant move-in 21", MOVE_IN);
    await save(adminA, id);
    await rename(id, "Tenant move-in (2026) 21");

    const [before] = await t.asUser<{ name: string }>(managerB, "select name from public.templates where id = $1", [id]);
    expect(before.name).toBe("Tenant move-in 21");
    expect((await state(id)).has_unpublished_changes).toBe(true);

    expect(await save(adminA, id)).toBe(2);
    const [after] = await t.asUser<{ name: string }>(managerB, "select name from public.templates where id = $1", [id]);
    expect(after.name).toBe("Tenant move-in (2026) 21");
    const [v2] = await t.asService<{ name: string }>("select name from public.template_versions where template_id = $1 and number = 2", [id]);
    expect(v2.name).toBe("Tenant move-in (2026) 21");
    expect(await count("select count(*)::int as n from public.template_drafts where template_id = $1", [id])).toBe(0);
  });

  it("AC-EDITOR-22: ран з версії 1 показує «Tenant move-in», ран з версії 2 — «Tenant move-in (2026)»", async () => {
    const { id } = await createTemplate("Tenant move-in 22", MOVE_IN);
    await save(adminA, id);
    const run1 = await launch(managerB, id, "Apartment 12, move-in");
    await rename(id, "Tenant move-in (2026) 22");
    await save(adminA, id);
    const run2 = await launch(managerB, id, "Apartment 14, move-in");

    const rows = await t.asUser<{ id: string; template_name: string; template_version: number }>(
      managerB,
      "select id, template_name, template_version from public.runs where id = any($1)",
      [[run1, run2]],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, [r.template_name, r.template_version]]));
    expect(byId[run1]).toEqual(["Tenant move-in 22", 1]);
    expect(byId[run2]).toEqual(["Tenant move-in (2026) 22", 2]);
  });

  it("AC-EDITOR-23: новий шаблон « tenant MOVE-IN 23 » при наявному «Tenant move-in 23» — не створено (унікальна назва)", async () => {
    await createTemplate("Tenant move-in 23", MOVE_IN);
    const before = await count("select count(*)::int as n from public.templates", []);

    await expect(
      t.asUser(adminA, "insert into public.templates (name) values ($1)", [" tenant MOVE-IN 23 "]),
    ).rejects.toThrow(/duplicate key|unique/);
    expect(await count("select count(*)::int as n from public.templates", [])).toBe(before);
  });

  it("AC-EDITOR-24: перейменування «Repair» на наявну назву — DUPLICATE_NAME, версії немає, незбережені зміни лишаються", async () => {
    await createTemplate("Tenant move-in 24", MOVE_IN);
    const { id } = await createTemplate("Repair 24", [{ name: "Repair", tasks: [{ name: "Fix", required: true }] }]);
    await save(adminA, id);
    await rename(id, "Tenant move-in 24");

    await expect(save(adminA, id)).rejects.toThrow(/DUPLICATE_NAME/);
    const after = await state(id);
    expect(after.name).toBe("Repair 24");
    expect(after.versions).toBe(1);
    expect(after.has_unpublished_changes).toBe(true);
    expect(await count("select count(*)::int as n from public.template_drafts where template_id = $1", [id])).toBe(1);
  });

  it("AC-EDITOR-26: відвідувач без входу напряму не змінює шаблон і не зберігає версію — версія 1, 5 задач, без змін", async () => {
    const { id, sectionIds } = await createTemplate("Tenant move-in 26", MOVE_IN);
    await save(adminA, id);

    await expect(t.asAnon("update public.template_tasks set name = 'Hacked' where template_id = $1", [id])).rejects.toThrow(/permission denied/);
    await expect(
      t.asAnon("insert into public.template_tasks (template_id, section_id, name, required, position) values ($1, $2, 'x', true, 9)", [
        id,
        sectionIds[0],
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("insert into public.template_drafts (template_id, name) values ($1, 'Hacked')", [id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(t.asAnon("select public.save_template_version($1)", [id])).rejects.toThrow(/permission denied/);

    const after = await state(id);
    expect(after.current_version).toBe(1);
    expect(after.has_unpublished_changes).toBe(false);
    expect(await count("select count(*)::int as n from public.template_tasks where template_id = $1", [id])).toBe(5);
  });

  it("AC-EDITOR-28: задача з «Move-in day» перенесена в «Before move-in» — нова версія: «Before move-in» — 3 задачі, «Move-in day» — 2", async () => {
    const { id, sectionIds } = await createTemplate("Tenant move-in 28", MOVE_IN);
    await save(adminA, id);

    await t.asUser(
      adminA,
      "update public.template_tasks set section_id = $1, position = 3 where section_id = $2 and position = 3",
      [sectionIds[0], sectionIds[1]],
    );
    expect(await save(adminA, id)).toBe(2);
    expect(await publishedSectionSizes(id)).toEqual([
      ["Before move-in", 3],
      ["Move-in day", 2],
    ]);
  });

  it("AC-EDITOR-29: менеджер напряму отримує лише поточну версію 2 — без версії 1, списку версій і незбережених змін (7 задач)", async () => {
    const { id, sectionIds } = await createTemplate("Tenant move-in 29", MOVE_IN);
    await save(adminA, id);
    await t.asUser(adminA, "update public.template_tasks set required = true where section_id = $1", [sectionIds[1]]);
    await save(adminA, id);
    for (const name of ["Sign handover act", "Check smoke alarms"]) {
      await t.asUser(
        adminA,
        "insert into public.template_tasks (template_id, section_id, name, required, position) values ($1, $2, $3, false, 9)",
        [id, sectionIds[1], name],
      );
    }
    await rename(id, "Tenant move-in draft 29");

    expect(await t.asUser(managerA, "select number from public.template_versions where template_id = $1", [id])).toHaveLength(0);
    expect(await t.asUser(managerA, "select id from public.template_tasks where template_id = $1", [id])).toHaveLength(0);
    expect(await t.asUser(managerA, "select id from public.template_sections where template_id = $1", [id])).toHaveLength(0);
    expect(await t.asUser(managerA, "select name from public.template_drafts where template_id = $1", [id])).toHaveLength(0);
    const [visible] = await t.asUser<{ name: string; current_version: number; published_sections: { tasks: unknown[] }[] }>(
      managerA,
      "select name, current_version, published_sections from public.templates where id = $1",
      [id],
    );
    expect(visible.name).toBe("Tenant move-in 29");
    expect(visible.current_version).toBe(2);
    expect(visible.published_sections.reduce((n, s) => n + s.tasks.length, 0)).toBe(5);

    const after = await state(id);
    expect(after.current_version).toBe(2);
    expect(after.has_unpublished_changes).toBe(true);
    expect(await count("select count(*)::int as n from public.template_tasks where template_id = $1", [id])).toBe(7);
  });
});
