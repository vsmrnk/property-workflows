import { describe, expect, it } from "vitest";
import { canMarkDone, countProgress, formatProgress, progressOf } from "@/lib/runs/progress";
import { MESSAGES, messageFor } from "@/lib/runs/messages";

const fiveTasksTwoDone = [
  { status: "done" },
  { status: "done" },
  { status: "to_do" },
  { status: "to_do" },
  { status: "to_do" },
];

describe("progress", () => {
  it("AC-TASK-05: ран з 5 задачами, 2 «done» — «2 of 5 done»", () => {
    expect(progressOf(fiveTasksTwoDone)).toBe("2 of 5 done");
  });

  it("AC-TASK-09: прогрес у списку ранів рахує всі задачі, обов'язкові й ні", () => {
    expect(countProgress(fiveTasksTwoDone)).toEqual({ done: 2, total: 5 });
    expect(formatProgress(2, 5)).toBe("2 of 5 done");
    expect(formatProgress(0, 4)).toBe("0 of 4 done");
  });
});

describe("who can mark a task as done", () => {
  const run = { manager_id: "A" };
  const task = { assignee_id: "B", status: "to_do" };

  it("AC-TASK-01: виконавець B може позначити свою задачу", () => {
    expect(canMarkDone(task, run, { id: "B", role: "manager" })).toBe(true);
  });

  it("AC-TASK-02: менеджер рану A може позначити задачу виконавця B", () => {
    expect(canMarkDone(task, run, { id: "A", role: "manager" })).toBe(true);
  });

  it("AC-TASK-03: сторонній менеджер C не може — повідомлення PM дослівно", () => {
    expect(canMarkDone(task, run, { id: "C", role: "manager" })).toBe(false);
    expect(MESSAGES.NOT_ALLOWED).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
    expect(messageFor("NOT_ALLOWED")).toBe(MESSAGES.NOT_ALLOWED);
  });

  it("AC-TASK-07: адміністратор, який не створював ран, може позначити задачу", () => {
    expect(canMarkDone(task, run, { id: "X", role: "admin" })).toBe(true);
  });
});
