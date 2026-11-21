import "server-only"; // помилка збірки, якщо цей файл колись імпортує Client Component
import { makeProductModel } from "./models";

// OPENROUTER_API_KEY — власний безкоштовний ключ OpenRouter розробника:
//   локально — у .env.local (він у .gitignore); у проді — Vercel → Environment Variables (Production і Preview).
// НІКОЛИ не з префіксом NEXT_PUBLIC_: такі значення вбудовуються в JavaScript для браузера.
// Цей файл — єдине місце в src/, яке читає ключ (перевіряє tests/ai-key.test.ts).
// Немає ключа (або лише пробіли) → null: блок показує «The assistant is not available now…» і ручну форму (AC-DOCAI-13).
export function productModel() {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key ? makeProductModel(key) : null;
}
