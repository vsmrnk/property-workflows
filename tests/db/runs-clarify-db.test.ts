// Уточнення 2026-10-20 (clarify-run-launch) на справжніх міграціях під RLS.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const MOVE_IN = "10000000-0000-0000-0000-000000000001";
const REPAIR = "10000000-0000-0000-0000-000000000002";
const BEFORE = "20000000-0000-0000-0000-000000000011";
const MOVE_IN_DAY = "20000000-0000-0000-0000-000000000012";
const KEYS = "30000000-0000-0000-0000-000000000121";

let t: TestDb;
let admin: string;
let managerA: string;
let managerB: string;
let managerC: string;

const launch = async (userId: string, template: string, caseName: string, assignments: Record<string, string> = {}) =>
  (await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [template, caseName, assignments]))[0].id;

beforeAll(async () => {
  t = await createTestDb();
  admin = t.users["admin@example.test"];
  managerA = t.users["manager-a@example.test"];
  managerB = t.users["manager-b@example.test"];
  managerC = t.users["manager-c@example.test"];
});

describe("clarify-run-launch", () => {
  it("AC-RUN-10: вибір виконавця — email менеджера B і адміністратора, без імен і ролей", async () => {
    const people = await t.asUser<Record<string, unknown>>(managerA, "select * from public.list_assignable_users()");
    expect(people.map((p) => p.email)).toEqual(expect.arrayContaining(["manager-b@example.test", "admin@example.test"]));
    for (const p of people) expect(Object.keys(p).sort()).toEqual(["email", "id"]);
  });

  it("AC-RUN-11: 100 символів із пробілом попереду — один ран, назва без пробілу", async () => {
    const name = "z".repeat(100);
    const runId = await launch(managerA, MOVE_IN, ` ${name}`);
    const [run] = await t.asService<{ case_name: string }>("select case_name from public.runs where id = $1", [runId]);
    expect(run.case_name).toBe(name);
  });

  it("AC-RUN-11: табуляція й перенос рядка на краях назви обрізаються, як у формі (trim)", async () => {
    // Фідбек до WS6: форма обрізає будь-які пробільні символи (JS trim), база — так само.
    const runId = await launch(managerA, MOVE_IN, "\t Apartment 41, move-in \n");
    const [run] = await t.asService<{ case_name: string }>("select case_name from public.runs where id = $1", [runId]);
    expect(run.case_name).toBe("Apartment 41, move-in");
  });

  it("AC-RUN-12: перейменування секції й перенесення задачі в шаблоні не змінюють секції рану", async () => {
    const runId = await launch(managerA, MOVE_IN, "Apartment 40, move-in");
    const before = await t.asService<{ section_name: string; n: number }>(
      "select section_name, count(*)::int as n from public.run_tasks where run_id = $1 group by section_name, section_position order by section_position",
      [runId],
    );
    await t.asUser(admin, "update public.template_sections set name = 'Key handover' where id = $1", [MOVE_IN_DAY]);
    await t.asUser(admin, "update public.template_tasks set section_id = $2 where id = $1", [KEYS, BEFORE]);
    try {
      const after = await t.asUser<{ section_name: string; n: number }>(
        managerA,
        "select section_name, count(*)::int as n from public.run_tasks where run_id = $1 group by section_name, section_position order by section_position",
        [runId],
      );
      expect(after).toEqual(before);
      expect(after.map((s) => s.section_name)).toEqual(["Before move-in", "Move-in day"]);
    } finally {
      await t.asService("update public.template_sections set name = 'Move-in day' where id = $1", [MOVE_IN_DAY]);
      await t.asService("update public.template_tasks set section_id = $2 where id = $1", [KEYS, MOVE_IN_DAY]);
    }
  });

  it("AC-TASK-11: виконавець B бачить email виконавців задач рану, а профілі — лише власний", async () => {
    const runId = await launch(managerA, MOVE_IN, "Apartment 41, move-in", {
      "30000000-0000-0000-0000-000000000111": managerB,
    });
    const assignees = await t.asUser<{ assignee_id: string }>(managerB, "select assignee_id from public.run_tasks where run_id = $1", [runId]);
    const emails = await t.asUser<{ id: string; email: string }>(managerB, "select * from public.list_assignable_users()");
    const shown = new Set(assignees.map((a) => emails.find((e) => e.id === a.assignee_id)?.email));
    expect(shown).toEqual(new Set(["manager-a@example.test", "manager-b@example.test"]));
    const profiles = await t.asUser<{ id: string }>(managerB, "select id from public.profiles");
    expect(profiles.map((p) => p.id)).toEqual([managerB]);
  });

  it("AC-TASK-13: завершений ран у списку — «completed» і 4 з 5 «done»; ран «in progress» теж показано", async () => {
    const done = await launch(managerC, MOVE_IN, "Apartment 42, move-in");
    const open = await launch(managerC, MOVE_IN, "Apartment 43, move-in");
    const tasks = await t.asService<{ id: string; required: boolean }>(
      "select id, required from public.run_tasks where run_id = $1 order by section_position, position",
      [done],
    );
    const optional = tasks.filter((x) => !x.required);
    for (const task of [...tasks.filter((x) => x.required), optional[0]]) {
      await t.asUser(managerC, "select public.mark_task_done($1)", [task.id]);
    }
    const list = await t.asUser<{ id: string; status: string; done: number; total: number }>(
      managerC,
      `select r.id, r.status, count(*) filter (where k.status = 'done')::int as done, count(*)::int as total
       from public.runs r join public.run_tasks k on k.run_id = r.id
       where r.id = any($1::uuid[]) group by r.id, r.status`,
      [[done, open]],
    );
    expect(list.find((r) => r.id === done)).toMatchObject({ status: "completed", done: 4, total: 5 });
    expect(list.find((r) => r.id === open)).toMatchObject({ status: "in_progress" });
  });

  it("AC-TASK-14: пізніший ран «Repair» показано першим, з назвою кейсу й шаблону", async () => {
    const first = await launch(admin, MOVE_IN, "Apartment 12");
    const second = await launch(admin, REPAIR, "Apartment 12");
    await t.asService("update public.runs set created_at = now() - interval '1 minute' where id = $1", [first]);
    const rows = await t.asUser<{ id: string; case_name: string; template: string }>(
      admin,
      `select r.id, r.case_name, tp.name as template from public.runs r join public.templates tp on tp.id = r.template_id
       where r.id = any($1::uuid[]) order by r.created_at desc`,
      [[first, second]],
    );
    expect(rows.map((r) => r.id)).toEqual([second, first]);
    expect(rows.map((r) => [r.case_name, r.template])).toEqual([
      ["Apartment 12", "Maintenance request"],
      ["Apartment 12", "Tenant move-in"],
    ]);
  });

  it("AC-TASK-17: виконавець однієї задачі бачить прогрес рану «2 of 5 done»", async () => {
    const runId = await launch(managerA, MOVE_IN, "Apartment 44, move-in", {
      "30000000-0000-0000-0000-000000000113": managerB,
    });
    const tasks = await t.asService<{ id: string }>(
      "select id from public.run_tasks where run_id = $1 and required order by position limit 2",
      [runId],
    );
    for (const task of tasks) await t.asUser(managerA, "select public.mark_task_done($1)", [task.id]);
    const seen = await t.asUser<{ status: string }>(managerB, "select status from public.run_tasks where run_id = $1", [runId]);
    expect(seen).toHaveLength(5);
    expect(seen.filter((s) => s.status === "done")).toHaveLength(2);
  });

  it("AC-TASK-10: менеджер C не бачить чужого рану за id — сторінка покаже «Run not found»", async () => {
    const runId = await launch(managerA, MOVE_IN, "Apartment 45, move-in");
    expect(await t.asUser(managerC, "select id from public.runs where id = $1", [runId])).toHaveLength(0);
    expect(await t.asUser(managerC, "select id from public.run_tasks where run_id = $1", [runId])).toHaveLength(0);
  });
});
