// AC-RUN-*: запуск шаблону для кейсу — від імені конкретних користувачів, під RLS і GRANT зі справжніх міграцій.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const MOVE_IN = "10000000-0000-0000-0000-000000000001";
// Задачі шаблону «Tenant move-in» із supabase/seed.sql.
const INSPECT = "30000000-0000-0000-0000-000000000111";
const LEASE = "30000000-0000-0000-0000-000000000112";

let t: TestDb;
let admin: string;
let managerA: string;
let managerB: string;

type RunRow = { id: string; status: string; manager_id: string; case_name: string };
type TaskRow = { name: string; status: string; assignee_id: string };

async function launch(userId: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    MOVE_IN,
    caseName,
    assignments,
  ]);
  return row.id;
}

const runsOf = (userId: string) =>
  t.asService<RunRow>("select id, status, manager_id, case_name from public.runs where manager_id = $1", [userId]);
const tasksOf = (runId: string) =>
  t.asService<TaskRow>(
    "select name, status, assignee_id from public.run_tasks where run_id = $1 order by section_position, position",
    [runId],
  );

beforeAll(async () => {
  t = await createTestDb();
  admin = t.users["admin@example.test"];
  managerA = t.users["manager-a@example.test"];
  managerB = t.users["manager-b@example.test"];
});

describe("run-launch", () => {
  it("AC-RUN-01: запуск «Tenant move-in» створює один ран «in progress» з усіма 5 задачами «to do»", async () => {
    const before = (await runsOf(managerA)).length;
    const runId = await launch(managerA, "Apartment 12, move-in");

    const runs = await runsOf(managerA);
    expect(runs).toHaveLength(before + 1);
    expect(runs.find((r) => r.id === runId)?.status).toBe("in_progress");
    const tasks = await tasksOf(runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.status === "to_do")).toBe(true);
  });

  it("AC-RUN-02: зміна шаблону після запуску не змінює задачі рану", async () => {
    const runId = await launch(managerA, "Apartment 15, move-in");

    // Адміністратор додає шосту задачу і перейменовує першу.
    await t.asUser(
      admin,
      `insert into public.template_tasks (template_id, section_id, name, required, position)
       values ($1, '20000000-0000-0000-0000-000000000012', 'Collect the deposit', false, 3)`,
      [MOVE_IN],
    );
    await t.asUser(admin, "update public.template_tasks set name = 'Inspect the unit twice' where id = $1", [INSPECT]);

    const tasks = await t.asUser<TaskRow>(
      managerA,
      "select name, status, assignee_id from public.run_tasks where run_id = $1 order by section_position, position",
      [runId],
    );
    expect(tasks).toHaveLength(5);
    expect(tasks.map((task) => task.name)).toEqual([
      "Inspect the unit",
      "Prepare the lease",
      "Order cleaning",
      "Hand over the keys",
      "Record meter readings",
    ]);

    // Повертаємо шаблон, щоб інші тести бачили 5 задач.
    await t.asService("delete from public.template_tasks where name = 'Collect the deposit'");
    await t.asService("update public.template_tasks set name = 'Inspect the unit' where id = $1", [INSPECT]);
  });

  it("AC-RUN-03: порожня назва кейсу чи з самих пробілів — ран не створено", async () => {
    const before = (await runsOf(managerA)).length;
    await expect(launch(managerA, "")).rejects.toThrow("CASE_NAME_REQUIRED");
    await expect(launch(managerA, "    ")).rejects.toThrow("CASE_NAME_REQUIRED");
    expect(await runsOf(managerA)).toHaveLength(before);
  });

  it("AC-RUN-07: назва кейсу з 101 символу — ран не створено, зі 100 — створено", async () => {
    const before = (await runsOf(managerA)).length;
    await expect(launch(managerA, "x".repeat(101))).rejects.toThrow("CASE_NAME_TOO_LONG");
    expect(await runsOf(managerA)).toHaveLength(before);

    await launch(managerA, "y".repeat(100));
    expect(await runsOf(managerA)).toHaveLength(before + 1);
  });

  it("AC-RUN-05: адміністратор запускає шаблон — створено один ран, менеджер рану — адміністратор", async () => {
    const before = (await runsOf(admin)).length;
    const runId = await launch(admin, "Apartment 14, move-in");

    const runs = await runsOf(admin);
    expect(runs).toHaveLength(before + 1);
    expect(runs.find((r) => r.id === runId)?.manager_id).toBe(admin);
  });

  it("AC-RUN-06: менеджер A, який запустив шаблон, — менеджер рану", async () => {
    const runId = await launch(managerA, "Apartment 12, move-in");
    const [run] = await t.asUser<RunRow>(managerA, "select id, status, manager_id, case_name from public.runs where id = $1", [
      runId,
    ]);
    expect(run.manager_id).toBe(managerA);
  });

  it("AC-RUN-06: менеджер не може створити ран від імені іншого менеджера в обхід launch_run", async () => {
    await expect(
      t.asUser(managerA, "insert into public.runs (template_id, case_name, manager_id) values ($1, 'X', $2)", [
        MOVE_IN,
        managerB,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it("AC-RUN-04: 2 задачі призначено менеджеру B, решта 3 — менеджеру A", async () => {
    const runId = await launch(managerA, "Apartment 16, move-in", { [INSPECT]: managerB, [LEASE]: managerB });

    const tasks = await tasksOf(runId);
    expect(tasks.filter((task) => task.assignee_id === managerB).map((task) => task.name)).toEqual([
      "Inspect the unit",
      "Prepare the lease",
    ]);
    expect(tasks.filter((task) => task.assignee_id === managerA)).toHaveLength(3);
  });

  it("AC-RUN-04: виконавцем не можна призначити неіснуючого користувача — ран не створено", async () => {
    const before = (await runsOf(managerA)).length;
    await expect(
      launch(managerA, "Apartment 17, move-in", { [INSPECT]: "00000000-0000-0000-0000-000000000099" }),
    ).rejects.toThrow("ASSIGNEE_INVALID");
    expect(await runsOf(managerA)).toHaveLength(before);
  });

  it("AC-RUN-08: менеджер A без призначень — виконавець усіх 5 задач", async () => {
    const runId = await launch(managerA, "Apartment 18, move-in");
    const tasks = await tasksOf(runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.assignee_id === managerA)).toBe(true);
  });

  it("AC-RUN-09: адміністратор без призначень — виконавець усіх 5 задач", async () => {
    const runId = await launch(admin, "Apartment 19, move-in");
    const tasks = await tasksOf(runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.assignee_id === admin)).toBe(true);
  });

  it("AC-RUN-04: менеджер бачить для вибору виконавця лише id, ім'я та email менеджерів і адміністраторів", async () => {
    const people = await t.asUser<Record<string, unknown>>(managerA, "select * from public.list_assignable_users()");
    expect(people.map((p) => p.email)).toEqual(
      expect.arrayContaining(["admin@example.test", "manager-b@example.test"]),
    );
    expect(Object.keys(people[0]).sort()).toEqual(["email", "full_name", "id"]);
    // Профілі інших користувачів (з роллю) — як і раніше, лише власний.
    const profiles = await t.asUser<{ id: string }>(managerA, "select id from public.profiles");
    expect(profiles.map((p) => p.id)).toEqual([managerA]);
  });
});
