import { describe, expect, it } from "vitest";
import { JUDGE_MODEL, PRODUCT_MODELS, assertFreeModels, makeJudgeModel, makeProductModel } from "@/lib/ai/models";

// Лише `:free`: платна модель у ланцюжку fallback оплачується за її ціною (ADR 0004, design.md AI1).
describe("ланцюжок моделей — лише :free", () => {
  it("кожна модель продукту й суддя мають суфікс :free", () => {
    expect([...PRODUCT_MODELS, JUDGE_MODEL].filter((id) => !id.endsWith(":free"))).toEqual([]);
  });

  it.each([["openai/gpt-4o-mini"], ["openrouter/auto"], ["google/gemma-4-31b-it"], ["nvidia/nemotron:free:extended"]])(
    "платна чи автоматична модель «%s» зупиняє код",
    (id) => {
      expect(() => assertFreeModels(["google/gemma-4-31b-it:free", id])).toThrow(/:free/);
    },
  );

  it("модель, яку отримує застосунок, і весь її ланцюжок fallback — лише :free", () => {
    const model = makeProductModel("test-key");
    expect(model.modelId).toBe(PRODUCT_MODELS[0]);
    expect(model.settings.models).toEqual([...PRODUCT_MODELS]);
    expect(makeJudgeModel("test-key").modelId).toBe(JUDGE_MODEL);
  });
});
