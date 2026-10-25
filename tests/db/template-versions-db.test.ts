// AC-EDITOR-*, AC-DSYS-03: версії шаблонів — від імені конкретних користувачів, під RLS і GRANT зі справжніх міграцій.
// Відмовні AC перевіряють і відмову, і те, що дані не змінились (asService).
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let adminA: string;
let adminC: string;
let managerA: string;
let managerB: string;

type Section = { name: string; tasks: { name: string; required: boolean }[] };
type TemplateRow = { current_version: number | null; has_unpublished_changes: boolean; published_sections: unknown };

const MOVE_IN: Section[] = [
  {
    name: "Before move-in",
    tasks: [
      { name: "Inspect the unit", required: true },
      { name: "Prepare the lease", required: true },
      { name: "Order cleaning", required: false },
    ],
  },
  {
    name: "Move-in day",
    tasks: [
      { name: "Hand over the keys", required: true },
      { name: "Record meter readings", required: false },
    ],
  },
];

/** Адміністратор створює шаблон і його робочу копію (як дії редактора). Повертає id шаблону й id секцій. */
async function createTemplate(admin: string, name: string, sections: Section[]) {
  const [{ id }] = await t.asUser<{ id: string }>(admin, "insert into public.templates (name) values ($1) returning id", [
    name,
  ]);
  const sectionIds: string[] = [];
  for (const [si, s] of sections.entries()) {
    const [{ id: sid }] = await t.asUser<{ id: string }>(
      admin,
      "insert into public.template_sections (template_id, name, position) values ($1, $2, $3) returning id",
      [id, s.name, si + 1],
    );
    sectionIds.push(sid);
    for (const [ti, task] of s.tasks.entries()) {
      await t.asUser(
        admin,
        "insert into public.template_tasks (template_id, section_id, name, required, position) values ($1, $2, $3, $4, $5)",
        [id, sid, task.name, task.required, ti + 1],
      );
    }
  }
  return { id, sectionIds };
}

const save = (userId: string, templateId: string) =>
  t.asUser<{ n: number }>(userId, "select public.save_template_version($1) as n", [templateId]).then((r) => r[0].n);

const template = (id: string) =>
  t
    .asService<TemplateRow>(
      "select current_version, has_unpublished_changes, published_sections from public.templates where id = $1",
      [id],
    )
    .then((r) => r[0]);

const publishedTaskCount = (sections: unknown) =>
  (sections as { tasks: unknown[] }[] | null)?.reduce((n, s) => n + s.tasks.length, 0) ?? 0;

const workingTaskCount = (id: string) =>
  t
    .asService<{ n: number }>("select count(*)::int as n from public.template_tasks where template_id = $1", [id])
    .then((r) => r[0].n);

const versionCount = (id: string) =>
  t
    .asService<{ n: number }>("select count(*)::int as n from public.template_versions where template_id = $1", [id])
    .then((r) => r[0].n);

async function addSixthTask(admin: string, templateId: string, sectionId: string) {
  await t.asUser(
    admin,
    "insert into public.template_tasks (template_id, section_id, name, required, position) values ($1, $2, 'Sign handover act', false, 3)",
    [templateId, sectionId],
  );
}

beforeAll(async () => {
  t = await createTestDb();
  adminA = t.users["admin@example.test"];
  adminC = t.users["pm-admin@example.test"];
  managerA = t.users["manager-a@example.test"];
  managerB = t.users["manager-b@example.test"];
});

describe("template-versions", () => {
  it("AC-EDITOR-02: менеджер бачить версію 1 з 5 задачами, без незбережених змін і без доступу до робочої копії", async () => {
    const { id, sectionIds } = await createTemplate(adminA, "Tenant move-in 02", MOVE_IN);
    await save(adminA, id);
    await addSixthTask(adminA, id, sectionIds[1]);

    const [visible] = await t.asUser<TemplateRow>(
      managerB,
      "select current_version, published_sections from public.templates where id = $1",
      [id],
    );
    expect(visible.current_version).toBe(1);
    expect(publishedTaskCount(visible.published_sections)).toBe(5);
    // Робочої копії (6 задач) менеджер не бачить.
    const working = await t.asUser(managerB, "select id from public.template_tasks where template_id = $1", [id]);
    expect(working).toHaveLength(0);
    expect(await workingTaskCount(id)).toBe(6);
  });

  it("AC-EDITOR-03: збереження незбережених змін (6 задач) з версії 1 — поточна версія 2 з 6 задачами, позначка зникає", async () => {
    const { id, sectionIds } = await createTemplate(adminA, "Tenant move-in 03", MOVE_IN);
    await save(adminA, id);
    await addSixthTask(adminA, id, sectionIds[1]);
    expect((await template(id)).has_unpublished_changes).toBe(true);

    expect(await save(adminA, id)).toBe(2);
    const after = await template(id);
    expect(after.current_version).toBe(2);
    expect(publishedTaskCount(after.published_sections)).toBe(6);
    expect(after.has_unpublished_changes).toBe(false);
    expect(await versionCount(id)).toBe(2);
  });

  it("AC-EDITOR-04: шаблон «Repair» без обов'язкової задачі не зберігається — версії немає, 3 задачі й позначка лишаються", async () => {
    const { id } = await createTemplate(adminA, "Repair 04", [
      {
        name: "Repair",
        tasks: [
          { name: "Diagnose", required: false },
          { name: "Fix", required: false },
          { name: "Check", required: false },
        ],
      },
    ]);

    await expect(save(adminA, id)).rejects.toThrow(/NO_REQUIRED_TASK/);
    expect(await versionCount(id)).toBe(0);
    const after = await template(id);
    expect(after.current_version).toBeNull();
    expect(after.has_unpublished_changes).toBe(true);
    expect(await workingTaskCount(id)).toBe(3);
  });

  it("AC-EDITOR-05: список версій — версія 2 (адміністратор C) першою, версія 1 (адміністратор A) другою, з часом і email", async () => {
    const { id, sectionIds } = await createTemplate(adminA, "Tenant move-in 05", MOVE_IN);
    await save(adminA, id);
    await addSixthTask(adminA, id, sectionIds[1]);
    await save(adminC, id);
    // Час збереження з AC (Київ, EEST = UTC+3): 05.10.2026 09:30 і 12.10.2026 14:05.
    await t.asService("update public.template_versions set created_at = $2 where template_id = $1 and number = 1", [
      id,
      "2026-10-05T06:30:00Z",
    ]);
    await t.asService("update public.template_versions set created_at = $2 where template_id = $1 and number = 2", [
      id,
      "2026-10-12T11:05:00Z",
    ]);

    // Той самий запит, що й сторінка списку версій (адміністратор бачить профілі всіх).
    const rows = await t.asUser<{ number: number; created_at: string; email: string }>(
      adminA,
      `select v.number, v.created_at, p.email
       from public.template_versions as v left join public.profiles as p on p.id = v.created_by
       where v.template_id = $1 order by v.number desc`,
      [id],
    );
    expect(rows.map((r) => [r.number, r.email])).toEqual([
      [2, "pm-admin@example.test"],
      [1, "admin@example.test"],
    ]);
    expect(new Date(rows[0].created_at).toISOString()).toBe("2026-10-12T11:05:00.000Z");
  });

  it("AC-EDITOR-06: ран, запущений з версії 1, після версії 2 лишається «Template version 1» з 5 задачами", async () => {
    const { id, sectionIds } = await createTemplate(adminA, "Tenant move-in 06", MOVE_IN);
    await save(adminA, id);
    const [{ run }] = await t.asUser<{ run: string }>(managerA, "select public.launch_run($1, 'Apartment 12, move-in', '{}') as run", [
      id,
    ]);
    await addSixthTask(adminA, id, sectionIds[1]);
    await save(adminA, id);

    const [r] = await t.asUser<{ template_version: number }>(managerA, "select template_version from public.runs where id = $1", [
      run,
    ]);
    expect(r.template_version).toBe(1);
    const tasks = await t.asUser(managerA, "select id from public.run_tasks where run_id = $1", [run]);
    expect(tasks).toHaveLength(5);
    expect((await template(id)).current_version).toBe(2);
  });

  it("AC-EDITOR-07: менеджер не бачить жодної версії шаблону з версіями 1 і 2", async () => {
    const { id, sectionIds } = await createTemplate(adminA, "Tenant move-in 07", MOVE_IN);
    await save(adminA, id);
    await addSixthTask(adminA, id, sectionIds[1]);
    await save(adminA, id);

    const seen = await t.asUser(managerB, "select number from public.template_versions where template_id = $1", [id]);
    expect(seen).toHaveLength(0);
    expect(await versionCount(id)).toBe(2);
  });

  it("AC-EDITOR-08: менеджер напряму не змінює шаблон і не зберігає версію — версія 1, 5 задач, без незбережених змін", async () => {
    const { id, sectionIds } = await createTemplate(adminA, "Tenant move-in 08", MOVE_IN);
    await save(adminA, id);

    // Зміна робочої копії: рядків не видно (0 оновлено), вставка — відмова RLS.
    const renamed = await t.asUser(managerB, "update public.template_tasks set name = 'Hacked' where template_id = $1 returning id", [
      id,
    ]);
    expect(renamed).toHaveLength(0);
    await expect(addSixthTask(managerB, id, sectionIds[1])).rejects.toThrow(/row-level security/);
    // Поточна версія й знімок — лише функцією.
    await expect(
      t.asUser(managerB, "update public.templates set current_version = 9 where id = $1", [id]),
    ).rejects.toThrow(/permission denied/);
    await expect(save(managerB, id)).rejects.toThrow(/NOT_ALLOWED/);

    const after = await template(id);
    expect(after.current_version).toBe(1);
    expect(publishedTaskCount(after.published_sections)).toBe(5);
    expect(after.has_unpublished_changes).toBe(false);
    expect(await workingTaskCount(id)).toBe(5);
    expect(await versionCount(id)).toBe(1);
  });

  it("AC-EDITOR-09: відвідувач без входу не отримує жодного вмісту шаблону й не зберігає версію", async () => {
    const { id } = await createTemplate(adminA, "Tenant move-in 09", MOVE_IN);
    await save(adminA, id);

    for (const table of ["templates", "template_sections", "template_tasks", "template_versions"]) {
      await expect(t.asAnon(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
    await expect(t.asAnon("select public.save_template_version($1)", [id])).rejects.toThrow(/permission denied/);
    expect(await versionCount(id)).toBe(1);
  });
});

describe("design-system", () => {
  it("AC-DSYS-03: відвідувач без входу не отримує жодних даних рану", async () => {
    const { id } = await createTemplate(adminA, "Tenant move-in DSYS-03", MOVE_IN);
    await save(adminA, id);
    await t.asUser(managerA, "select public.launch_run($1, 'Apartment 3, move-in', '{}')", [id]);

    await expect(t.asAnon("select * from public.runs")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select * from public.run_tasks")).rejects.toThrow(/permission denied/);
  });
});
