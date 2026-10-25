// @vitest-environment happy-dom
// Редактор шаблону (design.md impl-template-versions, U3, U5, A2): що бачить користувач і що роблять дії. Клієнт
// Supabase підмінений і записує виклики; права в самій базі — tests/db/template-versions-db.test.ts.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSection,
  addTask,
  moveSection,
  moveTask,
  removeSection,
  removeTask,
  renameSection,
  renameTask,
  saveVersion,
  setTaskRequired,
} from "@/app/templates/[id]/edit/actions";
import EditTemplatePage from "@/app/templates/[id]/edit/page";

let role = "admin";
let rpcResult: { data: unknown; error: { message: string } | null } = { data: 2, error: null };
const calls: string[] = [];
const working = {
  template: { id: "tpl", name: "Tenant move-in", current_version: 1, has_unpublished_changes: true },
  sections: [
    { id: "s1", name: "Before move-in", position: 1 },
    { id: "s2", name: "Move-in day", position: 2 },
  ],
  tasks: [
    ...["Inspect the unit", "Prepare the lease", "Order cleaning"].map((name, i) => ({ id: `a${i}`, section_id: "s1", name, required: i < 2, position: i + 1 })),
    ...["Hand over the keys", "Record meter readings", "Sign handover act"].map((name, i) => ({ id: `b${i}`, section_id: "s2", name, required: i === 0, position: i + 1 })),
  ],
};

function query(table: string) {
  calls.push(`from:${table}`);
  const rows = () =>
    table === "profiles"
      ? [{ email: `${role}@example.test`, role }]
      : table === "templates"
        ? [working.template]
        : table === "template_sections"
          ? working.sections
          : table === "template_tasks"
            ? working.tasks
            : [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: (row: unknown) => {
      calls.push(`insert:${table}:${JSON.stringify(row)}`);
      return builder;
    },
    update: () => {
      calls.push(`update:${table}`);
      return builder;
    },
    delete: () => {
      calls.push(`delete:${table}`);
      return builder;
    },
    maybeSingle: async () => ({ data: rows()[0] ?? null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows(), error: null }),
  };
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u", email: `${role}@example.test` } } }) },
    from: (table: string) => query(table),
    rpc: async (name: string) => {
      calls.push(`rpc:${name}`);
      return rpcResult;
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/templates",
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const editorPage = async () => {
  document.body.innerHTML = renderToStaticMarkup(await EditTemplatePage({ params: Promise.resolve({ id: "tpl" }) } as never));
  return document.body;
};
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const writes = () => calls.filter((c) => /^(insert|update|delete|rpc):/.test(c));

beforeEach(() => {
  calls.length = 0;
  rpcResult = { data: 2, error: null };
});

describe("template editor", () => {
  it("AC-EDITOR-01: дія додає задачу в робочу копію; редактор показує «Unpublished changes» і 6 задач", async () => {
    role = "admin";
    await addTask("tpl", "s2", form({ name: "Sign handover act" }));
    expect(writes().some((c) => c.startsWith('insert:template_tasks:') && c.includes('"name":"Sign handover act"'))).toBe(true);

    const body = await editorPage();
    expect(body.querySelector('[data-testid="unpublished"]')?.textContent).toBe("Unpublished changes");
    expect(body.querySelectorAll('[data-testid="editor-task"]')).toHaveLength(6);
  });

  it("AC-EDITOR-03: «Save» створює версію — «Version 2 saved»", async () => {
    role = "admin";
    expect(await saveVersion("tpl")).toEqual({ saved: "Version 2 saved" });
    expect(calls).toContain("rpc:save_template_version");
  });

  it("AC-EDITOR-04: «Save» шаблону без обов'язкової задачі — «A template needs at least one required task»", async () => {
    role = "admin";
    rpcResult = { data: null, error: { message: "NO_REQUIRED_TASK" } };
    expect(await saveVersion("tpl")).toEqual({ error: "A template needs at least one required task" });
  });

  it("AC-EDITOR-08: дії менеджера нічого не пишуть і не зберігають версію", async () => {
    role = "manager";
    const hacked = () => form({ name: "Hacked" });
    await addSection("tpl", hacked());
    await renameSection("tpl", "s1", hacked());
    await moveSection("tpl", "s1", "down");
    await addTask("tpl", "s2", hacked());
    await renameTask("tpl", "a0", hacked());
    await setTaskRequired("tpl", "a0", false);
    await moveTask("tpl", "s1", "a0", "down");
    await removeTask("tpl", "a0");
    await removeSection("tpl", "s1");
    expect(await saveVersion("tpl")).toEqual({ error: "Not enough rights" });
    expect(writes()).toEqual([]);
  });

  it("AC-DSYS-02: менеджер за прямим посиланням на редактор — «Not enough rights» і «Back to templates», без вмісту редактора", async () => {
    role = "manager";
    const body = await editorPage();
    expect(body.querySelector('[data-testid="access-denied"] h1')?.textContent).toBe("Not enough rights");
    expect(body.querySelector('[data-testid="access-denied"] a[href="/templates"]')?.textContent).toBe("Back to templates");
    expect(body.querySelectorAll('[data-testid="editor-section"], [data-testid="editor-task"]')).toHaveLength(0);
    // У тому самому каркасі (сайдбар і хедер) і без жодного запиту до шаблону.
    expect(body.querySelector('nav[aria-label="Main"]')).not.toBeNull();
    expect(calls.filter((c) => /^from:template/.test(c))).toEqual([]);
    expect(writes()).toEqual([]);
  });
});
