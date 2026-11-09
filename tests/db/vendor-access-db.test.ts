// Зріз 3 — роль вендора (openspec/specs/vendor-access/spec.md, AC-VENDOR-01…10) на справжніх міграціях під RLS.
// Тести написано з тексту AC до міграції (impl-vendor-access, tasks.md 1.1): «Тоді» кожного AC — очікування в expect.
// Прямі запити (AC-VENDOR-07, AC-VENDOR-09) — ті самі виклики, що зробив би PostgREST: роль authenticated, auth.uid().
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const MOVE_IN = "10000000-0000-0000-0000-000000000001"; // «Tenant move-in», 5 задач, версія 1
const REPAIR = "10000000-0000-0000-0000-000000000002";
// Задачі «Tenant move-in» у порядку секцій і задач (seed.sql): 1 Inspect the unit, 2 Prepare the lease,
// 3 Order cleaning (optional), 4 Hand over the keys, 5 Record meter readings (optional).
const TASK_3 = "30000000-0000-0000-0000-000000000113";
const TASK_4 = "30000000-0000-0000-0000-000000000121";

type RunTask = { id: string; name: string; section_name: string; required: boolean; status: string; assignee_id: string };
type VendorRun = { id: string; case_name: string; status: string; my_done: number; my_total: number };
type VendorTask = { id: string; name: string; section_name: string; required: boolean; status: string; completes_run: boolean };

let t: TestDb;
let admin: string;
let managerA: string;
let vendorV: string;
let vendorW: string;
let run12: string;
let run14: string;

const launch = async (userId: string, template: string, caseName: string, assignments: Record<string, string> = {}) =>
  (await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [template, caseName, assignments]))[0].id;

const tasksOf = (runId: string) =>
  t.asService<RunTask>(
    "select id, name, section_name, required, status, assignee_id from public.run_tasks where run_id = $1 order by section_position, position",
    [runId],
  );

beforeAll(async () => {
  t = await createTestDb();
  admin = t.users["admin@example.test"];
  managerA = t.users["manager-a@example.test"];
  vendorV = t.users["vendor-v@example.test"];
  vendorW = t.users["vendor-w@example.test"];
  // «Дано» AC-VENDOR-03…07: V — виконавець задач 3 і 4 у «Apartment 12, move-in» і жодної задачі в «Apartment 14, repair».
  run12 = await launch(managerA, MOVE_IN, "Apartment 12, move-in", { [TASK_3]: vendorV, [TASK_4]: vendorV });
  run14 = await launch(managerA, REPAIR, "Apartment 14, repair");
});

describe("vendor-access: призначення вендора", () => {
  it("AC-VENDOR-01: задачі 3 і 4 мають виконавцем V, задачі 1, 2 і 5 — A", async () => {
    const runId = await launch(managerA, MOVE_IN, "Apartment 12, move-in", { [TASK_3]: vendorV, [TASK_4]: vendorV });
    const tasks = await tasksOf(runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.map((x) => x.assignee_id)).toEqual([managerA, managerA, vendorV, vendorV, managerA]);
    const [run] = await t.asService<{ manager_id: string }>("select manager_id from public.runs where id = $1", [runId]);
    expect(run.manager_id).toBe(managerA);
  });

  it("AC-VENDOR-02: у виборі виконавця A бачить email B, адміністратора й V, без імен, ролей та інших даних профілю", async () => {
    const people = await t.asUser<Record<string, unknown>>(managerA, "select * from public.list_assignable_users()");
    expect(people.map((p) => p.email)).toEqual(
      expect.arrayContaining(["manager-b@example.test", "admin@example.test", "vendor-v@example.test"]),
    );
    for (const p of people) expect(Object.keys(p).sort()).toEqual(["email", "id"]);
  });
});

describe("vendor-access: що бачить вендор", () => {
  it("AC-VENDOR-03: V бачить лише «Apartment 12, move-in» зі статусом рану й «Your tasks: 0 of 2 done», без «Apartment 14, repair»", async () => {
    const runs = await t.asUser<VendorRun>(vendorV, "select * from public.vendor_runs() where id = any($1)", [[run12, run14]]);
    expect(runs.map((r) => ({ case_name: r.case_name, status: r.status, my_done: r.my_done, my_total: r.my_total }))).toEqual([
      { case_name: "Apartment 12, move-in", status: "in_progress", my_done: 0, my_total: 2 },
    ]);
    // Напряму, оминаючи сторінки: таблиця runs не віддає вендору жодного рану, зокрема «Apartment 14, repair».
    const direct = await t.asUser<{ case_name: string }>(vendorV, "select case_name from public.runs");
    expect(direct.map((r) => r.case_name)).not.toContain("Apartment 14, repair");
  });

  it("AC-VENDOR-04: V бачить рівно задачі 3 і 4 з назвою, секцією, позначкою й статусом — без задач 1, 2, 5, email інших і прогресу рану", async () => {
    const mine = await t.asUser<VendorTask>(vendorV, "select * from public.vendor_run_tasks($1)", [run12]);
    expect(mine.map((x) => ({ name: x.name, section_name: x.section_name, required: x.required, status: x.status }))).toEqual([
      { name: "Order cleaning", section_name: "Before move-in", required: false, status: "to_do" },
      { name: "Hand over the keys", section_name: "Move-in day", required: true, status: "to_do" },
    ]);
    // Напряму, оминаючи сторінки: ні рядків run_tasks (done_by, assignee_id інших), ні рядка рану (прогрес, менеджер,
    // версія шаблону) — лише функція вендора з переліченими колонками.
    expect(await t.asUser(vendorV, "select id from public.run_tasks where run_id = $1", [run12])).toEqual([]);
    expect(await t.asUser(vendorV, "select id from public.runs where id = $1", [run12])).toEqual([]);
    expect(Object.keys(mine[0]).sort()).toEqual(
      ["completes_run", "id", "name", "position", "required", "section_name", "section_position", "status"],
    );
    // Email інших користувачів: ні вибору виконавця, ні чужих профілів.
    expect(await t.asUser(vendorV, "select * from public.list_assignable_users()")).toEqual([]);
    const profiles = await t.asUser<{ email: string }>(vendorV, "select email from public.profiles");
    expect(profiles.map((p) => p.email)).toEqual(["vendor-v@example.test"]);
  });

  it("AC-VENDOR-06: V за прямим посиланням на «Apartment 14, repair» не отримує ні рану, ні жодної його задачі", async () => {
    expect(await t.asUser(vendorV, "select * from public.vendor_runs() where id = $1", [run14])).toEqual([]);
    expect(await t.asUser(vendorV, "select * from public.vendor_run_tasks($1)", [run14])).toEqual([]);
    expect(await t.asUser(vendorV, "select id from public.run_tasks where run_id = $1", [run14])).toEqual([]);
  });

  it("AC-VENDOR-08: V не отримує жодного шаблону — ні списку, ні робочої копії, ні версій", async () => {
    expect(await t.asUser(vendorV, "select id from public.templates")).toEqual([]);
    expect(await t.asUser(vendorV, "select id from public.template_sections")).toEqual([]);
    expect(await t.asUser(vendorV, "select id from public.template_versions")).toEqual([]);
  });

  it("AC-VENDOR-03: без входу функції вендора недоступні — ні ранів, ні задач", async () => {
    // Емуляція дає функціям public права Supabase за замовчуванням (і anon теж) — відмова йде від revoke міграції.
    // Текст помилки не відрізняє public.vendor_runs від private.vendor_runs (те саме ім'я), тож право обгортки
    // перевіряємо й прямо.
    const [granted] = await t.asService<{ runs: boolean; tasks: boolean }>(
      `select has_function_privilege('anon', 'public.vendor_runs()', 'execute') as runs,
              has_function_privilege('anon', 'public.vendor_run_tasks(uuid)', 'execute') as tasks`,
    );
    expect(granted).toEqual({ runs: false, tasks: false });
    await expect(t.asAnon("select * from public.vendor_runs()")).rejects.toThrow(/permission denied for function vendor_runs/);
    await expect(t.asAnon("select * from public.vendor_run_tasks($1)", [run12])).rejects.toThrow(
      /permission denied for function vendor_run_tasks/,
    );
  });

  it("AC-VENDOR-10: V, якому не призначено жодної задачі, не має жодного рану", async () => {
    expect(await t.asUser(vendorW, "select * from public.vendor_runs()")).toEqual([]);
    expect(await t.asUser(vendorW, "select id from public.run_tasks")).toEqual([]);
  });
});

describe("vendor-access: дії вендора", () => {
  it("AC-VENDOR-05: V позначає задачу 3 — вона «done», і V бачить «Your tasks: 1 of 2 done»", async () => {
    const before = await t.asUser<VendorTask>(vendorV, "select * from public.vendor_run_tasks($1)", [run12]);
    const task3 = before.find((x) => x.name === "Order cleaning")!;
    // Задача 3 — не остання обов'язкова: підтвердження не потрібне.
    expect(task3.completes_run).toBe(false);
    await t.asUser(vendorV, "select public.mark_task_done($1)", [task3.id]);
    const [after] = await t.asService<{ status: string; done_by: string }>("select status, done_by from public.run_tasks where id = $1", [task3.id]);
    expect(after).toEqual({ status: "done", done_by: vendorV });
    const [run] = await t.asUser<VendorRun>(vendorV, "select * from public.vendor_runs() where id = $1", [run12]);
    expect([run.my_done, run.my_total]).toEqual([1, 2]);
    // Крок 5 основного сценарію PM: менеджер рану бачить новий статус і прогрес рану.
    const seen = await t.asUser<{ name: string; status: string }>(managerA, "select name, status from public.run_tasks where run_id = $1", [run12]);
    expect(seen).toHaveLength(5);
    expect(seen.find((x) => x.name === "Order cleaning")?.status).toBe("done");
    expect(seen.filter((x) => x.status === "done")).toHaveLength(1);
  });

  it("AC-VENDOR-05: остання обов'язкова задача вендора просить підтвердження (completes_run), інші — ні", async () => {
    const runId = await launch(managerA, MOVE_IN, "Apartment 17, move-in", { [TASK_4]: vendorV });
    const keys = async () =>
      (await t.asUser<VendorTask>(vendorV, "select * from public.vendor_run_tasks($1)", [runId]))[0].completes_run;
    expect(await keys()).toBe(false);
    // Менеджер позначає інші обов'язкові задачі (1 і 2): «Hand over the keys» лишається останньою обов'язковою.
    for (const task of (await tasksOf(runId)).filter((x) => x.required && x.assignee_id === managerA)) {
      await t.asUser(managerA, "select public.mark_task_done($1)", [task.id]);
    }
    expect(await keys()).toBe(true);
  });

  it("AC-VENDOR-07: V позначає задачу 1 (виконавець — A) напряму — відмова, задача 1 лишається «to do»", async () => {
    const [task1] = await tasksOf(run12);
    expect(task1.assignee_id).toBe(managerA);
    await expect(t.asUser(vendorV, "select public.mark_task_done($1)", [task1.id])).rejects.toThrow("NOT_ALLOWED");
    // Запис напряму в таблицю теж закрито (GRANT лише select).
    await expect(t.asUser(vendorV, "update public.run_tasks set status = 'done' where id = $1", [task1.id])).rejects.toThrow(/permission denied for table run_tasks/);
    const [after] = await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [task1.id]);
    expect(after.status).toBe("to_do");
  });

  it("AC-VENDOR-09: V запускає «Tenant move-in» напряму — рану не створено, список ранів не змінився", async () => {
    const count = async () => (await t.asService<{ n: number }>("select count(*)::int as n from public.runs"))[0].n;
    const runsBefore = await count();
    const listBefore = await t.asUser<VendorRun>(vendorV, "select id from public.vendor_runs() order by id");
    await expect(launch(vendorV, MOVE_IN, "Apartment 15, move-in")).rejects.toThrow("NOT_ALLOWED");
    expect(await count()).toBe(runsBefore);
    expect(await t.asService("select id from public.runs where manager_id = $1", [vendorV])).toEqual([]);
    expect(await t.asUser<VendorRun>(vendorV, "select id from public.vendor_runs() order by id")).toEqual(listBefore);
  });

  it("AC-VENDOR-01: адміністратор теж запускає шаблон і призначає вендора (матриця прав)", async () => {
    const runId = await launch(admin, MOVE_IN, "Apartment 16, move-in", { [TASK_4]: vendorV });
    expect((await tasksOf(runId)).filter((x) => x.assignee_id === vendorV).map((x) => x.name)).toEqual(["Hand over the keys"]);
  });
});
