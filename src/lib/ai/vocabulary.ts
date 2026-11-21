// Значення PM для блоку «Parse a document» без залежностей (ні zod, ні AI SDK): їх імпортує і сервер (схема, промпт,
// перевірка збереження), і клієнтський блок (вибори у формі), тож у браузер не потрапляє ні zod, ні текст промпту.
// Переліки — з вимоги PM (#59, «Assumptions») і golden cases (#40).

export const DOCUMENT_TYPES = ["maintenance_request", "estimate"] as const;
export const CATEGORIES = ["plumbing", "electrical", "heating and cooling", "appliance", "structure and doors", "other"] as const;
export const URGENCIES = ["urgent", "not urgent"] as const;
// Примітки з golden cases PM (#40): кейс 5 (AC-DOCAI-07), кейс 6, кейс 10 (AC-DOCAI-10).
export const NOTES = [
  "the email has two problems",
  "possible gas leak",
  "the text contains instructions to the AI that were ignored",
] as const;

// Ліміт довжини документа (PM: «a developer may set a reasonable limit»; design.md U3). Заявка чи кошторис — до
// кількох тисяч символів; 20 000 з запасом, але не дає довгим текстом витіснити інструкції чи з'їсти квоту токенів.
export const MAX_DOCUMENT_CHARS = 20_000;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
