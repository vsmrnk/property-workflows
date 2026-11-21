// Дії блоку «Parse a document» (impl-document-parsing, design.md A1, A2): що бачить людина (тексти PM дослівно) і що
// до моделі чи бази не йде нічого, поки не пройдено вхід, право й перевірку тексту. Клієнт Supabase підмінений; права в
// самій базі доводить tests/db/run-documents-db.test.ts, а модель — офлайн-реплей golden (tests/golden.test.ts).
//
// Дії самі перевіряють вхід (getClaims) і передають решту в src/lib/documents/service.ts. Модель туди передається
// функцією: дія вантажить src/lib/ai/openrouter.ts (server-only) лише на гілці AI, тож тести дій її не торкаються, а
// гілку AI перевіряють тести сервісу з MockLanguageModelV4 на справжніх записах golden.
import { APICallError, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import recordedJson from "../fixtures/golden/recorded.json";
import casesJson from "../fixtures/golden/cases.json";

const rpc = vi.fn();
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, auth: { getClaims } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { proposeValues, saveValues } = await import("@/app/runs/[id]/document-actions");
const { proposeDocument, saveDocument } = await import("@/lib/documents/service");
const { revalidatePath } = await import("next/cache");

const RUN = "6b6a73ab-7180-434a-ab55-0920f16e7312";
const recorded = recordedJson as Record<string, { modelId: string; text: string }>;
const input = (id: string) => (casesJson as { id: string; input: string }[]).find((c) => c.id === id)!.input;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const replay = (id: string) =>
  new MockLanguageModelV4({
    modelId: recorded[id].modelId,
    doGenerate: async () => ({ content: [{ type: "text", text: recorded[id].text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] }),
  });

let canParse = true;
let saveResult: { data: string | null; error: { message: string } | null } = { data: "doc-1", error: null };

function form(text: string) {
  const fd = new FormData();
  fd.set("text", text);
  return fd;
}

const IDLE = { kind: "idle" } as const;
const supabase = () => ({ rpc }) as never;

beforeEach(() => {
  canParse = true;
  saveResult = { data: "doc-1", error: null };
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "can_parse_documents") return { data: canParse, error: null };
    if (fn === "save_run_document") return saveResult;
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  });
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "manager-a" } } });
  vi.mocked(revalidatePath).mockClear();
});

const rpcNames = () => rpc.mock.calls.map((c) => c[0]);

describe("proposeValues — ворота до моделі", () => {
  it("без входу — «Sign in again», до бази й моделі запит не йде", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const state = await proposeValues(RUN, IDLE, form(input("GC-01")));
    expect(state).toMatchObject({ kind: "error", message: "Sign in again" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: вендор V чи менеджер B просить значення напряму — «Not enough rights», жодного значення", async () => {
    canParse = false;
    const state = await proposeValues(RUN, IDLE, form(input("GC-01")));
    expect(state).toMatchObject({ kind: "error", message: "Not enough rights" });
    expect(state).not.toHaveProperty("document");
    // Право — до моделі: інакше чужий запит витрачав би денний ліміт безкоштовної моделі.
    expect(rpcNames()).toEqual(["can_parse_documents"]);
  });

  it("AC-DOCAI-16: ран не за форматом UUID — «Not enough rights» без запиту до бази", async () => {
    const state = await proposeValues("../runs", IDLE, form(input("GC-01")));
    expect(state).toMatchObject({ kind: "error", message: "Not enough rights" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([[""], ["   "], ["\n\t "]])("AC-DOCAI-11: текст «%s» — «Paste the text of a document», значень немає", async (text) => {
    const state = await proposeValues(RUN, IDLE, form(text));
    expect(state).toMatchObject({ kind: "error", message: "Paste the text of a document" });
    expect(state).not.toHaveProperty("document");
  });

  it("текст довший за 20 000 символів — повідомлення про межу, модель не викликано", async () => {
    const state = await proposeValues(RUN, IDLE, form("x".repeat(20_001)));
    expect(state).toMatchObject({ kind: "error", message: "The text is too long (at most 20,000 characters)" });
  });
});

describe("proposeDocument — гілка AI (модель передано параметром)", () => {
  it("AC-DOCAI-01: заявка про кран — Maintenance request, 555-0101, plumbing, not urgent; нічого не збережено", async () => {
    const state = await proposeDocument(supabase(), RUN, input("GC-01"), () => replay("GC-01"));
    expect(state).toMatchObject({
      kind: "proposed",
      document: { documentType: "maintenance_request", phone: "555-0101", category: "plumbing", urgency: "not urgent" },
    });
    expect(rpcNames()).not.toContain("save_run_document");
  });

  it("AC-DOCAI-09: меню — «This document is not a maintenance request or an estimate.», значень немає", async () => {
    const state = await proposeDocument(supabase(), RUN, input("GC-09"), () => replay("GC-09"));
    expect(state).toMatchObject({ kind: "refused", message: "This document is not a maintenance request or an estimate." });
    expect(state).not.toHaveProperty("document");
  });

  it("AC-DOCAI-13: ключа немає — «The assistant is not available now. Fill in the values yourself.»", async () => {
    const state = await proposeDocument(supabase(), RUN, input("GC-01"), () => null);
    expect(state).toMatchObject({ kind: "unavailable", message: "The assistant is not available now. Fill in the values yourself." });
  });

  it("AC-DOCAI-13: денний ліміт (429) — те саме повідомлення, один запит до моделі", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({ message: "Rate limit exceeded", url: "u", requestBodyValues: {}, statusCode: 429 });
      },
    });
    const state = await proposeDocument(supabase(), RUN, input("GC-01"), () => model);
    expect(state).toMatchObject({ kind: "unavailable", message: "The assistant is not available now. Fill in the values yourself." });
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("AC-DOCAI-16: без права модель навіть не створюється", async () => {
    canParse = false;
    const getModel = vi.fn((): LanguageModel | null => replay("GC-01"));
    const state = await proposeDocument(supabase(), RUN, input("GC-01"), getModel);
    expect(state).toMatchObject({ kind: "error", message: "Not enough rights" });
    expect(getModel).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-11: порожній текст — модель не створюється", async () => {
    const getModel = vi.fn((): LanguageModel | null => replay("GC-01"));
    await proposeDocument(supabase(), RUN, "   ", getModel);
    expect(getModel).not.toHaveBeenCalled();
  });
});

const REQUEST = {
  documentType: "maintenance_request",
  phone: "555 0101",
  description: "The kitchen tap in apartment 12 has been dripping for three days.",
  category: "plumbing",
  urgency: "urgent",
  items: [],
  total: null,
};

describe("saveValues — запис лише після дії людини", () => {
  it("AC-DOCAI-04: Urgency змінено на «urgent» — один запис save_run_document з тим, що підтвердила людина", async () => {
    const state = await saveValues(RUN, REQUEST);
    expect(state).toEqual({ ok: true, id: "doc-1" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_run_document", {
      p_run_id: RUN,
      p_document_type: "maintenance_request",
      p_phone: "555-0101",
      p_description: "The kitchen tap in apartment 12 has been dripping for three days.",
      p_category: "plumbing",
      p_urgency: "urgent",
      p_items: [],
      p_total: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/runs/${RUN}`);
  });

  it("AC-DOCAI-04: кошторис — лише name, quantity, unitPrice кожної позиції й Total; поля заявки й зайве з браузера не йдуть", async () => {
    await saveValues(RUN, {
      ...REQUEST,
      documentType: "estimate",
      text: "the pasted text must not be stored",
      items: [{ name: " Labour ", quantity: 2, unitPrice: 60, extra: "x" }],
      total: 120,
    });
    expect(rpc).toHaveBeenCalledWith("save_run_document", {
      p_run_id: RUN,
      p_document_type: "estimate",
      p_phone: null,
      p_description: null,
      p_category: null,
      p_urgency: null,
      p_items: [{ name: "Labour", quantity: 2, unitPrice: 60 }],
      p_total: 120,
    });
  });

  it("AC-DOCAI-13: асистент недоступний — людина вибрала тип і заповнила лише телефон, запис зберігається", async () => {
    const state = await saveValues(RUN, { documentType: "maintenance_request", phone: "555-0102", description: "", category: null, urgency: null, items: [], total: null });
    expect(state).toEqual({ ok: true, id: "doc-1" });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_phone: "555-0102", p_description: null, p_category: null, p_urgency: null });
  });

  it("AC-DOCAI-16: база відмовила (NOT_ENOUGH_RIGHTS) — «Not enough rights», сторінку не оновлено", async () => {
    saveResult = { data: null, error: { message: "NOT_ENOUGH_RIGHTS" } };
    const state = await saveValues(RUN, REQUEST);
    expect(state).toEqual({ ok: false, error: "Not enough rights" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["без типу документа", { ...REQUEST, documentType: null }, "Choose a document type"],
    ["позиція з кількістю 0", { ...REQUEST, documentType: "estimate", items: [{ name: "Labour", quantity: 0, unitPrice: 60 }] }, "Each line item needs a name, a quantity above 0 and a unit price"],
    ["позиція без назви", { ...REQUEST, documentType: "estimate", items: [{ name: "  ", quantity: 1, unitPrice: 60 }] }, "Each line item needs a name, a quantity above 0 and a unit price"],
  ])("AC-DOCAI-04: «Save values» %s — повідомлення, до бази запит не йде", async (_name, raw, message) => {
    const state = await saveValues(RUN, raw);
    expect(state).toEqual({ ok: false, error: message });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-04: категорія не з переліку PM — запис не йде (браузеру не довіряємо)", async () => {
    const state = await saveValues(RUN, { ...REQUEST, category: "roof" });
    expect(state.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("без входу — «Sign in again», до бази запит не йде", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect(await saveValues(RUN, REQUEST)).toEqual({ ok: false, error: "Sign in again" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: saveDocument з раном не за форматом UUID — «Not enough rights» без запиту", async () => {
    expect(await saveDocument(supabase(), "x", REQUEST)).toEqual({ ok: false, error: "Not enough rights" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
