// @vitest-environment happy-dom
// Редактор шаблону в браузері (impl-template-versions-2 U4): підтвердження видалення секції й стан змін. Дії сервера
// підмінені: тест перевіряє, що бачить адміністратор і чи редактор надсилає дію, а не базу.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addTask, removeSection } from "@/app/templates/[id]/edit/actions";
import { Editor } from "@/app/templates/[id]/edit/editor";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/app/templates/[id]/edit/actions", () => ({
  addSection: vi.fn(async () => {}),
  addTask: vi.fn(async () => {}),
  moveTaskToSection: vi.fn(async () => {}),
  removeSection: vi.fn(async () => {}),
  removeTask: vi.fn(async () => {}),
  renameSection: vi.fn(async () => {}),
  renameTask: vi.fn(async () => {}),
  renameTemplate: vi.fn(async () => {}),
  reorderSections: vi.fn(async () => {}),
  reorderTasks: vi.fn(async () => {}),
  setTaskRequired: vi.fn(async () => {}),
}));

const sections = [
  { id: "s1", name: "Before move-in" },
  { id: "s2", name: "Move-in day" },
];
const tasks = [
  { id: "a0", section_id: "s1", name: "Inspect the unit", required: true },
  { id: "a1", section_id: "s1", name: "Prepare the lease", required: true },
  { id: "b0", section_id: "s2", name: "Hand over the keys", required: true },
  { id: "b1", section_id: "s2", name: "Record meter readings", required: false },
  { id: "b2", section_id: "s2", name: "Order cleaning", required: false },
];

const renderEditor = () =>
  render(
    <TooltipProvider>
      <Editor templateId="tpl" name="Tenant move-in" sections={sections} tasks={tasks} />
    </TooltipProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("template editor in the browser", () => {
  it("AC-EDITOR-13: скасування видалення «Move-in day» — підтвердження з назвою й «This cannot be undone», секція і 3 задачі лишаються", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Remove section “Move-in day”" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Move-in day");
    expect(dialog.textContent).toContain("This cannot be undone");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(removeSection).not.toHaveBeenCalled();
    const moveIn = screen.getAllByTestId("editor-section").find((s) => s.getAttribute("aria-label") === "Move-in day");
    expect(moveIn).toBeTruthy();
    expect(within(moveIn!).getAllByTestId("editor-task")).toHaveLength(3);
  });

  it("AC-EDITOR-14: підтверджене видалення «Move-in day» — редактор надсилає видалення саме цієї секції", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Remove section “Move-in day”" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeSection).toHaveBeenCalledWith("tpl", "s2"));
  });

  it("AC-EDITOR-25: зміну не збережено — «Your last change was not kept. Try again.» на місці стану, задача лишається в полі", async () => {
    vi.mocked(addTask).mockRejectedValueOnce(new Error("network"));
    renderEditor();
    expect(screen.getByTestId("keep-status").textContent).toBe("All changes kept");

    const field = screen.getByLabelText("New task in Move-in day") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "Sign handover act" } });
    fireEvent.submit(field.closest("form")!);

    await waitFor(() => expect(screen.getByTestId("keep-status").textContent).toBe("Your last change was not kept. Try again."));
    expect(screen.getByTestId("keep-status").getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("keep-status").className).toContain("text-destructive");
    expect(field.value).toBe("Sign handover act");
  });

  it("AC-EDITOR-25: паралельна зміна, збережена пізніше, не ховає «Your last change was not kept. Try again.»", async () => {
    let finishSlow!: () => void;
    vi.mocked(addTask)
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishSlow = resolve)))
      .mockRejectedValueOnce(new Error("network"));
    renderEditor();

    const slow = screen.getByLabelText("New task in Before move-in") as HTMLInputElement;
    fireEvent.change(slow, { target: { value: "Check smoke alarms" } });
    fireEvent.submit(slow.closest("form")!);
    const failing = screen.getByLabelText("New task in Move-in day") as HTMLInputElement;
    fireEvent.change(failing, { target: { value: "Sign handover act" } });
    fireEvent.submit(failing.closest("form")!);
    await waitFor(() => expect(screen.getByTestId("keep-status").textContent).toBe("Your last change was not kept. Try again."));

    await act(async () => finishSlow());
    expect(screen.getByTestId("keep-status").textContent).toBe("Your last change was not kept. Try again.");
  });
});
