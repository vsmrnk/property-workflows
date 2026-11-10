import type { ReactNode } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "../../_components/ui";

/**
 * Секція рану — картка з назвою секції й таблицею задач. Спільна для сторінки рану менеджера/адміністратора і
 * сторінки рану вендора (impl-vendor-access, U3): відрізняються лише друга колонка («Assignee» чи «Section»), прогрес
 * секції праворуч у шапці (вендору — без нього) і рядки задач.
 */
export function TaskSection({
  sectionKey,
  name,
  aside,
  secondColumn,
  children,
}: {
  sectionKey: string | number;
  name: string;
  aside?: ReactNode;
  secondColumn: "Assignee" | "Section";
  children: ReactNode;
}) {
  return (
    <Card className="overflow-visible">
      <section aria-labelledby={`section-${sectionKey}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id={`section-${sectionKey}`} className="text-sm font-semibold">
            {name}
          </h2>
          {aside}
        </div>
        <Table className="table-fixed" containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Task</TableHead>
              <TableHead className="hidden w-1/4 md:table-cell">{secondColumn}</TableHead>
              <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40 pr-5 text-right">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </section>
    </Card>
  );
}
