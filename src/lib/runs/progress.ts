// Прогрес рану: «N of M done», де N — задачі зі статусом «done», M — усі задачі рану, обов'язкові й ні
// (глосарій PM «Progress»; AC-TASK-05, AC-TASK-09; design.md impl-run-launch, D7).

export type TaskLike = { status: string };

export function countProgress(tasks: readonly TaskLike[]): { done: number; total: number } {
  return { done: tasks.filter((t) => t.status === "done").length, total: tasks.length };
}

export function formatProgress(done: number, total: number): string {
  return `${done} of ${total} done`;
}

export function progressOf(tasks: readonly TaskLike[]): string {
  const { done, total } = countProgress(tasks);
  return formatProgress(done, total);
}

/** Хто може позначити задачу виконаною: виконавець, менеджер рану або адміністратор (AC-TASK-01, 02, 03, 07). */
export function canMarkDone(
  task: { assignee_id: string; status: string },
  run: { manager_id: string },
  viewer: { id: string; role: string | null },
): boolean {
  if (task.status === "done") return false;
  return task.assignee_id === viewer.id || run.manager_id === viewer.id || viewer.role === "admin";
}

/**
 * Остання обов'язкова задача рану, що ще «to do»: її позначення просить підтвердження
 * з назвою задачі й написом «This cannot be undone» (AC-TASK-04, AC-TASK-16; припущення PM).
 */
export function needsConfirmation(
  task: { id: string; required: boolean; status: string },
  tasks: readonly { id: string; required: boolean; status: string }[],
): boolean {
  if (!task.required || task.status === "done") return false;
  return tasks.every((t) => t.id === task.id || !t.required || t.status === "done");
}

export const CONFIRM_NOTICE = "This cannot be undone";

/** Позначка обов'язковості поруч зі статусом задачі (AC-TASK-15). */
export function requirementLabel(required: boolean): "required" | "optional" {
  return required ? "required" : "optional";
}

/**
 * Задачі рану групами за секціями в порядку секцій (AC-TASK-12, AC-RUN-12). Групуємо за позицією секції,
 * тож дві секції з однаковою назвою не зливаються.
 */
export function groupBySection<T extends { section_name: string; section_position: number; position: number }>(
  tasks: readonly T[],
): { key: number; name: string; tasks: T[] }[] {
  const sorted = [...tasks].sort((a, b) => a.section_position - b.section_position || a.position - b.position);
  const sections: { key: number; name: string; tasks: T[] }[] = [];
  for (const task of sorted) {
    const last = sections.at(-1);
    if (last && last.key === task.section_position) last.tasks.push(task);
    else sections.push({ key: task.section_position, name: task.section_name, tasks: [task] });
  }
  return sections;
}
