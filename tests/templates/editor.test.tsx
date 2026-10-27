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
  moveTaskToSection,
  renameTemplate,
  removeSection,
  removeTask,
  renameSection,
  reorderSections,
  reorderTasks,
  renameTask,
  saveVersion,
  setTaskRequired,
} from "@/app/templates/[id]/edit/actions";
import EditTemplatePage from "@/app/templates/[id]/edit/page";
import { createTemplate } from "@/app/templates/actions";

let role = "admin";
let rpcResult: { data: unknown; error: { message: string } | null } = { data: 2, error: null };
let insertError: { code: string; message: string } | null = null;
const calls: string[] = [];
const working = {
  template: { id: "tpl", name: "Tenant move-in", current_version: 1, has_unpublished_changes: true },
  sections: [
    { id: "s1", template_id: "tpl", name: "Before move-in", position: 1 },
    { id: "s2", template_id: "tpl", name: "Move-in day", position: 2 },
    // Секція іншого шаблону: редактор «tpl» її не бачить, addTask у неї не пише.
    { id: "foreign", template_id: "other-tpl", name: "Other template", position: 1 },
  ],
  tasks: [
    ...["Inspect the unit", "Prepare the lease", "Order cleaning"].map((name, i) => ({ id: `a${i}`, template_id: "tpl", section_id: "s1", name, required: i < 2, position: i + 1 })),
    ...["Hand over the keys", "Record meter readings", "Sign handover act"].map((name, i) => ({ id: `b${i}`, template_id: "tpl", section_id: "s2", name, required: i === 0, position: i + 1 })),
  ],
};

function query(table: string) {
  calls.push(`from:${table}`);
  // .eq() фільтрує рядки, як справжній запит: перевірки належності в діях мають на що спертися.
  const filters: Record<string, unknown> = {};
  let orderBy: { column: string; ascending: boolean } | null = null;
  let limitCount: number | null = null;
  let updateCall = -1;
  const rows = () =>
    table === "profiles"
      ? [{ id: "u", email: `${role}@example.test`, role }]
      : table === "templates"
        ? [working.template]
        : table === "template_sections"
          ? working.sections
          : table === "template_tasks"
            ? working.tasks
            : [];
  // .order() і .limit() — як у справжньому запиті: дія бере саме першу після сортування.
  const matching = () => {
    const found = rows().filter((row) => Object.entries(filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    if (orderBy) {
      const { column, ascending } = orderBy;
      found.sort((a, b) => (Number((a as Record<string, unknown>)[column]) - Number((b as Record<string, unknown>)[column])) * (ascending ? 1 : -1));
    }
    return limitCount === null ? found : found.slice(0, limitCount);
  };
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      if (updateCall >= 0 && column === "id") calls[updateCall] += `@${value}`;
      return builder;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      orderBy = { column, ascending: options?.ascending ?? true };
      return builder;
    },
    limit: (count: number) => {
      limitCount = count;
      return builder;
    },
    insert: (row: unknown) => {
      calls.push(`insert:${table}:${JSON.stringify(row)}`);
      return builder;
    },
    update: (row: unknown) => {
      updateCall = calls.push(`update:${table}:${JSON.stringify(row)}`) - 1;
      return builder;
    },
    upsert: (row: unknown) => {
      calls.push(`upsert:${table}:${JSON.stringify(row)}`);
      return builder;
    },
    delete: () => {
      calls.push(`delete:${table}`);
      return builder;
    },
    maybeSingle: async () => ({ data: matching()[0] ?? null }),
    single: async () => (insertError ? { data: null, error: insertError } : { data: { id: "new-tpl" }, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: matching(), error: null }),
  };
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    // role "anon" — відвідувач без входу: claims немає (AC-EDITOR-26).
    auth: { getClaims: async () => ({ data: { claims: role === "anon" ? null : { sub: "u", email: `${role}@example.test` } } }) },
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
const writes = () => calls.filter((c) => /^(insert|update|upsert|delete|rpc):/.test(c));

beforeEach(() => {
  calls.length = 0;
  rpcResult = { data: 2, error: null };
  insertError = null;
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

  it("AC-EDITOR-01: задача із секцією іншого шаблону не додається", async () => {
    role = "admin";
    await addTask("tpl", "foreign", form({ name: "Foreign task" }));
    expect(writes()).toEqual([]);
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

  it("AC-EDITOR-01: перестановка секцій і задач пише нові позиції лише рядкам, що змінили місце", async () => {
    role = "admin";
    await reorderSections("tpl", ["s2", "s1"]);
    await reorderTasks("tpl", "s1", ["a0", "a2", "a1"]);
    expect(writes()).toEqual([
      'update:template_sections:{"position":1}@s2',
      'update:template_sections:{"position":2}@s1',
      'update:template_tasks:{"position":2}@a2',
      'update:template_tasks:{"position":3}@a1',
    ]);
  });

  it("AC-EDITOR-01: перестановка з чужими, пропущеними чи повтореними id нічого не змінює", async () => {
    role = "admin";
    await reorderSections("tpl", ["s2", "foreign"]);
    await reorderSections("tpl", ["s2"]);
    await reorderTasks("tpl", "s1", ["a0", "a0", "a1"]);
    await reorderTasks("tpl", "s1", ["b0", "a1", "a0"]);
    expect(writes()).toEqual([]);
  });

  it("AC-EDITOR-19: новий шаблон з порожньою назвою чи лише з пробілів — не створено, «Enter a template name»", async () => {
    role = "admin";
    for (const name of ["", "   "]) {
      expect(await createTemplate({}, form({ name }))).toEqual({ error: "Enter a template name", name: "" });
    }
    expect(writes()).toEqual([]);
  });

  it("AC-EDITOR-23: новий шаблон з наявною назвою — «A template with this name already exists», введене лишається", async () => {
    role = "admin";
    // Унікальний індекс lower(btrim(name)) у базі відхиляє вставку з кодом 23505 (tests/db, D6).
    insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    expect(await createTemplate({}, form({ name: " tenant MOVE-IN " }))).toEqual({
      error: "A template with this name already exists",
      name: "tenant MOVE-IN",
    });
  });

  it("AC-EDITOR-15: «Save» з секцією без задач — «Every section needs at least one task»", async () => {
    role = "admin";
    rpcResult = { data: null, error: { message: "EMPTY_SECTION" } };
    expect(await saveVersion("tpl")).toEqual({ error: "Every section needs at least one task" });
  });

  it("AC-EDITOR-20: «Save» із задачею без назви — «Every section and task needs a name»; очищена назва пишеться в робочу копію", async () => {
    role = "admin";
    await renameTask("tpl", "a0", form({ name: "   " }));
    expect(writes()).toEqual(['update:template_tasks:{"name":""}@a0']);
    rpcResult = { data: null, error: { message: "NO_NAME" } };
    expect(await saveVersion("tpl")).toEqual({ error: "Every section and task needs a name" });
  });

  it("AC-EDITOR-21: перейменування шаблону — незбережена зміна в template_drafts, не в назві поточної версії", async () => {
    role = "admin";
    await renameTemplate("tpl", form({ name: " Tenant move-in (2026) " }));
    expect(writes()).toEqual(['upsert:template_drafts:{"template_id":"tpl","name":"Tenant move-in (2026)"}']);
  });

  it("AC-EDITOR-24: «Save» перейменованого шаблону з наявною назвою — «A template with this name already exists»", async () => {
    role = "admin";
    rpcResult = { data: null, error: { message: "DUPLICATE_NAME" } };
    expect(await saveVersion("tpl")).toEqual({ error: "A template with this name already exists" });
  });

  it("AC-EDITOR-28: задача «Hand over the keys» переходить у «Before move-in» останньою; у секцію іншого шаблону — ні", async () => {
    role = "admin";
    await moveTaskToSection("tpl", "b0", "s1");
    // У «Before move-in» 3 задачі — перенесена стає четвертою.
    expect(writes()).toEqual(['update:template_tasks:{"section_id":"s1","position":4}@b0']);
    calls.length = 0;
    await moveTaskToSection("tpl", "b0", "foreign");
    expect(writes()).toEqual([]);
  });

  it("AC-EDITOR-26: відвідувач без входу — дії перенаправляють на вхід і нічого не пишуть", async () => {
    role = "anon";
    await expect(addTask("tpl", "s2", form({ name: "Hacked" }))).rejects.toThrow("REDIRECT:/login");
    await expect(renameTemplate("tpl", form({ name: "Hacked" }))).rejects.toThrow("REDIRECT:/login");
    await expect(removeSection("tpl", "s1")).rejects.toThrow("REDIRECT:/login");
    await expect(saveVersion("tpl")).rejects.toThrow("REDIRECT:/login");
    expect(writes()).toEqual([]);
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
    await reorderSections("tpl", ["s2", "s1"]);
    await reorderTasks("tpl", "s1", ["a2", "a1", "a0"]);
    await renameTemplate("tpl", hacked());
    await moveTaskToSection("tpl", "b0", "s1");
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
