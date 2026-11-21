import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOC_MESSAGES, DOCUMENT_TYPE_LABELS, formatConfirmedAt, isDocumentType, money } from "@/lib/documents/format";
import { emailOf, type Person } from "@/lib/runs/people";
import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";
import { Card } from "../../_components/ui";
import { ParseDocumentBlock } from "./parse-document-block";

// Збережені значення документів рану (design.md U9): найновіші першими (порядок задає запит сторінки), хто й коли
// підтвердив. Рендериться лише для того, кому база дозволяє can_parse_documents; рядки віддає RLS run_documents.

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Блок «Parse a document» і збережені значення — лише тому, кому дозволяє база (менеджер рану чи адміністратор,
 * AC-DOCAI-14, AC-DOCAI-15; design.md U1). Без права run_documents навіть не запитуємо. Функція, а не async-компонент,
 * як vendorRun: сторінка чекає на неї сама.
 */
export async function runDocuments({ supabase, runId, people }: { supabase: Client; runId: string; people: Person[] }) {
  const { data: canParse } = await supabase.rpc("can_parse_documents", { p_run_id: runId });
  if (canParse !== true) return null;
  const { data: documents } = await supabase
    .from("run_documents")
    .select("*")
    .eq("run_id", runId)
    .order("confirmed_at", { ascending: false });
  return (
    <>
      <ParseDocumentBlock runId={runId} />
      <SavedDocuments documents={documents ?? []} people={people} />
    </>
  );
}

type SavedDocument = Database["public"]["Tables"]["run_documents"]["Row"];
type Item = { name: string; quantity: number; unitPrice: number };

const itemsOf = (items: SavedDocument["items"]): Item[] =>
  Array.isArray(items) ? (items as unknown[]).filter((i): i is Item => typeof i === "object" && i !== null && "name" in i) : [];

function Value({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? <span className="text-muted-foreground">{DOC_MESSAGES.NOT_FOUND}</span>}</dd>
    </div>
  );
}

function SavedDocuments({ documents, people }: { documents: SavedDocument[]; people: Person[] }) {
  if (documents.length === 0) return null;
  return (
    <Card>
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Saved values</h2>
      </div>
      <ul className="divide-y divide-border">
        {documents.map((doc) => (
          <li key={doc.id} data-testid="saved-document" className="grid gap-3 px-5 py-4">
            <p className="font-medium">{isDocumentType(doc.document_type) ? DOCUMENT_TYPE_LABELS[doc.document_type] : doc.document_type}</p>
            {doc.document_type === "estimate" ? (
              <EstimateValues doc={doc} />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-3">
                <Value label="Phone" value={doc.phone} />
                <Value label="Category" value={doc.category} />
                <Value label="Urgency" value={doc.urgency} />
                <div className="sm:col-span-3">
                  <Value label="Description" value={doc.description} />
                </div>
              </dl>
            )}
            <p className="text-sm text-muted-foreground">
              Confirmed by {emailOf(people, doc.confirmed_by)} · <span className="tabular-nums">{formatConfirmedAt(doc.confirmed_at)}</span>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EstimateValues({ doc }: { doc: SavedDocument }) {
  const items = itemsOf(doc.items);
  return (
    <div className="grid gap-2">
      {items.length > 0 ? (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="w-24 text-right">Quantity</TableHead>
              <TableHead className="w-28 text-right">Unit price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="truncate">{item.name}</TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{money(item.unitPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <dl>
        <Value label="Total" value={doc.total === null ? null : money(doc.total)} />
      </dl>
    </div>
  );
}
