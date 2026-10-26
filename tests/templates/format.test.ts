// Тексти списку шаблонів: однина й множина в зведенні поточної версії.
import { describe, expect, it } from "vitest";
import { taskSummary } from "@/lib/templates/format";

describe("templates format", () => {
  it("AC-EDITOR-02: зведення поточної версії в списку шаблонів — «1 task» в однині, «5 tasks» у множині", () => {
    expect(taskSummary(1, 1)).toBe("1 task · 1 required");
    expect(taskSummary(5, 3)).toBe("5 tasks · 3 required");
  });
});
