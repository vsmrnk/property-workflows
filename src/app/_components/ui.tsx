import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "../login/actions";

// Спільні елементи інтерфейсу: шапка, картка, бейджі статусів, смуга прогресу, кнопки.
// Колір статусу завжди дублюється текстом (не лише колір — a11y).

export const btnPrimary =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(20,20,20,0.12)] transition-[background-color,transform] duration-200 hover:bg-primary/85 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-[0_0_0_3px_rgba(0,0,0,0.047)] transition-[background-color,transform] duration-200 hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus:border-accent";

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

/** Шапка застосунку. email = null — дані користувача ще вантажаться: на їхньому місці скелетон, решта статична. */
export function AppShell({
  email,
  role,
  children,
  busy = false,
}: {
  email: string | null;
  role: string | null;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-[-0.02em]">
            <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground">
              <Icon name="logo" className="size-4" />
            </span>
            Property Workflows
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Icon name="user" />
              {email === null ? (
                <span className="skeleton h-3.5 w-40" />
              ) : (
                <>
                  <span data-testid="user-email">{email}</span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-[0_0_0_2px_rgba(0,0,0,0.05)]" data-testid="user-role">
                    {role ?? "—"}
                  </span>
                </>
              )}
            </span>
            <form action={signOut}>
              <button type="submit" className={btnSecondary} aria-label="Sign out">
                <Icon name="out" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      {busy ? (
        <p role="status" className="sr-only">
          Loading…
        </p>
      ) : null}
      <main
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6"
        aria-busy={busy || undefined}
      >
        {children}
      </main>
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

/** Картка референсу: великий радіус, біла рамка 1.6px, ледь помітна тінь. tint — пастельний тон панелі. */
export function Card({
  children,
  className = "",
  tint,
}: {
  children: ReactNode;
  className?: string;
  tint?: "lime" | "peach" | "lavender";
}) {
  const bg = tint ? `tint-${tint}` : "bg-surface";
  return (
    <div className={`rounded-[22px] border-[1.6px] border-card-edge ${bg} shadow-[0_2px_16px_rgba(24,30,45,0.045)] ${className}`}>
      {children}
    </div>
  );
}

const RUN_STATUS: Record<string, { label: string; className: string }> = {
  in_progress: { label: "in progress", className: "bg-accent-soft text-accent" },
  completed: { label: "completed", className: "bg-success-soft text-success" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.className}`} data-testid="run-status">
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

export function ProgressBar({
  done,
  total,
  label,
  required,
}: {
  done: number;
  total: number;
  label: string;
  /** Обов'язкові задачі: саме вони завершують ран (припущення PM), тож показуємо їх окремо. */
  required?: { done: number; total: number };
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <span className="text-sm font-bold tracking-[-0.01em] tabular-nums" data-testid="run-progress">
        {label}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={label} aria-label={label}>
        <div className="progress-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {required ? (
        <span className="text-xs text-muted-foreground tabular-nums" data-testid="run-required-progress">
          {required.done} of {required.total} required
        </span>
      ) : null}
    </div>
  );
}

export function RequiredTag() {
  return <span className="rounded-full bg-surface px-2 py-px text-xs font-semibold shadow-[0_0_0_2px_rgba(0,0,0,0.05)] text-muted-foreground">required</span>;
}
