// @vitest-environment happy-dom
// Сторінка рану й блок «Parse a document» (impl-document-parsing, design.md U1, U9): хто бачить блок і як виглядає
// збережений запис. Клієнт Supabase підмінений і віддає рівно те, що віддала б база цьому користувачу; самі права
// (can_parse_documents, RLS на run_documents) доводить tests/db/run-documents-db.test.ts.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RunPage from "@/app/runs/[id]/page";
import { formatConfirmedAt } from "@/lib/documents/format";

const RUN_12 = "6b6a73ab-7180-434a-ab55-0920f16e7312";
const MANAGER_A = "a0000000-0000-0000-0000-00000000000a";
const ADMIN = "a0000000-0000-0000-0000-0000000000ad";

type Viewer = { id: string; email: string; role: string };
const managerA: Viewer = { id: MANAGER_A, email: "manager-a@example.test", role: "manager" };
const managerB: Viewer = { id: "b0000000-0000-0000-0000-00000000000b", email: "manager-b@example.test", role: "manager" };
const vendorV: Viewer = { id: "c0000000-0000-0000-0000-00000000000c", email: "vendor-v@example.test", role: "vendor" };

let viewer: Viewer = managerA;
let canParse = true;
let documents: Record<string, unknown>[] = [];
let documentsError: { message: string } | null = null;
const tablesQueried: string[] = [];
const orders: [string, string, unknown][] = [];

const RUN = {
  id: RUN_12,
  case_name: "Apartment 12, move-in",
  status: "in_progress",
  manager_id: MANAGER_A,
  created_at: "2026-11-09T08:00:00Z",
  template_version: 1,
  template_name: "Tenant move-in",
};

function query(table: string) {
  tablesQueried.push(table);
  const rows = (): unknown[] => {
    if (table === "profiles") return [{ email: viewer.email, role: viewer.role }];
    if (table === "runs") return viewer.role === "vendor" ? [] : [RUN];
    if (table === "run_documents") return canParse ? documents : [];
    return [];
  };
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: (column: string, opts?: unknown) => {
      orders.push([table, column, opts]);
      return builder;
    },
    maybeSingle: async () => ({ data: rows()[0] ?? null }),
    then: (resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) =>
      resolve(table === "run_documents" && documentsError ? { data: null, error: documentsError } : { data: rows(), error: null }),
  };
  return builder;
}

const rpc = vi.fn(async (fn: string) => {
  if (fn === "can_parse_documents") return { data: canParse, error: null };
  if (fn === "list_assignable_users")
    return { data: [{ id: MANAGER_A, email: "manager-a@example.test" }, { id: ADMIN, email: "admin@example.test" }], error: null };
  // Вендор V бачить ран 12 через свої задачі (функції вендора); блоку й записів у нього немає.
  if (fn === "vendor_runs") return { data: [{ id: RUN_12, case_name: RUN.case_name, status: RUN.status, my_done: 0, my_total: 2 }], error: null };
  if (fn === "vendor_run_tasks") return { data: [], error: null };
  return { data: null, error: { message: "NOT_ALLOWED" } };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: viewer.id, email: viewer.email } } }) },
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

const page = async () => {
  document.body.innerHTML = renderToStaticMarkup(await RunPage({ params: Promise.resolve({ id: RUN_12 }) } as never));
  return document.body;
};
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

const urgentTap = {
  id: "d1",
  run_id: RUN_12,
  document_type: "maintenance_request",
  phone: "555-0101",
  description: "The kitchen tap in apartment 12 has been dripping for three days.",
  category: "plumbing",
  urgency: "urgent",
  items: [],
  total: null,
  confirmed_by: MANAGER_A,
  confirmed_at: "2026-11-12T08:15:00Z",
};

beforeEach(() => {
  viewer = managerA;
  canParse = true;
  documents = [];
  documentsError = null;
  tablesQueried.length = 0;
  orders.length = 0;
  rpc.mockClear();
});

describe("хто бачить блок «Parse a document»", () => {
  it("AC-DOCAI-14: вендор V, виконавець задач 3 і 4, — сторінка рану без блоку й без записів", async () => {
    viewer = vendorV;
    const body = await page();
    expect(text(body)).not.toContain("Parse a document");
    expect(text(body)).not.toContain("Saved values");
    expect(tablesQueried).not.toContain("run_documents");
  });

  it("AC-DOCAI-15: менеджер B, лише виконавець однієї задачі, — без блоку й без записів", async () => {
    viewer = managerB;
    canParse = false;
    documents = [urgentTap];
    const body = await page();
    expect(text(body)).toContain("Apartment 12, move-in");
    expect(text(body)).not.toContain("Parse a document");
    expect(text(body)).not.toContain("Saved values");
    expect(tablesQueried).not.toContain("run_documents");
  });

  it("AC-DOCAI-01: менеджер рану A бачить блок: поле тексту, «Upload a text file» і «Propose values»", async () => {
    const body = await page();
    const block = body.querySelector('[data-testid="parse-document"]');
    expect(text(block)).toContain("Parse a document");
    expect(block?.querySelector("textarea")).not.toBeNull();
    expect(text(block)).toContain("Upload a text file");
    expect(text(block)).toContain("Propose values");
    expect(rpc).toHaveBeenCalledWith("can_parse_documents", { p_run_id: RUN_12 });
  });
});

describe("збережені значення на сторінці рану", () => {
  it("AC-DOCAI-04: запис — Maintenance request, 555-0101, plumbing, urgent, email A і «12 Nov 2026, 10:15»", async () => {
    expect(formatConfirmedAt("2026-11-12T08:15:00Z")).toBe("12 Nov 2026, 10:15");
    documents = [urgentTap];
    const body = await page();
    const records = [...body.querySelectorAll('[data-testid="saved-document"]')];
    expect(records).toHaveLength(1);
    const record = text(records[0]);
    for (const part of ["Maintenance request", "555-0101", "dripping for three days", "plumbing", "urgent", "manager-a@example.test", "12 Nov 2026, 10:15"]) {
      expect(record).toContain(part);
    }
    // Найновіші першими (припущення PM): порядок задає запит, а не сторінка.
    expect(orders).toContainEqual(["run_documents", "confirmed_at", { ascending: false }]);
  });

  it("AC-DOCAI-13: запис, заповнений вручну лише з телефоном, — решта значень «not found»", async () => {
    documents = [{ ...urgentTap, description: null, category: null, urgency: null, phone: "555-0102", confirmed_by: ADMIN }];
    const record = text((await page()).querySelector('[data-testid="saved-document"]'));
    expect(record).toContain("555-0102");
    expect(record.match(/not found/g)).toHaveLength(3);
    expect(record).toContain("admin@example.test");
  });

  it("AC-DOCAI-08: кошторис — позиції й Total як збережено", async () => {
    documents = [
      {
        ...urgentTap,
        document_type: "estimate",
        phone: null,
        description: null,
        category: null,
        urgency: null,
        items: [
          { name: "Inspection", quantity: 1, unitPrice: 90 },
          { name: "Labour", quantity: 2, unitPrice: 60 },
        ],
        total: 200,
      },
    ];
    const record = text((await page()).querySelector('[data-testid="saved-document"]'));
    for (const part of ["Estimate", "Inspection", "90.00", "Labour", "60.00", "Total", "200.00"]) expect(record).toContain(part);
    expect(record).not.toContain("Phone");
  });

  it("AC-DOCAI-04: база не віддала записи (помилка запиту) — сторінка падає з помилкою, а не показує «записів немає»", async () => {
    documentsError = { message: "connection reset" };
    await expect(page()).rejects.toThrow(/run_documents/);
  });

  it("записів немає — картки «Saved values» немає (порожнього стану PM не задає)", async () => {
    expect(text(await page())).not.toContain("Saved values");
  });
});
