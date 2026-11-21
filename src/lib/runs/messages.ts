// Повідомлення користувачу за кодами помилок launch_run / mark_task_done / save_run_document.
// Тексти AC — дослівно як у PM (AC-RUN-03, AC-RUN-07, AC-TASK-03).

export const MESSAGES = {
  CASE_NAME_REQUIRED: "Enter a case name",
  CASE_NAME_TOO_LONG: "Case name must be at most 100 characters",
  NOT_ALLOWED: "Only the task's assignee, the run manager, or an administrator can mark a task as done",
  TEMPLATE_NOT_FOUND: "Choose a template",
  ASSIGNEE_INVALID: "An assignee can only be a manager, an administrator or a vendor",
  NOT_AUTHENTICATED: "Sign in again",
  // Зріз 4 (document-parsing): «Not enough rights» — дослівно AC-DOCAI-16; два інші — захисні перевірки бази, не з PM.
  NOT_ENOUGH_RIGHTS: "Not enough rights",
  DOCUMENT_TYPE_REQUIRED: "Choose a document type",
  ITEM_INVALID: "Each line item needs a name, a quantity above 0 and a unit price",
  // Значення з браузера не пройшли повторну перевірку (категорія чи терміновість не з переліку PM, задовгий текст).
  VALUES_INVALID: "Check the values: one of them is not valid",
  // Захисні перевірки значень перед записом (не з PM): межі колонок run_documents.
  TOTAL_INVALID: "Total must be a number, 0 or more",
  PHONE_TOO_LONG: "Phone must be at most 30 characters",
} as const;

export type ErrorCode = keyof typeof MESSAGES;

const FALLBACK = "Something went wrong. Try again.";

/** Код помилки з тексту помилки Postgres (raise exception '<CODE>'), інакше — null. */
export function errorCodeOf(message: string | null | undefined): ErrorCode | null {
  if (!message) return null;
  const code = (Object.keys(MESSAGES) as ErrorCode[]).find((key) => message.includes(key));
  return code ?? null;
}

export function messageFor(message: string | null | undefined): string {
  const code = errorCodeOf(message);
  return code ? MESSAGES[code] : FALLBACK;
}

/** Порожній список ранів (AC-DSYS-04): текст PM дослівно, поруч — посилання «Launch a template». */
export const NO_RUNS = "No runs yet. Launch a template to start one.";

/** Вендор без жодної задачі (AC-VENDOR-10): текст PM дослівно, без порожньої таблиці. */
export const NO_VENDOR_TASKS = "No tasks assigned to you yet.";

/** Чужий або неіснуючий ран за прямим посиланням (AC-TASK-10). */
export const RUN_NOT_FOUND = "Run not found";
