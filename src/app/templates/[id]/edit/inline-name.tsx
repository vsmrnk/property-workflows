"use client";

import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Назва секції чи задачі, яку редагують на місці: виглядає як текст, рамка — при наведенні й фокусі.
 * Enter або вихід з поля зберігають, Esc повертає попередню назву; порожню назву не зберігаємо.
 */
export function InlineName({
  action,
  id,
  label,
  name,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  name: string;
  className?: string;
}) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const cancelled = useRef(false);

  const save = () => {
    const next = value.trim();
    if (cancelled.current || next === "" || next === name) {
      cancelled.current = false;
      setValue(name);
      return;
    }
    const fd = new FormData();
    fd.set("name", next);
    startTransition(() => action(fd));
  };

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Input
        id={id}
        name="name"
        autoComplete="off"
        value={value}
        aria-busy={pending || undefined}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "h-8 border-transparent bg-transparent px-2 shadow-none transition-opacity hover:border-input focus-visible:border-ring dark:bg-transparent",
          pending && "opacity-60",
          className,
        )}
      />
    </div>
  );
}
