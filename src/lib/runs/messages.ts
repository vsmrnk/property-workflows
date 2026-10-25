// Повідомлення користувачу за кодами помилок launch_run / mark_task_done.
// Тексти AC — дослівно як у PM (AC-RUN-03, AC-RUN-07, AC-TASK-03).

export const MESSAGES = {
  CASE_NAME_REQUIRED: "Enter a case name",
  CASE_NAME_TOO_LONG: "Case name must be at most 100 characters",
  NOT_ALLOWED: "Only the task's assignee, the run manager, or an administrator can mark a task as done",
  TEMPLATE_NOT_FOUND: "Choose a template",
  ASSIGNEE_INVALID: "An assignee can only be a manager or an administrator",
  NOT_AUTHENTICATED: "Sign in again",
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

/** Чужий або неіснуючий ран за прямим посиланням (AC-TASK-10). */
export const RUN_NOT_FOUND = "Run not found";
