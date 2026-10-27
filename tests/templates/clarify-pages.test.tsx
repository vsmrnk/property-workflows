// @vitest-environment happy-dom
// Сторінки уточнення зрізу 2 (impl-template-versions-2 U1–U3): сторінка шаблону для менеджера, порожні стани, вибір
// шаблону у формі запуску, назва шаблону в рані. Клієнт Supabase підмінений; права в базі — tests/db.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RunPage from "@/app/runs/[id]/page";
import NewRunPage from "@/app/runs/new/page";
import TemplatePage from "@/app/templates/[id]/page";
import TemplateVersionsPage from "@/app/templates/[id]/versions/page";
import TemplatesPage from "@/app/templates/page";

let role = "manager";
let data: Record<string, unknown[]> = {};

const PUBLISHED = [
  {
    name: "Before move-in",
    position: 1,
    tasks: [
      { id: "a0", name: "Inspect the unit", required: true, position: 1 },
      { id: "a1", name: "Prepare the lease", required: true, position: 2 },
      { id: "a2", name: "Order cleaning", required: false, position: 3 },
    ],
  },
  {
    name: "Move-in day",
    position: 2,
    tasks: [
      { id: "b0", name: "Hand over the keys", required: true, position: 1 },
      { id: "b1", name: "Record meter readings", required: false, position: 2 },
    ],
  },
];

function query(table: string) {
  const rows = () => (table === "profiles" ? [{ email: `${role}@example.test`, role }] : (data[table] ?? []));
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

const render = async (node: Promise<React.ReactNode> | React.ReactNode) => {
  document.body.innerHTML = renderToStaticMarkup(await node);
  return document.body;
};
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p), searchParams: Promise.resolve({}) }) as never;

beforeEach(() => {
  data = {};
});

describe("template pages (уточнення)", () => {
  it("AC-EDITOR-02: менеджер зі списку відкриває шаблон — версія 1 з 5 задачами, кожна «required» чи «optional», без позначки змін", async () => {
    role = "manager";
    data.templates = [
      { id: "tpl", name: "Tenant move-in", current_version: 1, has_unpublished_changes: false, published_sections: PUBLISHED },
    ];
    const list = await render(TemplatesPage());
    expect(list.querySelector('a[href="/templates/tpl"]')?.textContent).toBe("Tenant move-in");

    const body = await render(TemplatePage(params({ id: "tpl" })));
    expect(body.querySelector('[data-testid="template-version"]')?.textContent).toContain("Version 1");
    const tags = [...body.querySelectorAll('[data-testid="template-task"] [data-testid="task-requirement"]')].map((n) => n.textContent);
    expect(tags).toEqual(["required", "required", "optional", "required", "optional"]);
    expect(body.textContent).not.toContain("Unpublished changes");
    expect(body.querySelector('a[href="/runs/new?template=tpl"]')?.textContent).toContain("Launch");
  });

  it("AC-EDITOR-16: менеджер за прямим посиланням на «Repair» без версії — «Template not found», без секцій і задач", async () => {
    role = "manager";
    // RLS не віддає менеджеру шаблону без версії.
    data.templates = [];
    const body = await render(TemplatePage(params({ id: "repair" })));
    expect(body.querySelector('[data-testid="template-not-found"]')?.textContent).toBe("Template not found");
    expect(body.querySelectorAll('[data-testid="template-section"], [data-testid="template-task"]')).toHaveLength(0);
  });

  it("AC-EDITOR-17: менеджер без збережених шаблонів — «No templates yet. An administrator creates them.», без таблиці", async () => {
    role = "manager";
    data.templates = [];
    const body = await render(TemplatesPage());
    expect(body.querySelector('[data-testid="templates-empty"]')?.textContent).toBe("No templates yet. An administrator creates them.");
    expect(body.querySelector('[data-testid="templates"]')).toBeNull();
  });

  it("AC-EDITOR-18: список версій «Repair» без версій — «No versions yet. Save the template to create version 1.», без таблиці", async () => {
    role = "admin";
    data.templates = [{ id: "repair", name: "Repair" }];
    data.template_versions = [];
    const body = await render(TemplateVersionsPage(params({ id: "repair" })));
    expect(body.querySelector('[data-testid="versions-empty"]')?.textContent).toBe("No versions yet. Save the template to create version 1.");
    expect(body.querySelector('[data-testid="versions"]')).toBeNull();
  });

  it("AC-EDITOR-10: адміністратор у формі запуску бачить «Repair» недоступним із «Save the template to launch it»", async () => {
    role = "admin";
    data.templates = [
      { id: "repair", name: "Repair", current_version: null },
      { id: "tpl", name: "Tenant move-in", current_version: 1 },
    ];
    const body = await render(NewRunPage({ searchParams: Promise.resolve({}) } as never));
    const rows = [...body.querySelectorAll('[data-testid="launch-template"]')];
    const repair = rows.find((r) => r.textContent?.includes("Repair"))!;
    expect(repair.querySelector('[data-testid="launch-unavailable"]')?.textContent).toBe("Save the template to launch it");
    expect(repair.querySelector("a")).toBeNull();
    expect(repair.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    const tenant = rows.find((r) => r.textContent?.includes("Tenant move-in"))!;
    expect(tenant.querySelector('a[href="/runs/new?template=tpl"]')).not.toBeNull();
  });

  it("AC-EDITOR-22: сторінка рану показує назву шаблону з версії запуску, а не поточну", async () => {
    role = "manager";
    data.runs = [
      { id: "run", case_name: "Apartment 12, move-in", status: "in_progress", manager_id: "u", created_at: "2026-10-20T08:00:00Z", template_version: 1, template_name: "Tenant move-in" },
    ];
    data.run_tasks = [];
    data.templates = [{ id: "tpl", name: "Tenant move-in (2026)" }];
    const body = await render(RunPage(params({ id: "run" })));
    expect(body.textContent).toContain("Tenant move-in");
    expect(body.textContent).not.toContain("Tenant move-in (2026)");
  });
});
