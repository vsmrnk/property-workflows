import { describe, expect, it } from "vitest";
import { validateCaseName } from "@/lib/runs/case-name";
import { MESSAGES, messageFor } from "@/lib/runs/messages";

describe("case name", () => {
  it("AC-RUN-03: порожня назва чи з самих пробілів — «Enter a case name»", () => {
    for (const raw of ["", "   ", undefined, null]) {
      const result = validateCaseName(raw);
      expect(result).toEqual({ ok: false, code: "CASE_NAME_REQUIRED" });
    }
    expect(MESSAGES.CASE_NAME_REQUIRED).toBe("Enter a case name");
    expect(messageFor('ERROR: CASE_NAME_REQUIRED')).toBe("Enter a case name");
  });

  it("AC-RUN-07: 101 символ — «Case name must be at most 100 characters», 100 — дозволено", () => {
    expect(validateCaseName("x".repeat(101))).toEqual({ ok: false, code: "CASE_NAME_TOO_LONG" });
    expect(validateCaseName("x".repeat(100))).toEqual({ ok: true, value: "x".repeat(100) });
    expect(messageFor("CASE_NAME_TOO_LONG")).toBe("Case name must be at most 100 characters");
    // 100 emoji — 100 символів (як char_length у базі), хоча в UTF-16 це 200 одиниць.
    expect(validateCaseName("🏠".repeat(100)).ok).toBe(true);
    expect(validateCaseName("🏠".repeat(101))).toEqual({ ok: false, code: "CASE_NAME_TOO_LONG" });
  });

  it("AC-RUN-01: коректна назва кейсу обрізається й приймається", () => {
    expect(validateCaseName("  Apartment 12, move-in  ")).toEqual({ ok: true, value: "Apartment 12, move-in" });
  });
});
