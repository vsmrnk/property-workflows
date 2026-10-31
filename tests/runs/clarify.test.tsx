// @vitest-environment happy-dom
// Уточнення 2026-10-20 (clarify-run-launch): правила інтерфейсу як чисті функції, розмітка сторінок і компоненти,
// які бачить користувач (кнопка «Mark as done» з підтвердженням, тег «required»/«optional»).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequirementTag } from "@/app/_components/ui";
import { markTaskDone } from "@/app/runs/[id]/actions";
import { MarkDoneButton } from "@/app/runs/[id]/mark-done-button";
import RunNotFound from "@/app/runs/[id]/not-found";
import { CONFIRM_NOTICE, canMarkDone, groupBySection, needsConfirmation, requirementLabel } from "@/lib/runs/progress";

// Дія сервера підмінена: тест перевіряє, чи кнопка її надсилає, а не базу.
// eslint-disable-next-line no-restricted-syntax -- Server Action — мережева межа (POST-ендпойнт); тест перевіряє UI компонента, а саму дію — tests/runs/actions.test.ts, tests/templates/editor.test.tsx і SQL/RLS у tests/db/
vi.mock("@/app/runs/[id]/actions", () => ({ markTaskDone: vi.fn(async () => ({})) }));

const RUN = "00000000-0000-4000-8000-000000000001";
const TASK = "00000000-0000-4000-8000-000000000002";

afterEach(() => {
  cleanup();
  vi.mocked(markTaskDone).mockClear();
});

const t = (id: string, required: boolean, status: "to_do" | "done") => ({ id, required, status });

describe("confirmation for the last required task", () => {
  it("AC-TASK-04: третя (остання) обов'язкова задача — позначення лише після підтвердження з «This cannot be undone»", async () => {
    const tasks = [t("r1", true, "done"), t("r2", true, "done"), t("r3", true, "to_do"), t("o1", false, "to_do"), t("o2", false, "to_do")];
    expect(needsConfirmation(tasks[2], tasks)).toBe(true);
    expect(CONFIRM_NOTICE).toBe("This cannot be undone");

    // Те, що бачить користувач: спершу питання з назвою задачі й «This cannot be undone», дія — лише після «Confirm».
    render(<MarkDoneButton runId={RUN} taskId={TASK} taskName="Hand over the keys" confirm />);
    fireEvent.click(screen.getByRole("button", { name: "Mark “Hand over the keys” as done" }));
    expect(markTaskDone).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Mark “Hand over the keys” as done?");
    expect(dialog.textContent).toContain("This cannot be undone");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(markTaskDone).toHaveBeenCalledTimes(1));
    expect(vi.mocked(markTaskDone).mock.calls[0].slice(0, 2)).toEqual([RUN, TASK]);
  });

  it("AC-TASK-16: підтвердження потрібне лише для останньої обов'язкової — скасування не змінює задачу (кнопка не надсилає дію)", () => {
    const tasks = [t("r1", true, "done"), t("r2", true, "done"), t("r3", true, "to_do")];
    expect(needsConfirmation(tasks[2], tasks)).toBe(true);
    // Інші задачі підтвердження не просять.
    expect(needsConfirmation(tasks[0], tasks)).toBe(false);

    // «Cancel» на підтвердженні: дію не надіслано, питання закрито, кнопка «Mark as done» знову на місці.
    render(<MarkDoneButton runId={RUN} taskId={TASK} taskName="Hand over the keys" confirm />);
    fireEvent.click(screen.getByRole("button", { name: "Mark “Hand over the keys” as done" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("This cannot be undone");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(markTaskDone).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Mark “Hand over the keys” as done" })).toBeTruthy();
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
    expect(flags.map(requirementLabel)).toEqual(["required", "required", "required", "optional", "optional"]);
    // Те, що бачить користувач: сам тег, який рендерить сторінка рану.
    const html = flags.map((required) => renderToStaticMarkup(<RequirementTag required={required} />)).join("");
    expect(html.match(/>required</g)).toHaveLength(3);
    expect(html.match(/>optional</g)).toHaveLength(2);
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
