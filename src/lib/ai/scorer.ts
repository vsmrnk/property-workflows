import { Output, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { ParsedDocument } from "./parse";
import { JUDGE_INSTRUCTIONS, judgePrompt } from "./prompts/judge";

// Один golden case PM (#40): вхід → очікуване. Формат — tests/fixtures/golden/cases.json.
export type GoldenCase = {
  id: string; // "GC-01" = кейс 1 PM
  input: string;
  // Поля, які PM фіксує точно: тип, телефон, категорія, терміновість, позиції, Total, попередження, примітки, відмова.
  expected: Partial<ParsedDocument>;
  // Що має сказати опис (PM: «checked by meaning»). Оцінює LLM-суддя лише в живому eval.
  rubric?: string;
};

type Mismatch = { field: keyof ParsedDocument; expected: unknown; actual: unknown };

// Позиція — за полями, а не за JSON: модель може віддати ключі в іншому порядку.
const itemKey = (i: { name: string; quantity: number; unitPrice: number }) => JSON.stringify([i.name, i.quantity, i.unitPrice]);

// Примітки — множина: порядок не важить. Позиції — по порядку, як у документі. Решта — точний збіг.
function same(field: keyof ParsedDocument, a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (field === "notes") return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    if (field === "items") return a.length === b.length && a.every((x, i) => itemKey(x) === itemKey(b[i]));
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

// (1) Детермінована частина: точний збіг полів, зафіксованих PM. Заявка без опису — теж розбіжність: PM цитує
// опис у кожному кейсі заявки, а суддя (живий eval) оцінює лише його зміст.
export function scoreFields(expected: GoldenCase["expected"], actual: ParsedDocument) {
  const mismatches: Mismatch[] = (Object.keys(expected) as (keyof ParsedDocument)[])
    .filter((k) => !same(k, expected[k], actual[k]))
    .map((k) => ({ field: k, expected: expected[k], actual: actual[k] }));
  if (expected.documentType === "maintenance_request" && !("description" in expected) && !actual.description) {
    mismatches.push({ field: "description", expected: "a description", actual: actual.description });
  }
  return { pass: mismatches.length === 0, mismatches };
}

// (2) Нечітка частина: LLM-суддя лише для опису, двійковий вердикт із причиною.
const Verdict = z.object({ pass: z.boolean(), reason: z.string().max(300) });
export type JudgeVerdict = z.infer<typeof Verdict>;

export async function judgeDescription(judge: LanguageModel, rubric: string, description: string): Promise<JudgeVerdict> {
  const { output } = await generateText({
    model: judge,
    instructions: JUDGE_INSTRUCTIONS,
    prompt: judgePrompt(rubric, description),
    output: Output.object({ name: "verdict", schema: Verdict }),
    temperature: 0,
    maxRetries: 0, // повтор на безкоштовному тарифі витрачає той самий денний ліміт
  });
  return output;
}

// Частка успіху (pass rate): прогін на кейсах із відомими відповідями → бал.
export function passRate(results: { pass: boolean }[]): { passed: number; total: number; rate: number } {
  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}
