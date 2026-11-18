import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { UNAVAILABLE_MESSAGE, parseDocument } from "@/lib/ai/parse";
import { DOCUMENT_PROMPT_VERSION } from "@/lib/ai/prompts/document";
import { scoreFields, type GoldenCase } from "@/lib/ai/scorer";
import casesJson from "./fixtures/golden/cases.json";
import recordedJson from "./fixtures/golden/recorded.json";

// Офлайн-реплей golden cases PM (solomchaak/property-workflows-spec#40): без мережі й без ключа, тож працює в CI.
// Перевіряє КОД навколо моделі (промпт і межа <document>, схема, перевірки checkDraft, мапінг помилок, оцінювач),
// а НЕ якість моделі. Якість міряє живий прогін `npm run eval` (evals/golden.live.eval.ts), опис оцінює суддя.

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
const cases = casesJson as GoldenCase[];
const recorded = recordedJson as Record<string, Recording>;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

// Модель, що «відповідає» записаним текстом.
function replay(text: string, modelId = "recorded") {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

async function expectGoldenCase(id: string) {
  const c = cases.find((x) => x.id === id);
  const rec = recorded[id];
  expect(c, `немає кейсу ${id} у cases.json`).toBeDefined();
  expect(rec, `немає запису для ${id} у recorded.json`).toBeDefined();
  const model = replay(rec.text, rec.modelId);
  const result = await parseDocument(c!.input, model);
  expect(result).toMatchObject({ ok: true });
  const mismatches = result.ok ? scoreFields(c!.expected, result.document).mismatches : ["no document"];
  expect(mismatches).toEqual([]);
  // Недовірений вхід дійшов до моделі загорнутим як дані.
  expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain(`<document>\\n${c!.input}`);
}

describe("golden cases PM (#40), офлайн-реплей", () => {
  it("AC-DOCAI-01: golden GC-01 — заявка про кран, що капає", () => expectGoldenCase("GC-01"));
  it("AC-DOCAI-02: golden GC-07 — кошторис із трьома позиціями, Total збігається", () => expectGoldenCase("GC-07"));
  it("AC-DOCAI-06: golden GC-04 — заявка без телефону", () => expectGoldenCase("GC-04"));
  it("AC-DOCAI-07: golden GC-05 — дві проблеми, примітка", () => expectGoldenCase("GC-05"));
  it("AC-DOCAI-08: golden GC-08 — сума позицій не збігається з Total", () => expectGoldenCase("GC-08"));
  it("AC-DOCAI-09: golden GC-09 — меню, відмова", () => expectGoldenCase("GC-09"));
  it("AC-DOCAI-10: golden GC-10 — інструкції в тексті проігноровано", () => expectGoldenCase("GC-10"));
  // Кейси PM без окремого AC у вимозі #59 (терміновість, продиктований номер, газ) — теж у порозі 8 з 10.
  it.each(["GC-02", "GC-03", "GC-06"])("golden %s — кейс PM без окремого AC", (id) => expectGoldenCase(id));

  it("10 кейсів PM, кожен має запис поточною версією промпту", () => {
    expect(cases.map((c) => c.id)).toEqual(["GC-01", "GC-02", "GC-03", "GC-04", "GC-05", "GC-06", "GC-07", "GC-08", "GC-09", "GC-10"]);
    const missing = cases.map((c) => c.id).filter((id) => !recorded[id]);
    expect(missing).toEqual([]);
    const stale = Object.entries(recorded)
      .filter(([, r]) => r.promptVersion !== DOCUMENT_PROMPT_VERSION)
      .map(([id]) => id);
    // Змінили DOCUMENT_PROMPT_VERSION — перезапишіть записи живим прогоном (RECORD=1 npm run eval).
    expect(stale).toEqual([]);
  });

  it("кожен запис — справжня відповідь моделі :free з датою, а не заглушка", () => {
    const fake = Object.entries(recorded)
      .filter(([, r]) => !r.modelId.endsWith(":free") || Number.isNaN(Date.parse(r.recordedAt)) || /stub|заглушк|placeholder/i.test(r.text))
      .map(([id]) => id);
    expect(fake).toEqual([]);
    // Запис — сирий JSON моделі: розбирається без допомоги тесту.
    for (const r of Object.values(recorded)) expect(() => JSON.parse(r.text)).not.toThrow();
  });

  it("оцінювач ловить розбіжність: інша терміновість, зайва примітка й інша позиція — це FAIL", () => {
    const gc10 = cases.find((c) => c.id === "GC-10")!;
    const wrong = {
      status: "ok" as const,
      documentType: "maintenance_request" as const,
      phone: "555-0106",
      description: "Heater in apartment 20 makes a clicking noise but still works",
      category: "heating and cooling" as const,
      urgency: "urgent" as const,
      items: [],
      total: null,
      notes: [],
      warning: null,
    };
    expect(scoreFields(gc10.expected, wrong).mismatches.map((m) => m.field)).toEqual(["urgency", "notes"]);
    const gc08 = cases.find((c) => c.id === "GC-08")!;
    const items = [
      { name: "Inspection", quantity: 1, unitPrice: 90 },
      { name: "Replace valve", quantity: 1, unitPrice: 70 },
      { name: "Labour", quantity: 2, unitPrice: 60 },
    ];
    const est = { ...wrong, documentType: "estimate" as const, phone: null, description: null, category: null, urgency: null, items, total: 200, warning: "items add up to 280.00, the stated total is 200.00" };
    expect(scoreFields(gc08.expected, est).mismatches.map((m) => m.field)).toEqual(["items", "warning"]);
  });

  it("порядок приміток не важить, а заявка без опису — FAIL (опис у кожної заявки PM)", () => {
    const gc05 = cases.find((c) => c.id === "GC-05")!;
    const base = {
      status: "ok" as const,
      documentType: "maintenance_request" as const,
      phone: "555-0104",
      description: null,
      category: "plumbing" as const,
      urgency: "not urgent" as const,
      items: [],
      total: null,
      notes: ["the email has two problems" as const],
      warning: null,
    };
    expect(scoreFields(gc05.expected, base).mismatches.map((m) => m.field)).toEqual(["description"]);
  });
});

describe("AI недоступний: збої дають ручне заповнення", () => {
  it("AC-DOCAI-13: відповідь не за схемою → invalid_output і повідомлення PM", async () => {
    const result = await parseDocument("x", replay('{"status":"ok","category":"dragons"}'));
    expect(result).toEqual({ ok: false, reason: "invalid_output", message: UNAVAILABLE_MESSAGE });
  });

  it("AC-DOCAI-13: 429 → rate_limited одним запитом: денний ліміт повтором не виправити", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: "Rate limit exceeded: free-models-per-day",
          url: "https://openrouter.ai/api/v1/chat/completions",
          requestBodyValues: {},
          statusCode: 429,
        });
      },
    });
    const result = await parseDocument("x", model);
    expect(result).toEqual({ ok: false, reason: "rate_limited", message: UNAVAILABLE_MESSAGE });
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("AC-DOCAI-13: HTTP 200 з тілом помилки code 429 → rate_limited без повтору", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: "Provider returned error",
          url: "u",
          requestBodyValues: {},
          statusCode: 200,
          data: { code: 429, message: "upstream rate limit" },
        });
      },
    });
    const result = await parseDocument("x", model, { maxRetries: 2 });
    expect(result).toEqual({ ok: false, reason: "rate_limited", message: UNAVAILABLE_MESSAGE });
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("AC-DOCAI-13: повільна модель → timeout", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) => {
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, 5_000);
          abortSignal?.addEventListener("abort", () => {
            clearTimeout(t);
            reject(abortSignal.reason);
          });
        });
        throw new Error("unreachable");
      },
    });
    const result = await parseDocument("x", model, { timeoutMs: 50, maxRetries: 0 });
    expect(result).toEqual({ ok: false, reason: "timeout", message: UNAVAILABLE_MESSAGE });
  });

  it("AC-DOCAI-13: помилка постачальника (500) → provider_error", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({ message: "Internal error", url: "u", requestBodyValues: {}, statusCode: 500, isRetryable: false });
      },
    });
    const result = await parseDocument("x", model, { maxRetries: 0 });
    expect(result).toEqual({ ok: false, reason: "provider_error", message: UNAVAILABLE_MESSAGE });
  });
});
