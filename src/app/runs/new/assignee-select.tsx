"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Icon } from "../../_components/ui";

/** Колега для вибору — лише email (AC-RUN-10, відповідь PM на #5). */
export type AssigneeOption = { id: string; email: string };

// Порожнє значення у формі — «me, the run manager» (AC-RUN-04, 08, 09); у Select — окремий ключ, бо "" він не вибирає.
const ME = "me";

function Avatar({ label, me = false }: { label: string; me?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
        me ? "bg-foreground text-background" : "bg-accent text-accent-foreground",
      )}
      aria-hidden="true"
    >
      {me ? <Icon name="user" className="size-3.5" /> : label.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Вибір виконавця задачі: Select з @/components/ui (клавіатура, ARIA — Base UI). Значення йде у форму прихованим
 * полем `name`, тож server action launchRun отримує те саме, що й раніше: "" — «Me (run manager)».
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
  const items = [{ value: ME, label: "Me (run manager)" }, ...options.map((o) => ({ value: o.id, label: o.email }))];
  const [value, setValue] = useState<string>(ME);

  return (
    <div className="w-full">
      <input type="hidden" name={name} value={value === ME ? "" : value} />
      <Select items={items} value={value} onValueChange={(v) => setValue(typeof v === "string" ? v : ME)}>
        <SelectTrigger id={id} aria-labelledby={`${labelId} ${id}`} className="w-full">
          <SelectValue>
            {(v: string) => {
              const item = items.find((i) => i.value === v) ?? items[0];
              return (
                <>
                  <Avatar label={item.label} me={item.value === ME} />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                </>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="end">
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <Avatar label={item.label} me={item.value === ME} />
              <span className="min-w-0 truncate font-medium">{item.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
