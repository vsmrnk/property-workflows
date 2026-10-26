"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CONFIRM_NOTICE } from "@/lib/runs/progress";
import { taskSummary } from "@/lib/templates/format";
import { cn } from "@/lib/utils";
import {
  addSection,
  addTask,
  removeSection,
  removeTask,
  renameSection,
  renameTask,
  reorderSections,
  reorderTasks,
  setTaskRequired,
} from "./actions";
import { InlineName } from "./inline-name";

type Section = { id: string; name: string };
type Task = { id: string; section_id: string; name: string; required: boolean };
type Model = { sections: Section[]; tasks: Task[] };
type Change =
  | { kind: "remove-section"; id: string }
  | { kind: "remove-task"; id: string }
  | { kind: "sections"; ids: string[] }
  | { kind: "tasks"; sectionId: string; ids: string[] }
  | { kind: "required"; id: string; required: boolean };

const byIds = <T extends { id: string }>(rows: T[], ids: string[]) =>
  ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is T => r !== undefined);

// Оптимістична зміна: рядок зникає, переїжджає чи перемикається одразу, сервер підтверджує оновленою сторінкою.
function apply(model: Model, change: Change): Model {
  switch (change.kind) {
    case "remove-section":
      return {
        sections: model.sections.filter((s) => s.id !== change.id),
        tasks: model.tasks.filter((t) => t.section_id !== change.id),
      };
    case "remove-task":
      return { ...model, tasks: model.tasks.filter((t) => t.id !== change.id) };
    case "sections":
      return { ...model, sections: byIds(model.sections, change.ids) };
    case "tasks":
      return {
        ...model,
        tasks: [...model.tasks.filter((t) => t.section_id !== change.sectionId), ...byIds(model.tasks, change.ids)],
      };
    case "required":
      return { ...model, tasks: model.tasks.map((t) => (t.id === change.id ? { ...t, required: change.required } : t)) };
  }
}

/**
 * Робоча копія шаблону (design.md impl-template-versions, U3): секції й задачі перетягують за ручку, прибирають кнопкою з підтвердженням на місці, додають рядком унизу. Кожна дія одразу
 * пишеться в робочу копію (автозбереження, AC-EDITOR-01).
 */
export function Editor({ templateId, sections, tasks }: { templateId: string } & Model) {
  const [model, change] = useOptimistic<Model, Change>({ sections, tasks }, apply);
  const [, startTransition] = useTransition();
  // Рядки, що були на сторінці від початку, не анімуємо; нові (додані після) — плавно з'являються.
  const [initial] = useState(() => new Set([...sections, ...tasks].map((r) => r.id)));
  const run = (c: Change, action: () => Promise<void>) =>
    startTransition(async () => {
      change(c);
      await action();
    });
  const sectionIds = model.sections.map((s) => s.id);

  return (
    <>
      {model.sections.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground" data-testid="editor-empty">
          No sections yet. Add the first section below, then add tasks to it.
        </Card>
      ) : (
        <SortableList
          id={`sections-${templateId}`}
          ids={sectionIds}
          onReorder={(ids) => run({ kind: "sections", ids }, () => reorderSections(templateId, ids))}
        >
          <div className="flex flex-col">
            {model.sections.map((section, si) => (
              <SectionBlock
                key={section.id}
                templateId={templateId}
                section={section}
                index={si}
                count={model.sections.length}
                onMove={(dir) => {
                  const ids = arrayMove(sectionIds, si, si + dir);
                  run({ kind: "sections", ids }, () => reorderSections(templateId, ids));
                }}
                tasks={model.tasks.filter((t) => t.section_id === section.id)}
                entering={!initial.has(section.id)}
                isNew={(id) => !initial.has(id)}
                run={run}
              />
            ))}
          </div>
        </SortableList>
      )}
      <AddRow
        label="Section name"
        placeholder="Add a section…"
        button="Add section"
        onAdd={(fd) => addSection(templateId, fd)}
      />
    </>
  );
}

type Run = (c: Change, action: () => Promise<void>) => void;
type Move = (dir: -1 | 1) => void;

// Лише вертикальне перетягування: рядок їде за курсором уздовж списку, не вбік.
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Список, порядок якого міняють перетягуванням за ручку (dnd-kit). */
function SortableList({
  id,
  ids,
  onReorder,
  children,
}: {
  id: string;
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  return (
    <DndContext
      id={id}
      sensors={sensors}
      // Типова інструкція dnd-kit про пробіл не наша: з клавіатури рядок переставляє Alt+↑/↓.
      accessibility={{
        screenReaderInstructions: {
          draggable: "Drag with the mouse, or focus the row and press Alt+ArrowUp or Alt+ArrowDown to move it.",
        },
      }}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// Момент останнього переміщення з клавіатури: лише тоді рядки анімують зміну місця самі (перетягування анімує dnd-kit).
let keyboardMoveAt = -Infinity;

function useSortableRow(id: string, index: number) {
  const s = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Translate.toString(s.transform), transition: s.transition };
  const node = useRef<HTMLElement | null>(null);
  const top = useRef<number | null>(null);
  // FLIP: рядок, що змінив місце після Alt+↑/↓, плавно доїжджає зі старої позиції до нової (і сусід, з яким помінялися).
  const { setNodeRef } = s;
  const ref = useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el);
      node.current = el;
    },
    [setNodeRef],
  );
  useLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    const prev = top.current;
    top.current = el.offsetTop;
    if (prev === null || prev === el.offsetTop || performance.now() - keyboardMoveAt > 500) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: `translateY(${prev - el.offsetTop}px)` }, { transform: "none" }], {
      duration: 200,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    });
  }, [index]);
  return {
    setRowRef: ref,
    style,
    dragging: s.isDragging,
    handle: { ref: s.setActivatorNodeRef, ...s.attributes, ...s.listeners },
  };
}

function SectionBlock({
  templateId,
  section,
  index,
  count,
  onMove,
  tasks,
  entering,
  isNew,
  run,
}: {
  templateId: string;
  section: Section;
  index: number;
  count: number;
  onMove: Move;
  tasks: Task[];
  entering: boolean;
  isNew: (id: string) => boolean;
  run: Run;
}) {
  const [leaving, setLeaving] = useState(false);
  const { setRowRef, style, dragging, handle } = useSortableRow(section.id, index);
  const required = tasks.filter((t) => t.required).length;
  const taskIds = tasks.map((t) => t.id);
  const remove = () => run({ kind: "remove-section", id: section.id }, () => removeSection(templateId, section.id));
  const moveKeys = useMoveKeys(index, count, onMove);

  return (
    <Collapse entering={entering} leaving={leaving} onGone={remove} className="pb-6">
      <div
        ref={setRowRef}
        style={style}
        className={cn("relative", dragging && "z-20 rounded-card shadow-float ring-1 ring-input")}
      >
        <Card className="overflow-visible">
          <section aria-label={section.name} data-testid="editor-section">
            <ConfirmRemove
              question={
                tasks.length
                  ? `Remove section “${section.name}” and its ${tasks.length === 1 ? "task" : `${tasks.length} tasks`}?`
                  : `Remove section “${section.name}”?`
              }
              onConfirm={() => setLeaving(true)}
              className="rounded-t-card border-b border-border px-5 py-3"
            >
              {(ask) => (
                <div
                  // Сам рядок теж у порядку Tab: на ньому Alt+↑/↓ переставляє секцію, не заходячи в поле назви.
                  tabIndex={0}
                  role="group"
                  aria-label={`Section ${index + 1}: ${section.name}`}
                  onKeyDown={moveKeys}
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                  className="flex items-center gap-2 rounded-t-card border-b border-border py-3 pr-5 pl-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
                >
                  <DragHandle label={`Reorder section “${section.name}”`} {...handle} />
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">Section {index + 1}</span>
                  <InlineName
                    key={section.name}
                    action={renameSection.bind(null, templateId, section.id)}
                    id={`section-${section.id}`}
                    label="Section name"
                    name={section.name}
                    className="max-w-md font-semibold"
                  />
                  <span className="hidden shrink-0 text-sm text-muted-foreground tabular-nums sm:inline">
                    {taskSummary(tasks.length, required)}
                  </span>
                  <RemoveButton subject={`section “${section.name}”`} onClick={ask} />
                </div>
              )}
            </ConfirmRemove>

            {tasks.length ? (
              <div role="table" aria-label={`Tasks of ${section.name}`}>
                <div role="row" className={cn(TASK_GRID, "border-b border-border py-2 pr-5 pl-2 text-sm font-medium")}>
                  <span role="columnheader">
                    <span className="sr-only">Reorder</span>
                  </span>
                  <span role="columnheader">#</span>
                  <span role="columnheader">Task</span>
                  <span role="columnheader" className="text-center">
                    Required
                  </span>
                  <span role="columnheader">
                    <span className="sr-only">Remove</span>
                  </span>
                </div>
                <SortableList
                  id={`tasks-${section.id}`}
                  ids={taskIds}
                  onReorder={(ids) =>
                    run({ kind: "tasks", sectionId: section.id, ids }, () => reorderTasks(templateId, section.id, ids))
                  }
                >
                  {tasks.map((task, ti) => (
                    <TaskRow
                      key={task.id}
                      templateId={templateId}
                      task={task}
                      index={ti}
                      count={tasks.length}
                      onMove={(dir) => {
                        const ids = arrayMove(taskIds, ti, ti + dir);
                        run({ kind: "tasks", sectionId: section.id, ids }, () =>
                          reorderTasks(templateId, section.id, ids),
                        );
                      }}
                      entering={isNew(task.id)}
                      run={run}
                    />
                  ))}
                </SortableList>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">No tasks in this section yet.</p>
            )}

            <AddRow
              label={`New task in ${section.name}`}
              placeholder="Add a task…"
              button="Add task"
              withRequired
              className="rounded-b-card border-t border-border"
              onAdd={(fd) => addTask(templateId, section.id, fd)}
            />
          </section>
        </Card>
      </div>
    </Collapse>
  );
}

const TASK_GRID = "grid grid-cols-[2rem_1.5rem_minmax(0,1fr)_5rem_6rem] items-center gap-2";

function TaskRow({
  templateId,
  task,
  index,
  count,
  onMove,
  entering,
  run,
}: {
  templateId: string;
  task: Task;
  index: number;
  count: number;
  onMove: Move;
  entering: boolean;
  run: Run;
}) {
  const [leaving, setLeaving] = useState(false);
  const { setRowRef, style, dragging, handle } = useSortableRow(task.id, index);
  const remove = () => run({ kind: "remove-task", id: task.id }, () => removeTask(templateId, task.id));
  const moveKeys = useMoveKeys(index, count, onMove);
  return (
    <Collapse entering={entering} leaving={leaving} onGone={remove}>
      <div
        ref={setRowRef}
        style={style}
        role="row"
        data-testid="editor-task"
        // Сам рядок теж у порядку Tab: на ньому Alt+↑/↓ переставляє задачу, не заходячи в поле назви.
        tabIndex={0}
        onKeyDown={moveKeys}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        className={cn(
          "relative border-b border-border bg-card transition-colors last:border-b-0 hover:bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
          dragging && "z-20 rounded-md border-transparent bg-popover shadow-float ring-1 ring-input hover:bg-popover",
        )}
      >
        <ConfirmRemove
          question={`Remove task “${task.name}”?`}
          onConfirm={() => setLeaving(true)}
          className="px-5 py-2"
        >
          {(ask) => (
            <div className={cn(TASK_GRID, "py-1.5 pr-5 pl-2")}>
              <span role="cell">
                <DragHandle label={`Reorder task “${task.name}”`} {...handle} />
              </span>
              <span role="cell" className="text-sm text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span role="cell" className="min-w-0">
                <InlineName
                  key={task.name}
                  action={renameTask.bind(null, templateId, task.id)}
                  id={`task-${task.id}`}
                  label="Task name"
                  name={task.name}
                  className="-ml-2"
                />
              </span>
              <span role="cell" className="flex items-center justify-center">
                <Checkbox
                  checked={task.required}
                  aria-label={`Required: ${task.name}`}
                  data-testid="task-requirement"
                  onCheckedChange={(required) =>
                    run({ kind: "required", id: task.id, required }, () =>
                      setTaskRequired(templateId, task.id, required),
                    )
                  }
                />
              </span>
              <span role="cell" className="flex justify-end">
                <RemoveButton subject={`task “${task.name}”`} onClick={ask} />
              </span>
            </div>
          )}
        </ConfirmRemove>
      </div>
    </Collapse>
  );
}

/** Плавна поява (новий рядок) і згортання (прибраний рядок); після згортання — onGone. */
function Collapse({
  entering,
  leaving,
  onGone,
  className,
  children,
}: {
  entering: boolean;
  leaving: boolean;
  onGone: () => void;
  className?: string;
  children: ReactNode;
}) {
  const gone = useRef(onGone);
  useEffect(() => {
    gone.current = onGone;
  });
  useEffect(() => {
    if (!leaving) return;
    // Тривалість — як у transition нижче; з prefers-reduced-motion згортання миттєве, а пауза ледь помітна.
    const t = setTimeout(() => gone.current(), 200);
    return () => clearTimeout(t);
  }, [leaving]);
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]",
        entering && "animate-in fade-in-0 slide-in-from-top-1 duration-200",
      )}
    >
      <div className={cn("min-h-0", leaving && "overflow-hidden")}>
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Кнопка «Remove» → на місці рядка питання з назвою, «This cannot be undone», «Cancel» (фокус) і червона «Remove»
 * (Вигляд і тон PM: небезпечна дія — помітно інший колір і завжди з підтвердженням). Esc — те саме, що «Cancel».
 */
function ConfirmRemove({
  question,
  onConfirm,
  className,
  children,
}: {
  question: string;
  onConfirm: () => void;
  className?: string;
  children: (ask: () => void) => ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const cancel = () => {
    setAsking(false);
    requestAnimationFrame(() => host.current?.querySelector<HTMLElement>("[data-remove]")?.focus());
  };
  return (
    <div ref={host}>
      {asking ? (
        <div
          role="alertdialog"
          aria-label={question}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-2 bg-muted/60 text-sm animate-in fade-in-0 duration-150",
            className,
          )}
        >
          <p className="min-w-0 flex-1">
            <span className="font-medium">{question}</span>{" "}
            <span className="text-muted-foreground">{CONFIRM_NOTICE}.</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={cancel} autoFocus>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={onConfirm}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        children(() => setAsking(true))
      )}
    </div>
  );
}

/**
 * Alt+↑ / Alt+↓ (на Mac — ⌥) — клавіатурна заміна перетягування (Вигляд і тон PM: усе працює з клавіатури).
 * Діє з будь-якого поля рядка; переїжджає весь рядок, а фокус і курсор у полі лишаються там, де були.
 */
function useMoveKeys(index: number, count: number, onMove: Move) {
  const refocus = useRef<{ el: HTMLElement; start: number | null; end: number | null } | null>(null);
  // React переставляє вузли DOM, і перенесений вузол губить фокус — повертаємо його тому самому елементу.
  useLayoutEffect(() => {
    const r = refocus.current;
    refocus.current = null;
    if (!r || !r.el.isConnected || document.activeElement === r.el) return;
    r.el.focus({ preventScroll: true });
    if (r.el instanceof HTMLInputElement && r.start !== null) r.el.setSelectionRange(r.start, r.end);
    r.el.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (e: KeyboardEvent<HTMLElement>) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    // Рядок усередині секції обробляє свої клавіші сам — секція не має рухатися разом із ним.
    if (e.defaultPrevented) return;
    e.preventDefault();
    const dir = e.key === "ArrowUp" ? -1 : 1;
    if (index + dir < 0 || index + dir >= count) return;
    const el = e.target as HTMLElement;
    refocus.current = {
      el,
      start: el instanceof HTMLInputElement ? el.selectionStart : null,
      end: el instanceof HTMLInputElement ? el.selectionEnd : null,
    };
    keyboardMoveAt = performance.now();
    onMove(dir);
  };
}

function RemoveButton({ subject, onClick }: { subject: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-remove
      onClick={onClick}
      className="shrink-0 text-muted-foreground hover:text-destructive"
    >
      <Trash2 aria-hidden />
      Remove<span className="sr-only"> {subject}</span>
    </Button>
  );
}

function DragHandle({
  label,
  ref,
  ...props
}: { label: string } & ReturnType<typeof useSortableRow>["handle"]) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            ref={ref}
            {...props}
            aria-label={label}
            // Ручка — лише для миші, у Tab не потрапляє.
            tabIndex={-1}
            className="grid size-7 cursor-grab touch-none place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
          />
        }
      >
        <GripVertical className="size-4" aria-hidden />
      </TooltipTrigger>
      <TooltipContent>Drag to reorder, or Alt+↑ / Alt+↓ (⌥ on Mac) from the row</TooltipContent>
    </Tooltip>
  );
}

/**
 * Рядок додавання. Задача — останній рядок таблиці в тих самих колонках: «+», назва, «Required», «Add». Секція —
 * пунктирна картка під списком. Кнопка «Add» з'являється, щойно є назва, тож порожній рядок не надсилається і
 * помилки не потрібні. Enter додає; після додавання поле очищається й лишається у фокусі.
 */
function AddRow({
  label,
  placeholder,
  button,
  withRequired = false,
  className,
  onAdd,
}: {
  label: string;
  placeholder: string;
  button: string;
  withRequired?: boolean;
  className?: string;
  onAdd: (fd: FormData) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [required, setRequired] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const ready = name.trim() !== "" && !pending;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    if (required) fd.set("required", "on");
    startTransition(async () => {
      try {
        await onAdd(fd);
      } catch {
        // Рядок не додано: назва лишається в полі, щоб повторити.
        setFailed(true);
        return;
      }
      setFailed(false);
      setName("");
      setRequired(false);
      input.current?.focus();
    });
  };

  const field = (
    <>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      {failed && (
        <span id={`${id}-error`} role="alert" className="sr-only">
          Could not add. Try again.
        </span>
      )}
      <Input
        ref={input}
        id={id}
        name="name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setFailed(false);
        }}
        aria-invalid={failed || undefined}
        aria-describedby={failed ? `${id}-error` : undefined}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "h-8 border-transparent bg-transparent px-2 shadow-none dark:bg-transparent",
          // Рядок секції сам показує фокус рамкою навколо всього рядка — поле всередині без власної рамки.
          withRequired
            ? "hover:border-input focus-visible:border-ring"
            : "focus-visible:border-transparent focus-visible:ring-0",
        )}
      />
    </>
  );
  const add = (
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      disabled={!ready}
      className={cn("transition-opacity", name.trim() === "" && "invisible opacity-0")}
    >
      {pending ? "Adding…" : button}
    </Button>
  );

  if (withRequired) {
    return (
      <form onSubmit={submit} className={cn(TASK_GRID, "py-1.5 pr-5 pl-2", className)}>
        <span />
        <Plus className="size-4 text-muted-foreground" aria-hidden />
        <div className="-ml-2 min-w-0">{field}</div>
        <span className="flex justify-center">
          <Checkbox checked={required} onCheckedChange={setRequired} aria-label="Required" />
        </span>
        <span className="flex justify-end">{add}</span>
      </form>
    );
  }
  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-center gap-2 rounded-card border border-dashed border-border py-2 pr-5 pl-4 transition-[color,background-color,border-color,box-shadow] hover:border-input focus-within:border-solid focus-within:border-ring focus-within:bg-card focus-within:shadow-card focus-within:ring-3 focus-within:ring-ring/15",
        className,
      )}
    >
      <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">{field}</div>
      <span className="shrink-0">{add}</span>
    </form>
  );
}
