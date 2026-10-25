import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UiCard } from "@/components/ui/card";
import { requirementLabel } from "@/lib/runs/progress";
import { cn } from "@/lib/utils";
import { signOut } from "../login/actions";

// Композитні блоки застосунку на компонентах @/components/ui і токенах DESIGN.md: шапка, картка з пастеллю,
// бейджі статусів, смуга прогресу. Колір статусу завжди дублюється текстом (не лише колір — a11y).

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

/** Знак продукту: квадрат primary з іконкою будинку і назва. */
export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2 font-extrabold tracking-tight">
      <span className={cn("grid place-items-center rounded-lg bg-primary text-primary-foreground", size === "lg" ? "size-9" : "size-8")}>
        <Icon name="logo" className="size-4" />
      </span>
      Property Workflows
    </span>
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
          <Link href="/" className="rounded-lg">
            <Brand />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Icon name="user" />
              {email === null ? (
                <span className="skeleton h-3.5 w-40" />
              ) : (
                <>
                  <span data-testid="user-email">{email}</span>
                  <Badge variant="outline" data-testid="user-role">
                    {role ?? "—"}
                  </Badge>
                </>
              )}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="secondary" aria-label="Sign out">
                <Icon name="out" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
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
    <Link href={href} className="inline-flex w-fit items-center gap-1 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
      <Icon name="back" />
      {children}
    </Link>
  );
}

/** Card з @/components/ui; tint — пастельна панель (лише для головної картки екрана, DESIGN.md §5). */
export function Card({
  children,
  className,
  tint,
}: {
  children: ReactNode;
  className?: string;
  tint?: "lime" | "peach" | "lavender";
}) {
  return <UiCard className={cn(tint && `tint-${tint}`, className)}>{children}</UiCard>;
}

const RUN_STATUS: Record<string, { label: string; variant: "progress" | "done" }> = {
  in_progress: { label: "in progress", variant: "progress" },
  completed: { label: "completed", variant: "done" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status];
  return (
    <Badge variant={s?.variant ?? "muted"} className="px-3 py-1" data-testid="run-status">
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {s?.label ?? status}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: string }) {
  const done = status === "done";
  return (
    <Badge variant={done ? "done" : "muted"} data-testid="task-status">
      {done ? <Icon name="check" className="size-3" /> : null}
      {done ? "done" : "to do"}
    </Badge>
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
      <span className="text-sm font-bold tracking-tight tabular-nums" data-testid="run-progress">
        {label}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={label} aria-label={label}>
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

/** «required» або «optional» поруч зі статусом задачі (AC-TASK-15): текст — з requirementLabel. */
export function RequirementTag({ required }: { required: boolean }) {
  return (
    <Badge variant="outline" className={cn("py-px", !required && "text-muted-foreground")} data-testid="task-requirement">
      {requirementLabel(required)}
    </Badge>
  );
}
