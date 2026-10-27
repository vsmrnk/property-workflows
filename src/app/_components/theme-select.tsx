"use client";

import { useSyncExternalStore } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyTheme, readThemeChoice, THEME_KEY, THEME_OPTIONS, type ThemeChoice } from "@/lib/theme";

// Зміна вибору в цій вкладці — подія "theme-change"; в інших вкладках того самого пристрою — "storage".
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("theme-change", onChange);
  };
}

function choose(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Сховище недоступне (приватний режим): тема діє до закриття сторінки.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event("theme-change"));
}

/** Вибір «Theme» у хедері (AC-DSYS-05, AC-DSYS-06): System за замовчуванням, вибір пам'ятає пристрій. */
export function ThemeSelect() {
  const choice = useSyncExternalStore(subscribe, readThemeChoice, () => "system" as const);
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground lg:inline" aria-hidden="true">
        Theme
      </span>
      <Select
        items={THEME_OPTIONS}
        value={choice}
        onValueChange={(v) => {
          if (v === "system" || v === "light" || v === "dark") choose(v);
        }}
      >
        <SelectTrigger size="sm" aria-label="Theme" data-testid="theme-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEME_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
