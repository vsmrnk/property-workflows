import { Check, ChevronLeft, ChevronRight, House, List, LogOut, Plus, User } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UiCard } from "@/components/ui/card";
import { requirementLabel } from "@/lib/runs/progress";
import { cn } from "@/lib/utils";
import { signOut } from "../login/actions";
import { SidebarNav } from "./sidebar-nav";

// Композитні блоки застосунку на компонентах @/components/ui і токенах DESIGN.md: каркас (сайдбар + хедер),
// заголовок сторінки, бейджі статусів, смуга прогресу. Колір статусу завжди дублюється текстом (не лише колір — a11y).

const ICONS = { logo: House, plus: Plus, check: Check, back: ChevronLeft, user: User, out: LogOut, list: List };

export function Icon({ name, className = "size-4" }: { name: keyof typeof ICONS; className?: string }) {
  const Glyph = ICONS[name];
  return <Glyph className={className} aria-hidden="true" />;
}

/** Знак продукту: квадрат primary з іконкою будинку і назва. */
export function Brand() {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Icon name="logo" className="size-4" />
      </span>
      Property Workflows
    </span>
  );
}

export type Crumb = { label: string; href?: string };

/**
 * Каркас застосунку: сайдбар зліва (знак і навігація), хедер (хлібні крихти, користувач, вихід) і контент.
 * На вузькому екрані сайдбар ховається, навігація переходить у рядок під хедером.
 * email = null — дані користувача ще вантажаться: на їхньому місці скелетон, решта статична.
 */
export function AppShell({
  email,
  role,
  crumbs = [],
  children,
  busy = false,
}: {
  email: string | null;
  role: string | null;
  crumbs?: Crumb[];
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Link href="/" className="rounded-md">
            <Brand />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-card">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="rounded-md md:hidden" aria-label="Property Workflows">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <Icon name="logo" className="size-4" />
              </span>
            </Link>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {crumbs.map((c, i) => (
                  <Fragment key={`${c.label}-${i}`}>
                    {i > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                    <li className={cn("truncate", i === crumbs.length - 1 && "font-medium text-foreground")}>
                      {c.href && i < crumbs.length - 1 ? (
                        <Link href={c.href} className="rounded-sm hover:text-foreground">
                          {c.label}
                        </Link>
                      ) : (
                        <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                      )}
                    </li>
                  </Fragment>
                ))}
              </ol>
            </nav>
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
                <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
                  <Icon name="out" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </form>
            </div>
          </div>
          <div className="border-t border-border px-4 py-2 md:hidden">
            <SidebarNav orientation="horizontal" />
          </div>
        </header>
        {busy ? (
          <p role="status" className="sr-only">
            Loading…
          </p>
        ) : null}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8" aria-busy={busy || undefined}>
          <div className="flex w-full flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Заголовок сторінки: h1, опис і дії праворуч (одна основна дія на екран — DESIGN.md §5). */
export function PageHeader({
  title,
  description,
  actions,
  badge,
  titleTestId,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  titleTestId?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title font-semibold" data-testid={titleTestId}>
            {title}
          </h1>
          {badge}
        </div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
      <Icon name="back" />
      {children}
    </Link>
  );
}

/** Card з @/components/ui. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <UiCard className={className}>{children}</UiCard>;
}

const RUN_STATUS: Record<string, { label: string; variant: "progress" | "done" }> = {
  in_progress: { label: "in progress", variant: "progress" },
  completed: { label: "completed", variant: "done" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status];
  return (
    <Badge variant={s?.variant ?? "muted"} data-testid="run-status">
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
  compact = false,
}: {
  done: number;
  total: number;
  label: string;
  /** Обов'язкові задачі: саме вони завершують ран (припущення PM), тож показуємо їх окремо. */
  required?: { done: number; total: number };
  /** Рядок таблиці: підпис і смуга в один рядок. */
  compact?: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex min-w-28 flex-col gap-1.5">
      <span className={cn("tabular-nums", compact ? "text-xs font-medium" : "text-sm font-semibold")} data-testid="run-progress">
        {label}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={label} aria-label={label}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
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
    <Badge variant="outline" className={cn(!required && "text-muted-foreground")} data-testid="task-requirement">
      {requirementLabel(required)}
    </Badge>
  );
}
