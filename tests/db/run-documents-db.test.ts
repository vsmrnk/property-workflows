// Зріз 4 — записи документа рану (openspec/specs/document-parsing/spec.md, AC-DOCAI-04, 13…16) на справжніх міграціях
// під RLS. Тести написано з тексту AC до міграції (impl-document-parsing, tasks.md 1.1): «Тоді» кожного AC — очікування
// в expect. Прямі запити (AC-DOCAI-16) — ті самі виклики, що зробив би PostgREST: роль authenticated, auth.uid().
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const MOVE_IN = "10000000-0000-0000-0000-000000000001"; // «Tenant move-in», 5 задач
const REPAIR = "10000000-0000-0000-0000-000000000002";
const TASK_1 = "30000000-0000-0000-0000-000000000111";
const TASK_3 = "30000000-0000-0000-0000-000000000113";
const TASK_4 = "30000000-0000-0000-0000-000000000121";

type Doc = {
  id: string;
  run_id: string;
  document_type: string;
  phone: string | null;
  description: string | null;
  category: string | null;
  urgency: string | null;
  items: { name: string; quantity: number; unitPrice: number }[];
  total: string | null;
  confirmed_by: string;
  confirmed_at: string;
};

type SaveArgs = {
  type: string | null;
  phone?: string | null;
  description?: string | null;
  category?: string | null;
  urgency?: string | null;
  items?: unknown;
  total?: number | null;
};

let t: TestDb;
let admin: string;
let managerA: string;
let managerB: string;
let vendorV: string;
let run12: string;
let run14: string;

const SAVE = "select public.save_run_document($1, $2, $3, $4, $5, $6, $7, $8) as id";
const saveArgs = (runId: string, a: SaveArgs) => [
  runId,
  a.type,
  a.phone ?? null,
  a.description ?? null,
  a.category ?? null,
  a.urgency ?? null,
  a.items === undefined ? null : JSON.stringify(a.items),
  a.total ?? null,
];
const save = async (userId: string, runId: string, a: SaveArgs) =>
  (await t.asUser<{ id: string }>(userId, SAVE, saveArgs(runId, a)))[0].id;

const docsAs = (userId: string, runId: string) =>
  t.asUser<Doc>(userId, "select * from public.run_documents where run_id = $1 order by confirmed_at desc, id", [runId]);
const allDocs = (runId: string) =>
  t.asService<Doc>("select * from public.run_documents where run_id = $1 order by confirmed_at desc", [runId]);
const canParse = async (userId: string, runId: string) =>
  (await t.asUser<{ ok: boolean }>(userId, "select public.can_parse_documents($1) as ok", [runId]))[0].ok;

const REQUEST: SaveArgs = {
  type: "maintenance_request",
  phone: "555-0101",
  description: "Kitchen tap in apartment 12 has been dripping for three days",
  category: "plumbing",
  urgency: "urgent",
};

beforeAll(async () => {
  t = await createTestDb();
  admin = t.users["admin@example.test"];
  managerA = t.users["manager-a@example.test"];
  managerB = t.users["manager-b@example.test"];
  vendorV = t.users["vendor-v@example.test"];
  // «Дано» AC-DOCAI-14/15: ран A «Apartment 12, move-in»; V — виконавець задач 3 і 4, B — задачі 1.
  run12 = (
    await t.asUser<{ id: string }>(managerA, "select public.launch_run($1, $2, $3) as id", [
      MOVE_IN,
      "Apartment 12, move-in",
      { [TASK_1]: managerB, [TASK_3]: vendorV, [TASK_4]: vendorV },
    ])
  )[0].id;
  run14 = (
    await t.asUser<{ id: string }>(managerA, "select public.launch_run($1, $2, $3) as id", [REPAIR, "Apartment 14, leak", {}])
  )[0].id;
});

describe("document-parsing: збереження значень людиною", () => {
  it("AC-DOCAI-04: після «Save values» ран має один запис з типом, значеннями, email A і часом підтвердження", async () => {
    const before = await allDocs(run14);
    const id = await save(managerA, run14, REQUEST);
    const docs = await docsAs(managerA, run14);
    expect(docs).toHaveLength(before.length + 1);
    const doc = docs.find((d) => d.id === id)!;
    expect(doc).toMatchObject({
      document_type: "maintenance_request",
      phone: "555-0101",
      category: "plumbing",
      urgency: "urgent",
      confirmed_by: managerA,
      items: [],
      total: null,
    });
    expect(doc.confirmed_at).toBeTruthy();
    // Email того, хто підтвердив, — з профілю за confirmed_by (менеджер рану бачить email через список людей).
    const people = await t.asUser<{ id: string; email: string }>(managerA, "select * from public.list_assignable_users()");
    expect(people.find((p) => p.id === doc.confirmed_by)?.email).toBe("manager-a@example.test");
  });

  it("AC-DOCAI-04: кілька записів — найновіший першим; кошторис зберігає позиції й Total як написано, без полів заявки", async () => {
    await save(managerA, run14, REQUEST);
    const estimateId = await save(managerA, run14, {
      type: "estimate",
      phone: "555-0199", // поле заявки в кошторисі не зберігається
      items: [
        { name: "Inspection", quantity: 1, unitPrice: 90 },
        { name: "Replace valve", quantity: 1, unitPrice: 70 },
        { name: "Labour", quantity: 1, unitPrice: 60 },
      ],
      total: 200,
    });
    const [newest] = await docsAs(managerA, run14);
    expect(newest.id).toBe(estimateId);
    expect(newest).toMatchObject({ document_type: "estimate", phone: null, category: null, urgency: null, total: "200.00" });
    expect(newest.items.map((i) => [i.name, i.quantity, i.unitPrice])).toEqual([
      ["Inspection", 1, 90],
      ["Replace valve", 1, 70],
      ["Labour", 1, 60],
    ]);
  });

  it("AC-DOCAI-13: без асистента людина заповнює значення сама — запис з вибраним типом і порожніми значеннями зберігається", async () => {
    const id = await save(managerA, run14, { type: "maintenance_request", phone: "555-0102" });
    const doc = (await docsAs(managerA, run14)).find((d) => d.id === id)!;
    expect(doc).toMatchObject({ phone: "555-0102", description: null, category: null, urgency: null });
  });

  it("без типу документа чи з позицією кількістю 0 — запис не зберігається", async () => {
    const before = (await allDocs(run14)).length;
    await expect(save(managerA, run14, { type: null })).rejects.toThrow(/DOCUMENT_TYPE_REQUIRED/);
    await expect(
      save(managerA, run14, { type: "estimate", items: [{ name: "Labour", quantity: 0, unitPrice: 60 }], total: 0 }),
    ).rejects.toThrow(/ITEM_INVALID/);
    await expect(save(managerA, run14, { ...REQUEST, category: "roof" })).rejects.toThrow();
    expect(await allDocs(run14)).toHaveLength(before);
  });

  it("адміністратор користується блоком у будь-якому рані (Users and roles PM; #61/#62 — варіант A)", async () => {
    expect(await canParse(admin, run12)).toBe(true);
    const id = await save(admin, run12, REQUEST);
    expect((await docsAs(admin, run12)).map((d) => d.id)).toContain(id);
    expect((await docsAs(managerA, run12)).map((d) => d.id)).toContain(id);
  });
});

describe("document-parsing: хто бачить блок і записи", () => {
  it("AC-DOCAI-14: вендор V, виконавець задач 3 і 4, не має блоку й не бачить записів рану", async () => {
    await save(managerA, run12, REQUEST);
    expect(await canParse(vendorV, run12)).toBe(false);
    expect(await docsAs(vendorV, run12)).toEqual([]);
  });

  it("AC-DOCAI-15: менеджер B, виконавець однієї задачі в рані A, не має блоку й не бачить записів рану", async () => {
    await save(managerA, run12, REQUEST);
    expect(await canParse(managerB, run12)).toBe(false);
    expect(await docsAs(managerB, run12)).toEqual([]);
    expect(await canParse(managerA, run12)).toBe(true);
  });
});

describe("document-parsing: прямі запити в обхід сторінок", () => {
  it("AC-DOCAI-16: вендор V і менеджер B, зберігаючи значення напряму, отримують «Not enough rights» (NOT_ENOUGH_RIGHTS), запису немає", async () => {
    const before = (await allDocs(run12)).length;
    await expect(save(vendorV, run12, REQUEST)).rejects.toThrow(/NOT_ENOUGH_RIGHTS/);
    await expect(save(managerB, run12, REQUEST)).rejects.toThrow(/NOT_ENOUGH_RIGHTS/);
    expect(await allDocs(run12)).toHaveLength(before);
  });

  it("AC-DOCAI-16: прямий insert, update чи delete у таблицю записів відхилено навіть менеджеру рану; нічого не змінено", async () => {
    const id = await save(managerA, run14, REQUEST);
    const before = await allDocs(run14);
    for (const user of [managerA, vendorV, managerB]) {
      await expect(
        t.asUser(user, "insert into public.run_documents (run_id, document_type, confirmed_by) values ($1, 'estimate', $2)", [
          run14,
          user,
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(t.asUser(user, "update public.run_documents set urgency = 'urgent' where id = $1", [id])).rejects.toThrow(
        /permission denied/,
      );
      await expect(t.asUser(user, "delete from public.run_documents where id = $1", [id])).rejects.toThrow(/permission denied/);
    }
    expect(await allDocs(run14)).toEqual(before);
  });

  it("AC-DOCAI-16: без входу — ні читання записів, ні перевірки права, ні збереження", async () => {
    await expect(t.asAnon("select * from public.run_documents")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select public.can_parse_documents($1)", [run12])).rejects.toThrow(/permission denied/);
    await expect(t.asAnon(SAVE, saveArgs(run12, REQUEST))).rejects.toThrow(/permission denied/);
  });
});
