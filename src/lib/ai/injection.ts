// Ін'єкцію в тексті документа помічає код, а не лише модель (AC-DOCAI-10). Модель може пропустити примітку
// або виконати інструкцію; детектор не залежить від її відповіді. Шаблони — фрази, якими текст звертається до
// AI-асистента; звичайна заявка чи кошторис їх не містить (перевірено на кейсах PM #40).

export const INJECTION_NOTE = "the text contains instructions to the AI that were ignored";

const PATTERNS: RegExp[] = [
  // «Ignore all previous instructions», «disregard the rules above», «forget your prompt», «override the system rules».
  /\b(ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,40}\b(instructions?|rules|prompts?|guidelines|directions)\b/i,
  // Прохання показати чи переписати промпт.
  /\b(system|developer|hidden)\s+(prompt|message|instructions?)\b/i,
  // «You are now an assistant that…», «act as a…», «pretend to be…»
  /\byou\s+are\s+now\b/i,
  /\b(act|behave)\s+as\s+(an?\s+)?(ai|assistant|chatbot|model|system)\b/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  // «New instructions:», «Instructions for the AI:»
  /\b(new|updated|additional)\s+instructions?\s*:/i,
  /\binstructions?\s+(for|to)\s+(the\s+)?(ai|assistant|model|chatbot)\b/i,
  // Службові теги розмітки промпту: межа документа, ролі.
  /<\s*\/?\s*(document|system|assistant|user|instructions?)\b[^>]*>/i,
];

export function looksLikeInjection(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}
