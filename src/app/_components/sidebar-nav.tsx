"use client";

import { LayoutTemplate, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Пункти навігації — лише наявні сторінки зрізу. Активний пункт — за поточною адресою.
const ITEMS = [
  { href: "/", label: "Runs", icon: ListChecks, active: (p: string) => p === "/" || (p.startsWith("/runs/") && !p.startsWith("/runs/new")) },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, active: (p: string) => p.startsWith("/templates") || p.startsWith("/runs/new") },
];

/** Бічна навігація (vertical) або рядок навігації під хедером на вузькому екрані (horizontal). */
export function SidebarNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "flex-row overflow-x-auto")}>
      {ITEMS.map(({ href, label, icon: Icon, active }) => {
        const current = active(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
              current
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
