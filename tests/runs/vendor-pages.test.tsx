// @vitest-environment happy-dom
// Сторінки вендора (impl-vendor-access, design.md U2–U5, A1): що бачить вендор — список ранів, сторінка рану, відмови.
// Тести написано з тексту AC до коду сторінок (tasks.md 2.1). Клієнт Supabase підмінений: він віддає рівно те, що
// віддала б база вендору (vendor_runs, vendor_run_tasks; таблиці runs і templates — порожні під RLS). Самі межі в базі
// доводить tests/db/vendor-access-db.test.ts.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import RunPage from "@/app/runs/[id]/page";
import RunNotFound from "@/app/runs/[id]/not-found";
import NewRunPage from "@/app/runs/new/page";
import TemplatesPage from "@/app/templates/page";
import { yourTasksLabel } from "@/lib/runs/progress";

const RUN_12 = "6b6a73ab-7180-434a-ab55-0920f16e7312";
const RUN_14 = "6b6a73ab-7180-434a-ab55-0920f16e7314";

type VendorRun = { id: string; case_name: string; status: string; created_at: string; my_done: number; my_total: number };
type VendorTask = {
  id: string;
  section_name: string;
  section_position: number;
  name: string;
  required: boolean;
  position: number;
  status: string;
  completes_run: boolean;
};

let vendorRuns: VendorRun[] = [];
let vendorTasks: Record<string, VendorTask[]> = {};
const tablesQueried: string[] = [];
const rpcCalls: string[] = [];

const task3 = (status: string): VendorTask => ({
  id: "t3", section_name: "Before move-in", section_position: 1, name: "Order cleaning", required: false, position: 3, status, completes_run: false,
});
const task4: VendorTask = {
  id: "t4", section_name: "Move-in day", section_position: 2, name: "Hand over the keys", required: true, position: 1, status: "to_do", completes_run: false,
};

function query(table: string) {
  tablesQueried.push(table);
  // Під RLS вендор бачить лише власний профіль; runs, run_tasks чужих ранів і templates — порожні.
  const rows = () => (table === "profiles" ? [{ email: "vendor-v@example.test", role: "vendor" }] : []);
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data: rows()[0] ?? null }),
    then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: rows() }),
  };
  return builder;
}
const rpc = vi.fn(async (fn: string, args?: { p_run_id?: string }) => {
  rpcCalls.push(fn);
  if (fn === "vendor_runs") return { data: vendorRuns, error: null };
  if (fn === "vendor_run_tasks") return { data: vendorTasks[args?.p_run_id ?? ""] ?? [], error: null };
  // Вибір виконавця вендору база не віддає (assignable_users — лише manager і admin).
  if (fn === "list_assignable_users") return { data: [], error: null };
  return { data: null, error: { message: "NOT_ALLOWED" } };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "v", email: "vendor-v@example.test" } } }) },
    from: (table: string) => query(table),
    rpc,
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const render = async (node: Promise<React.ReactNode> | React.ReactNode) => {
  document.body.innerHTML = renderToStaticMarkup(await node);
  return document.body;
};
const runPage = (id: string) => RunPage({ params: Promise.resolve({ id }) } as never);
const text = (el: Element) => el.textContent?.replace(/\s+/g, " ").trim() ?? "";

beforeEach(() => {
  tablesQueried.length = 0;
  rpcCalls.length = 0;
  rpc.mockClear();
  vendorRuns = [
    { id: RUN_12, case_name: "Apartment 12, move-in", status: "in_progress", created_at: "2026-11-09T08:00:00Z", my_done: 0, my_total: 2 },
  ];
  vendorTasks = { [RUN_12]: [task3("to_do"), task4] };
});

describe("vendor: list of runs", () => {
  it("AC-VENDOR-03: V бачить лише «Apartment 12, move-in» зі статусом рану й «Your tasks: 0 of 2 done», без «Apartment 14, repair»", async () => {
    expect(yourTasksLabel(0, 2)).toBe("Your tasks: 0 of 2 done");
    const body = await render(Home());
    const rows = [...body.querySelectorAll('[data-testid="vendor-run"]')];
    expect(rows).toHaveLength(1);
    expect(text(rows[0])).toContain("Apartment 12, move-in");
    expect(rows[0].querySelector('[data-testid="run-status"]')?.textContent).toBe("in progress");
    expect(rows[0].querySelector('[data-testid="your-tasks"]')?.textContent).toBe("Your tasks: 0 of 2 done");
    expect(body.textContent).not.toContain("Apartment 14, repair");
    // Список береться з vendor_runs(), а не з таблиці runs; запуску шаблону вендору не пропонуємо.
    expect(rpcCalls).toContain("vendor_runs");
    expect(body.textContent).not.toContain("Launch a template");
    // Навігація вендора — без «Templates» (design.md U5).
    expect([...body.querySelectorAll('nav[aria-label="Main"] a')].map((a) => a.textContent)).toEqual(["Runs"]);
  });

  it("AC-VENDOR-10: V без задач бачить «No tasks assigned to you yet.» і жодної таблиці", async () => {
    vendorRuns = [];
    const body = await render(Home());
    expect(body.querySelector('[data-testid="vendor-runs-empty"]')?.textContent).toBe("No tasks assigned to you yet.");
    expect(body.querySelector("table")).toBeNull();
    expect(body.textContent).not.toContain("No runs yet.");
  });
});

describe("vendor: page of a run", () => {
  it("AC-VENDOR-04: V бачить рівно задачі 3 і 4 з назвою, секцією, позначкою й статусом — без задач 1, 2, 5, email інших і прогресу рану", async () => {
    const body = await render(runPage(RUN_12));
    const rows = [...body.querySelectorAll('[data-testid="run-task"]')];
    expect(rows.map((r) => r.querySelector('[data-testid="task-name"]')?.textContent)).toEqual(["Order cleaning", "Hand over the keys"]);
    expect(rows.map((r) => r.querySelector('[data-testid="task-section"]')?.textContent)).toEqual(["Before move-in", "Move-in day"]);
    expect(rows.map((r) => r.querySelector('[data-testid="task-requirement"]')?.textContent)).toEqual(["optional", "required"]);
    expect(rows.map((r) => r.querySelector('[data-testid="task-status"]')?.textContent)).toEqual(["to do", "to do"]);
    // Не бачить: інших задач, email інших користувачів (лише власний у хедері), прогресу всього рану.
    for (const name of ["Inspect the unit", "Prepare the lease", "Record meter readings"]) expect(body.textContent).not.toContain(name);
    const emails = body.textContent?.match(/[\w.+-]+@example\.test/g) ?? [];
    expect(new Set(emails)).toEqual(new Set(["vendor-v@example.test"]));
    expect(body.querySelector('[data-testid="task-assignee"]')).toBeNull();
    expect(body.querySelector('[role="progressbar"]')).toBeNull();
    expect(body.textContent).not.toMatch(/of 5 done/);
    expect(body.textContent).not.toContain("Run manager");
    // Дані рану — лише з функцій вендора: таблиць runs і run_tasks сторінка не читає.
    expect(tablesQueried).not.toContain("runs");
    expect(tablesQueried).not.toContain("run_tasks");
  });

  it("AC-VENDOR-05: після позначки задача 3 «done», і V бачить «Your tasks: 1 of 2 done»", async () => {
    vendorRuns[0].my_done = 1;
    vendorTasks[RUN_12] = [task3("done"), task4];
    const body = await render(runPage(RUN_12));
    expect(body.querySelector('[data-testid="your-tasks"]')?.textContent).toBe("Your tasks: 1 of 2 done");
    const rows = [...body.querySelectorAll('[data-testid="run-task"]')];
    expect(rows[0].querySelector('[data-testid="task-status"]')?.textContent).toBe("done");
    // «Mark as done» — лише на задачі «to do» (задача 4).
    expect(rows[0].querySelector("button")).toBeNull();
    expect(rows[1].querySelector("button")?.getAttribute("aria-label")).toBe("Mark “Hand over the keys” as done");
  });

  it("AC-VENDOR-06: V за прямим посиланням на «Apartment 14, repair» — «Run not found» і жодної задачі", async () => {
    await expect(runPage(RUN_14)).rejects.toThrow("NOT_FOUND");
    expect(rpcCalls).not.toContain("vendor_run_tasks");
    const body = await render(<RunNotFound />);
    expect(body.querySelector('[data-testid="run-not-found"]')?.textContent).toBe("Run not found");
    expect(body.querySelector('[data-testid="run-task"]')).toBeNull();
  });
});

describe("vendor: templates", () => {
  it("AC-VENDOR-08: V за прямим посиланням на список шаблонів — «Not enough rights» і жодного шаблону", async () => {
    const body = await render(TemplatesPage());
    expect(body.querySelector('[data-testid="access-denied"] h1')?.textContent).toBe("Not enough rights");
    expect(body.querySelector('[data-testid="templates"]')).toBeNull();
    expect(body.querySelector("table")).toBeNull();
    // Сторінка навіть не питає базу про шаблони.
    expect(tablesQueried).not.toContain("templates");
  });

  it("AC-VENDOR-09: форма запуску для V — «Not enough rights», без шаблонів і без виконавців", async () => {
    const body = await render(NewRunPage({ searchParams: Promise.resolve({ template: "10000000-0000-0000-0000-000000000001" }) } as never));
    expect(body.querySelector('[data-testid="access-denied"] h1')?.textContent).toBe("Not enough rights");
    expect(body.querySelector("form")).toBeNull();
    expect(tablesQueried).not.toContain("templates");
    expect(rpcCalls).not.toContain("list_assignable_users");
  });

  it("AC-VENDOR-09: дія launchRun для V — «Not enough rights», launch_run не викликано", async () => {
    const { launchRun } = await import("@/app/runs/actions");
    const fd = new FormData();
    fd.set("templateId", "10000000-0000-0000-0000-000000000001");
    fd.set("caseName", "Apartment 15, move-in");
    const state = await launchRun({}, fd);
    expect(state.error).toBe("Not enough rights");
    expect(rpcCalls).not.toContain("launch_run");
  });
});
