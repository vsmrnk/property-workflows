import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "../login/actions";

// Спільні елементи інтерфейсу: шапка, картка, бейджі статусів, смуга прогресу, кнопки.
// Колір статусу завжди дублюється текстом (не лише колір — a11y).

export const btnPrimary =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "min-h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors duration-200 focus:border-accent";

export function Icon({ name, className = "size-4" }: { name: "logo" | "plus" | "check" | "back" | "user" | "out" | "list"; className?: string }) {
  const paths: Record<string, ReactNode> = {
    logo: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 5 5L20 7" />,
    back: <path d="M15 18l-6-6 6-6" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    out: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function AppShell({ email, role, children }: { email: string; role: string | null; children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Icon name="logo" className="size-4" />
            </span>
            Property Workflows
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Icon name="user" />
              <span data-testid="user-email">{email}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground" data-testid="user-role">
                {role ?? "—"}
              </span>
            </span>
            <form action={signOut}>
              <button type="submit" className={btnSecondary} aria-label="Вийти">
                <Icon name="out" />
                <span className="hidden sm:inline">Вийти</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
      <Icon name="back" />
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface shadow-sm ${className}`}>{children}</div>;
}

const RUN_STATUS: Record<string, { label: string; className: string }> = {
  in_progress: { label: "in progress", className: "bg-warning-soft text-warning" },
  completed: { label: "completed", className: "bg-success-soft text-success" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`} data-testid="run-status">
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: string }) {
  const done = status === "done";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${done ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}
      data-testid="task-status"
    >
      {done ? <Icon name="check" className="size-3" /> : null}
      {done ? "done" : "to do"}
    </span>
  );
}

export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <span className="text-sm font-semibold tabular-nums" data-testid="run-progress">
        {label}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RequiredTag() {
  return <span className="rounded border border-border px-1.5 py-px text-[11px] font-medium uppercase tracking-wide text-muted-foreground">required</span>;
}
