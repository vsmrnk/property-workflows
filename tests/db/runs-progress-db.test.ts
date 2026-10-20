// AC-TASK-*: позначення задач і прогрес рану — від імені конкретних користувачів, під RLS і GRANT зі справжніх міграцій.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const MOVE_IN = "10000000-0000-0000-0000-000000000001";
// Задачі шаблону «Tenant move-in» із supabase/seed.sql (обов'язкові: INSPECT, LEASE, KEYS).
const INSPECT = "30000000-0000-0000-0000-000000000111";
const LEASE = "30000000-0000-0000-0000-000000000112";
const CLEANING = "30000000-0000-0000-0000-000000000113";
const KEYS = "30000000-0000-0000-0000-000000000121";
const METERS = "30000000-0000-0000-0000-000000000122";

// Задачі рану — копії без посилання на шаблон, тож знаходимо їх за назвою.
const TASK_NAMES: Record<string, string> = {
  [INSPECT]: "Inspect the unit",
  [LEASE]: "Prepare the lease",
  [CLEANING]: "Order cleaning",
  [KEYS]: "Hand over the keys",
  [METERS]: "Record meter readings",
};

let t: TestDb;
let admin: string;
let managerA: string;
let managerB: string;
let managerC: string;

type TaskRow = { id: string; name: string; status: string; required: boolean; done_at: string | null };

async function launch(userId: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    MOVE_IN,
    caseName,
    assignments,
  ]);
  return row.id;
}

async function taskId(runId: string, templateTaskId: string) {
  const [row] = await t.asService<{ id: string }>("select id from public.run_tasks where run_id = $1 and name = $2", [
    runId,
    TASK_NAMES[templateTaskId],
  ]);
  return row.id;
}

const markDone = (userId: string, id: string) => t.asUser(userId, "select public.mark_task_done($1)", [id]);

async function task(id: string) {
  const [row] = await t.asService<TaskRow>(
    "select id, name, status, required, done_at from public.run_tasks where id = $1",
    [id],
  );
  return row;
}

async function runStatus(runId: string) {
  const [row] = await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]);
  return row.status;
}

beforeAll(async () => {
  t = await createTestDb();
  admin = t.users["admin@example.test"];
  managerA = t.users["manager-a@example.test"];
  managerB = t.users["manager-b@example.test"];
  managerC = t.users["manager-c@example.test"];
});

describe("run-progress", () => {
  it("AC-TASK-01: виконавець (менеджер B) позначає свою задачу в рані менеджера A — «done»", async () => {
    const runId = await launch(managerA, "Apartment 21, move-in", { [INSPECT]: managerB });
    const id = await taskId(runId, INSPECT);

    await markDone(managerB, id);

    expect((await task(id)).status).toBe("done");
  });

  it("AC-TASK-01: повторна позначка вже виконаної задачі нічого не змінює", async () => {
    const runId = await launch(managerA, "Apartment 22, move-in", { [INSPECT]: managerB });
    const id = await taskId(runId, INSPECT);
    await markDone(managerB, id);
    const first = await task(id);

    await markDone(managerB, id);

    const second = await task(id);
    expect(second.status).toBe("done");
    expect(second.done_at).not.toBeNull();
    expect(second.done_at).toEqual(first.done_at);
  });

  it("AC-TASK-02: менеджер рану A позначає задачу, призначену менеджеру B, — «done»", async () => {
    const runId = await launch(managerA, "Apartment 23, move-in", { [INSPECT]: managerB });
    const id = await taskId(runId, INSPECT);

    await markDone(managerA, id);

    expect((await task(id)).status).toBe("done");
  });

  it("AC-TASK-03: менеджер C (не виконавець і не менеджер рану) не може позначити задачу — NOT_ALLOWED", async () => {
    const runId = await launch(managerA, "Apartment 24, move-in", { [INSPECT]: managerB });
    const id = await taskId(runId, INSPECT);

    await expect(markDone(managerC, id)).rejects.toThrow("NOT_ALLOWED");

    expect((await task(id)).status).toBe("to_do");
  });

  it("AC-TASK-03: менеджер C не може змінити статус задачі напряму в обхід mark_task_done", async () => {
    const runId = await launch(managerA, "Apartment 25, move-in", { [INSPECT]: managerB });
    const id = await taskId(runId, INSPECT);

    let changed: unknown[] = [];
    try {
      changed = await t.asUser(
        managerC,
        "update public.run_tasks set status = 'done', done_at = now(), done_by = $2 where id = $1 returning id",
        [id, managerC],
      );
    } catch {
      changed = [];
    }

    expect(changed).toHaveLength(0);
    expect((await task(id)).status).toBe("to_do");
  });

  it("AC-TASK-07: адміністратор (не менеджер рану) позначає задачу в рані менеджера A — «done»", async () => {
    const runId = await launch(managerA, "Apartment 26, move-in", { [INSPECT]: managerB });
    const id = await taskId(runId, INSPECT);

    await markDone(admin, id);

    expect((await task(id)).status).toBe("done");
  });

  it("AC-TASK-04: ран стає «completed», коли виконано всі 3 обов'язкові задачі; необов'язкові лишаються «to do»", async () => {
    const runId = await launch(managerA, "Apartment 27, move-in");

    await markDone(managerA, await taskId(runId, INSPECT));
    await markDone(managerA, await taskId(runId, LEASE));
    expect(await runStatus(runId)).toBe("in_progress");

    await markDone(managerA, await taskId(runId, KEYS));
    expect(await runStatus(runId)).toBe("completed");

    expect((await task(await taskId(runId, CLEANING))).status).toBe("to_do");
    expect((await task(await taskId(runId, METERS))).status).toBe("to_do");
  });

  it("AC-TASK-04: виконання лише необов'язкових задач не завершує ран", async () => {
    const runId = await launch(managerA, "Apartment 28, move-in");

    await markDone(managerA, await taskId(runId, CLEANING));
    await markDone(managerA, await taskId(runId, METERS));

    expect(await runStatus(runId)).toBe("in_progress");
  });

  it("AC-TASK-05: менеджер рану бачить 5 задач рану, з них 2 виконані", async () => {
    const runId = await launch(managerA, "Apartment 29, move-in");
    await markDone(managerA, await taskId(runId, INSPECT));
    await markDone(managerA, await taskId(runId, CLEANING));

    const tasks = await t.asUser<{ status: string }>(managerA, "select status from public.run_tasks where run_id = $1", [
      runId,
    ]);

    expect(tasks).toHaveLength(5);
    expect(tasks.filter((x) => x.status === "done")).toHaveLength(2);
  });

  it("AC-TASK-09: у списку ранів менеджер рану бачить для рану 2 виконані з 5", async () => {
    const runId = await launch(managerA, "Apartment 30, move-in");
    await markDone(managerA, await taskId(runId, LEASE));
    await markDone(managerA, await taskId(runId, METERS));

    const rows = await t.asUser<{ id: string; done: number; total: number }>(
      managerA,
      `select r.id, count(t.*) filter (where t.status = 'done')::int as done, count(t.*)::int as total
       from public.runs r join public.run_tasks t on t.run_id = r.id
       where r.id = $1 group by r.id`,
      [runId],
    );

    expect(rows).toEqual([{ id: runId, done: 2, total: 5 }]);
  });

  it("AC-TASK-08: менеджер рану бачить статус кожної задачі — 2 «done» і 3 «to do»", async () => {
    const runId = await launch(managerA, "Apartment 31, move-in");
    await markDone(managerA, await taskId(runId, INSPECT));
    await markDone(managerA, await taskId(runId, KEYS));

    const tasks = await t.asUser<{ name: string; status: string | null }>(
      managerA,
      "select name, status from public.run_tasks where run_id = $1 order by section_position, position",
      [runId],
    );

    expect(tasks).toHaveLength(5);
    expect(tasks.every((x) => x.status === "done" || x.status === "to_do")).toBe(true);
    expect(tasks.filter((x) => x.status === "done").map((x) => x.name)).toEqual([
      "Inspect the unit",
      "Hand over the keys",
    ]);
    expect(tasks.filter((x) => x.status === "to_do")).toHaveLength(3);
  });

  describe("AC-TASK-06: видимість ранів", () => {
    let runA1: string;
    let runA2: string;
    let runB: string;
    const visibleTo = async (userId: string) =>
      (
        await t.asUser<{ id: string }>(userId, "select id from public.runs where id = any($1::uuid[])", [
          [runA1, runA2, runB],
        ])
      )
        .map((r) => r.id)
        .sort();

    beforeAll(async () => {
      runA1 = await launch(managerA, "Apartment 32, move-in", { [INSPECT]: managerB });
      runA2 = await launch(managerA, "Apartment 33, move-in");
      runB = await launch(managerB, "Apartment 34, move-in");
    });

    it("AC-TASK-06: менеджер B бачить свій ран і ран A, де він виконавець, але не інший ран A", async () => {
      expect(await visibleTo(managerB)).toEqual([runA1, runB].sort());
    });

    it("AC-TASK-06: адміністратор бачить усі три рани", async () => {
      expect(await visibleTo(admin)).toEqual([runA1, runA2, runB].sort());
    });

    it("AC-TASK-06: менеджер C не бачить жодного з цих ранів", async () => {
      expect(await visibleTo(managerC)).toEqual([]);
    });
  });
});

describe("AC-TASK-01: позначку «done» ставить лише база", () => {
  it("AC-TASK-01: прямий UPDATE задачі заборонено навіть виконавцю — done_by і done_at ставить mark_task_done", async () => {
    const t2 = await createTestDb();
    const a = t2.users["manager-a@example.test"];
    const b = t2.users["manager-b@example.test"];
    const [{ id: runId }] = await t2.asUser<{ id: string }>(a, "select public.launch_run($1, $2, '{}'::jsonb) as id", [
      "10000000-0000-0000-0000-000000000001",
      "Apartment 30, move-in",
    ]);
    const [task] = await t2.asService<{ id: string }>("select id from public.run_tasks where run_id = $1 limit 1", [runId]);

    await expect(
      t2.asUser(a, "update public.run_tasks set status = 'done', done_by = $2, done_at = '2020-01-01' where id = $1", [
        task.id,
        b,
      ]),
    ).rejects.toThrow(/permission denied/);

    await t2.asUser(a, "select public.mark_task_done($1)", [task.id]);
    const [row] = await t2.asService<{ status: string; done_by: string }>(
      "select status, done_by from public.run_tasks where id = $1",
      [task.id],
    );
    expect(row).toEqual({ status: "done", done_by: a });
  });
});
