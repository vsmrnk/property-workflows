// Server actions: що саме бачить користувач (тексти PM дослівно) і що до бази не йде запит на некоректних даних.
// Закриває знахідки /opsx:verify #1 і #4 (AC-RUN-03, AC-RUN-07, AC-TASK-03).
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, auth: { getClaims } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { launchRun } = await import("@/app/runs/actions");
const { markTaskDone } = await import("@/app/runs/[id]/actions");

const TEMPLATE = "10000000-0000-0000-0000-000000000001";
const RUN = "6b6a73ab-7180-434a-ab55-0920f16e7317";
const TASK = "7c6a73ab-7180-434a-ab55-0920f16e7317";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  rpc.mockReset();
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
});

describe("launchRun", () => {
  it("без входу (немає claims) — «Sign in again», launch_run не викликано (ADR 0002)", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const state = await launchRun({}, form({ templateId: TEMPLATE, caseName: "Apartment 12, move-in" }));
    expect(state).toEqual({ error: "Sign in again", caseName: "Apartment 12, move-in" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-RUN-03: порожня назва чи з пробілів — користувач бачить «Enter a case name», launch_run не викликано", async () => {
    for (const caseName of ["", "   "]) {
      const state = await launchRun({}, form({ templateId: TEMPLATE, caseName }));
      expect(state.error).toBe("Enter a case name");
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-RUN-07: 101 символ — «Case name must be at most 100 characters», launch_run не викликано", async () => {
    const state = await launchRun({}, form({ templateId: TEMPLATE, caseName: "x".repeat(101) }));
    expect(state.error).toBe("Case name must be at most 100 characters");
    expect(state.caseName).toBe("x".repeat(101));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-RUN-07: якщо межу перевірила база (CASE_NAME_TOO_LONG), користувач бачить той самий текст PM", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "CASE_NAME_TOO_LONG" } });
    const state = await launchRun({}, form({ templateId: TEMPLATE, caseName: "Apartment 12, move-in" }));
    expect(state.error).toBe("Case name must be at most 100 characters");
  });

  it("AC-RUN-04: виконавці з форми передаються в launch_run, «Me» (порожнє) — ні", async () => {
    rpc.mockResolvedValue({ data: RUN, error: null });
    await expect(
      launchRun(
        {},
        form({
          templateId: TEMPLATE,
          caseName: "  Apartment 12, move-in ",
          "assignee:t1": "user-b",
          "assignee:t2": "user-b",
          "assignee:t3": "",
        }),
      ),
    ).rejects.toThrow(`REDIRECT:/runs/${RUN}`);
    expect(rpc).toHaveBeenCalledWith("launch_run", {
      p_template_id: TEMPLATE,
      p_case_name: "Apartment 12, move-in",
      p_assignments: { t1: "user-b", t2: "user-b" },
    });
  });
});

describe("markTaskDone", () => {
  it("AC-TASK-03: відмова бази (NOT_ALLOWED) — користувач бачить повідомлення PM дослівно", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "NOT_ALLOWED" } });
    const state = await markTaskDone(RUN, TASK);
    expect(state.error).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
    expect(rpc).toHaveBeenCalledWith("mark_task_done", { p_task_id: TASK });
  });

  it("AC-TASK-03: некоректний id задачі — та сама відмова, без запиту до бази", async () => {
    const state = await markTaskDone(RUN, "not-a-uuid");
    expect(state.error).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-TASK-01: успішна позначка — без помилки", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await markTaskDone(RUN, TASK)).toEqual({});
  });
});
