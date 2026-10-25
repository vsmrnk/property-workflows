// @vitest-environment happy-dom
// Сторінки версій (design.md impl-template-versions, U4–U6): що бачить користувач — список версій адміністратора,
// відмова менеджеру, «Template version N» на сторінці рану. Клієнт Supabase підмінений; права в базі — tests/db.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RunPage from "@/app/runs/[id]/page";
import TemplateVersionsPage from "@/app/templates/[id]/versions/page";
import { formatSavedAt } from "@/lib/templates/format";

let role = "admin";
const tablesQueried: string[] = [];
const data: Record<string, unknown[]> = {
  profiles: [],
  templates: [{ id: "tpl", name: "Tenant move-in" }],
  template_versions: [
    { number: 2, created_at: "2026-10-12T11:05:00Z", author: { email: "admin-c@example.test" } },
    { number: 1, created_at: "2026-10-05T06:30:00Z", author: { email: "admin-a@example.test" } },
  ],
  runs: [
    { id: "run", case_name: "Apartment 12, move-in", status: "in_progress", manager_id: "u", created_at: "2026-10-20T08:00:00Z", template_version: 1, templates: { name: "Tenant move-in" } },
  ],
  run_tasks: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, section_name: "Before move-in", section_position: 1, name: `Task ${i + 1}`, required: i < 3, position: i, assignee_id: "u", status: "to_do" })),
};

function query(table: string) {
  tablesQueried.push(table);
  const rows = () => (table === "profiles" ? [{ email: `${role}@example.test`, role }] : data[table]);
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data: rows()[0] ?? null }),
    then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: rows() }),
  };
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u", email: `${role}@example.test` } } }) },
    from: (table: string) => query(table),
    rpc: async () => ({ data: [{ id: "u", email: "manager-a@example.test" }] }),
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/templates",
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const render = async (node: Promise<React.ReactNode>) => {
  document.body.innerHTML = renderToStaticMarkup(await node);
  return document.body;
};
const versionsPage = () => TemplateVersionsPage({ params: Promise.resolve({ id: "tpl" }) } as never);

beforeEach(() => {
  tablesQueried.length = 0;
});

describe("template versions pages", () => {
  it("AC-EDITOR-06: ран, запущений до версіонування, не показує вигаданого номера версії", async () => {
    role = "manager";
    const run = data.runs[0] as { template_version: number | null };
    run.template_version = null;
    try {
      const body = await render(RunPage({ params: Promise.resolve({ id: "run" }) } as never));
      expect(body.querySelector('[data-testid="run-template-version"]')?.textContent).toBe("Launched before template versions");
    } finally {
      run.template_version = 1;
    }
  });

  it("AC-EDITOR-05: версія 2 першою з «12.10.2026 14:05» і email C, версія 1 другою з «05.10.2026 09:30» і email A", async () => {
    expect(formatSavedAt("2026-10-12T11:05:00Z")).toBe("12.10.2026 14:05");
    expect(formatSavedAt("2026-10-05T06:30:00Z")).toBe("05.10.2026 09:30");

    role = "admin";
    const body = await render(versionsPage());
    const rows = [...body.querySelectorAll('[data-testid="version"]')].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim()),
    );
    expect(rows).toEqual([
      ["Version 2", "12.10.2026 14:05", "admin-c@example.test"],
      ["Version 1", "05.10.2026 09:30", "admin-a@example.test"],
    ]);
  });

  it("AC-EDITOR-07: менеджер за прямим посиланням на список версій — «Not enough rights», жодної версії", async () => {
    role = "manager";
    const body = await render(versionsPage());
    expect(body.querySelector('[data-testid="access-denied"] h1')?.textContent).toBe("Not enough rights");
    expect(body.querySelector('[data-testid="access-denied"] a[href="/templates"]')?.textContent).toBe("Back to templates");
    expect(body.querySelectorAll('[data-testid="version"]')).toHaveLength(0);
    // Сторінка не запитує версій для менеджера.
    expect(tablesQueried).not.toContain("template_versions");
  });

  it("AC-EDITOR-06: сторінка рану, запущеного з версії 1, показує «Template version 1» і 5 задач", async () => {
    role = "manager";
    const body = await render(RunPage({ params: Promise.resolve({ id: "run" }) } as never));
    expect(body.querySelector('[data-testid="run-template-version"]')?.textContent).toBe("Template version 1");
    expect(body.querySelectorAll('[data-testid="run-task"]')).toHaveLength(5);
  });
});
