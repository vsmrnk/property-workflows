"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../../_components/ui";

/** Колега для вибору — лише email (AC-RUN-10, відповідь PM на #5). */
export type AssigneeOption = { id: string; email: string };

function initials(email: string) {
  return email.slice(0, 1).toUpperCase();
}

function Avatar({ name, me = false }: { name: string; me?: boolean }) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${
        me ? "bg-primary text-primary-foreground" : "bg-accent-soft text-accent"
      }`}
      aria-hidden="true"
    >
      {me ? <Icon name="user" className="size-3.5" /> : initials(name)}
    </span>
  );
}

/**
 * Кастомний дропдаун виконавця (ARIA listbox). Значення йде у форму прихованим полем `name`,
 * тож server action launchRun отримує те саме, що й від нативного <select>: "" — «Me (run manager)».
 */
export function AssigneeSelect({
  id,
  name,
  labelId,
  options,
}: {
  id: string;
  name: string;
  labelId: string;
  options: AssigneeOption[];
}) {
  const listId = useId();
  const all = [{ id: "", label: "Me (run manager)" }, ...options.map((o) => ({ id: o.id, label: o.email }))];
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const selected = all.find((o) => o.id === value) ?? all[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openList() {
    setActive(Math.max(0, all.findIndex((o) => o.id === value)));
    setOpen(true);
  }

  function choose(i: number) {
    setValue(all[i].id);
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(all.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(all.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1) {
      // Пошук за першою літерою імені.
      const k = e.key.toLowerCase();
      const next = all.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(k));
      const first = all.findIndex((o) => o.label.toLowerCase().startsWith(k));
      const target = next >= 0 ? next : first;
      if (target >= 0) setActive(target);
    }
  }

  return (
    <div ref={root} className="relative sm:w-72">
      <input type="hidden" name={name} value={value} />
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${id}`}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-surface px-2.5 py-1.5 text-left text-sm transition-[border-color,box-shadow] duration-200 ${
          open ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-border hover:border-accent/50"
        }`}
      >
        <Avatar name={selected.label} me={selected.id === ""} />
        <span className="min-w-0 flex-1 truncate font-medium">{selected.label}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="dropdown-pop absolute right-0 z-30 mt-2 max-h-72 w-full min-w-64 overflow-auto rounded-2xl border-[1.6px] border-card-edge bg-surface p-1.5 shadow-[0_14px_36px_rgba(70,66,120,0.18)]"
        >
          {all.map((o, i) => {
            const isSelected = o.id === value;
            return (
              <li
                key={o.id || "me"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${
                  i === active ? "bg-accent-soft" : ""
                }`}
              >
                <Avatar name={o.label} me={o.id === ""} />
                <span className="min-w-0 flex-1 truncate font-medium">{o.label}</span>
                {isSelected ? <Icon name="check" className="size-4 shrink-0 text-accent" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
