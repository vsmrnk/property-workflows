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
