import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Ланцюжок безкоштовних моделей (ADR 0004, design.md AI1). Безкоштовні моделі з'являються й зникають:
// перед роботою — `npm run ai:models`, після зміни — живий прогін `npm run eval`.
// Порядок = пріоритет. Лише ID із `:free`: платна модель у списку fallback оплачується за її ціною.
//   gemma-4-31b / gemma-4-26b — НЕ мають structured_outputs: json_schema може бути проігноровано, тому поля
//     повторено в промпті, а zod — ворота (відповідь не за схемою → AC-DOCAI-13).
//   nemotron-3.5-super-vl — строга схема (structured_outputs).
export const PRODUCT_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
] as const;

// Суддя живого eval — інша родина, ніж основна модель. Якщо відповіла резервна nemotron, суддя тієї ж родини:
// колонка modelId у звіті це показує.
export const JUDGE_MODEL = "nvidia/nemotron-3.5-super-vl:free";

const APP_NAME = "Property Workflows";

// Ворота «лише :free» у коді, а не лише в коментарі: id без суфікса `:free` (платна модель, `openrouter/auto`,
// варіант `:extended`) зупиняє фабрику до першого запиту, тож у ланцюжок fallback платна модель не потрапить.
export function assertFreeModels(ids: readonly string[]): void {
  const paid = ids.filter((id) => !/^[\w.-]+\/[\w.-]+:free$/.test(id));
  if (paid.length > 0) throw new Error(`Only :free models are allowed, got: ${paid.join(", ")}`);
}

// Фабрики приймають ключ параметром і НЕ читають process.env: так їх можна імпортувати в eval.
// У коді застосунку модель бере лише src/lib/ai/openrouter.ts (server-only).
export function makeProductModel(apiKey: string | undefined) {
  assertFreeModels(PRODUCT_MODELS);
  const openrouter = createOpenRouter({ apiKey, appName: APP_NAME });
  return openrouter.chat(PRODUCT_MODELS[0], {
    // OpenRouter пробує наступну модель при помилці, ліміті постачальника або простої.
    // Платформний ліміт безкоштовних моделей (20/хв, 50/день на акаунт) ланцюжок НЕ обходить.
    models: [...PRODUCT_MODELS],
    // Лише текст (PDF і фото — поза межами PM), тож плагіна file-parser немає.
    // Портативний параметр `reasoning` з AI SDK 7 цей провайдер не передає — лише його власний.
    reasoning: { effort: "low", exclude: true },
  });
}

export function makeJudgeModel(apiKey: string | undefined) {
  assertFreeModels([JUDGE_MODEL]);
  const openrouter = createOpenRouter({ apiKey, appName: `${APP_NAME} eval` });
  return openrouter.chat(JUDGE_MODEL);
}
