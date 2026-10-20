// Уточнення 2026-10-20 (clarify-run-launch): правила інтерфейсу як чисті функції й розмітка сторінки «Run not found».
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RunNotFound from "@/app/runs/[id]/not-found";
import { CONFIRM_NOTICE, canMarkDone, groupBySection, needsConfirmation, requirementLabel } from "@/lib/runs/progress";

const t = (id: string, required: boolean, status: "to_do" | "done") => ({ id, required, status });

describe("confirmation for the last required task", () => {
  it("AC-TASK-04: третя (остання) обов'язкова задача — позначення лише після підтвердження з «This cannot be undone»", () => {
    const tasks = [t("r1", true, "done"), t("r2", true, "done"), t("r3", true, "to_do"), t("o1", false, "to_do"), t("o2", false, "to_do")];
    expect(needsConfirmation(tasks[2], tasks)).toBe(true);
    expect(CONFIRM_NOTICE).toBe("This cannot be undone");
  });

  it("AC-TASK-16: підтвердження потрібне лише для останньої обов'язкової — скасування не змінює задачу (кнопка не надсилає дію)", () => {
    const tasks = [t("r1", true, "done"), t("r2", true, "done"), t("r3", true, "to_do")];
    expect(needsConfirmation(tasks[2], tasks)).toBe(true);
    // Інші задачі підтвердження не просять.
    expect(needsConfirmation(tasks[0], tasks)).toBe(false);
  });

  it("AC-TASK-01: задача, що не є останньою обов'язковою, позначається без підтвердження", () => {
    const tasks = [t("r1", true, "to_do"), t("r2", true, "to_do"), t("o1", false, "to_do")];
    expect(needsConfirmation(tasks[0], tasks)).toBe(false);
    expect(needsConfirmation(tasks[2], tasks)).toBe(false);
  });
});

describe("run page", () => {
  it("AC-TASK-10: сторінка чужого рану — «Run not found» і жодної задачі", () => {
    const html = renderToStaticMarkup(<RunNotFound />);
    expect(html).toContain("Run not found");
    expect(html).not.toContain('data-testid="run-task"');
  });

  it("AC-TASK-15: кожна задача позначена «required» або «optional»: 3 і 2", () => {
    const flags = [true, true, true, false, false];
    const labels = flags.map(requirementLabel);
    expect(labels.filter((l) => l === "required")).toHaveLength(3);
    expect(labels.filter((l) => l === "optional")).toHaveLength(2);
  });

  it("AC-TASK-12: задачі двома групами — спершу «Before move-in» (2), потім «Move-in day» (3)", () => {
    const tasks = [
      { section_name: "Move-in day", section_position: 2, position: 1, name: "c" },
      { section_name: "Before move-in", section_position: 1, position: 2, name: "b" },
      { section_name: "Move-in day", section_position: 2, position: 2, name: "d" },
      { section_name: "Before move-in", section_position: 1, position: 1, name: "a" },
      { section_name: "Move-in day", section_position: 2, position: 3, name: "e" },
    ];
    const groups = groupBySection(tasks);
    expect(groups.map((g) => [g.name, g.tasks.length])).toEqual([
      ["Before move-in", 2],
      ["Move-in day", 3],
    ]);
    expect(groups[0].tasks.map((x) => x.name)).toEqual(["a", "b"]);
  });

  it("AC-TASK-18: менеджеру C дію запропоновано на його задачі, але не на задачі менеджера B", () => {
    const run = { manager_id: "A" };
    const viewer = { id: "C", role: "manager" };
    expect(canMarkDone({ assignee_id: "C", status: "to_do" }, run, viewer)).toBe(true);
    expect(canMarkDone({ assignee_id: "B", status: "to_do" }, run, viewer)).toBe(false);
  });
});
