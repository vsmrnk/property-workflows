"use client";

import { useActionState, useId, useState, useTransition, type ChangeEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_OPTIONS,
  DOC_MESSAGES,
  DOCUMENT_TYPE_OPTIONS,
  EMPTY_VALUES,
  MAX_DOCUMENT_CHARS,
  URGENCY_OPTIONS,
  isDocumentType,
  isPlainTextFile,
  toFormValues,
  toSavePayload,
  type FormValues,
  type ItemValues,
} from "@/lib/documents/format";
import type { ProposeState } from "@/lib/documents/service";
import { cn } from "@/lib/utils";
import { Card } from "../../_components/ui";
import { proposeValues, saveValues } from "./document-actions";

// Блок «Parse a document» на сторінці рану (design.md U2–U8). Бачить його лише той, кому база дозволяє
// can_parse_documents (сторінка вирішує, чи рендерити). Модель пропонує значення — у базу йде лише те, що людина
// перевірила й зберегла кнопкою «Save values» (AC-DOCAI-04). Успіх — без тостів: запис з'являється в «Saved values».

const IDLE: ProposeState = { kind: "idle" };

export function ParseDocumentBlock({ runId }: { runId: string }) {
  const [state, propose, reading] = useActionState(proposeValues.bind(null, runId), IDLE);
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  // id результату, який людина відкинула чи зберегла: форма зникає, а наступний «Propose values» дасть новий id.
  const [closed, setClosed] = useState<string | null>(null);
  const textId = useId();

  const current = !reading && state.kind !== "idle" && state.id !== closed ? state : null;
  const reviewing = current?.kind === "proposed" || current?.kind === "unavailable";

  const reset = () => {
    if (current) setClosed(current.id);
    setText("");
    setFileError(null);
  };

  return (
    <Card className="p-5" data-testid="parse-document">
      <h2 className="text-base font-semibold">Parse a document</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a maintenance request or an estimate. The assistant proposes values; nothing is saved until you check them and
        select «Save values».
      </p>

      <form action={propose} className="mt-4 grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={textId}>{DOC_MESSAGES.PASTE_TEXT}</Label>
          <Textarea
            id={textId}
            name="text"
            value={text}
            maxLength={MAX_DOCUMENT_CHARS}
            onChange={(e) => setText(e.target.value)}
            rows={6}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant={reviewing ? "secondary" : "default"} disabled={reading}>
            Propose values
          </Button>
          <UploadButton
            onText={(t) => {
              setFileError(null);
              setText(t);
            }}
            onError={setFileError}
          />
        </div>
      </form>

      <div className="mt-4 grid gap-4 empty:hidden">
        {reading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {DOC_MESSAGES.READING}
          </p>
        ) : null}
        {fileError ? <Alert variant="destructive">{fileError}</Alert> : null}
        {current ? <Outcome state={current} runId={runId} onDone={reset} /> : null}
      </div>
    </Card>
  );
}

/** «Upload a text file» (U3, AC-DOCAI-12): лише .txt; текст файлу йде в поле, модель не викликається. */
function UploadButton({ onText, onError }: { onText: (text: string) => void; onError: (message: string) => void }) {
  const id = useId();

  async function readFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // той самий файл можна вибрати ще раз
    if (!file) return;
    // Інший файл не читаємо й нічого не надсилаємо, вставлений текст лишається.
    if (!isPlainTextFile(file)) return onError(DOC_MESSAGES.ONLY_TXT);
    // Грубий запобіжник до читання: UTF-8 — до 4 байтів на символ. Точну межу перевіряє сервер.
    if (file.size > MAX_DOCUMENT_CHARS * 4) return onError(DOC_MESSAGES.TOO_LONG);
    onText(await file.text());
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
      )}
    >
      Upload a text file
      <input id={id} type="file" accept=".txt,text/plain" className="sr-only" onChange={readFile} />
    </label>
  );
}

type Shown = Exclude<ProposeState, { kind: "idle" }>;

/** Результат «Propose values»: помилка, відмова, недоступність з ручною формою або запропоновані значення з примітками. */
function Outcome({ state, runId, onDone }: { state: Shown; runId: string; onDone: () => void }) {
  if (state.kind === "error") return <Alert variant="destructive">{state.message}</Alert>;
  if (state.kind === "refused") return <Alert role="status">{state.message}</Alert>;
  if (state.kind === "unavailable") {
    return (
      <>
        <Alert role="status">{state.message}</Alert>
        <ReviewForm key={state.id} runId={runId} initial={EMPTY_VALUES} proposed={false} onDone={onDone} />
      </>
    );
  }
  const { notes, warning } = state.document;
  return (
    <>
      {[...notes, ...(warning ? [warning] : [])].map((note) => (
        <Alert role="status" key={note}>
          {note}
        </Alert>
      ))}
      <ReviewForm key={state.id} runId={runId} initial={toFormValues(state.document)} proposed onDone={onDone} />
    </>
  );
}

type Row = ItemValues & { key: string };
const newRow = (item: ItemValues = { name: "", quantity: "", unitPrice: "" }): Row => ({ ...item, key: crypto.randomUUID() });

/**
 * Перевірка значень людиною (U5, U7). `proposed` — значення від моделі: порожнє поле, яке модель не знайшла,
 * позначене «not found» (AC-DOCAI-06). У ручній формі (асистент недоступний, AC-DOCAI-13) позначок немає.
 */
function ReviewForm({ runId, initial, proposed, onDone }: { runId: string; initial: FormValues; proposed: boolean; onDone: () => void }) {
  const [values, setValues] = useState<FormValues>(initial);
  const [rows, setRows] = useState<Row[]>(() => initial.items.map((i) => newRow(i)));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const id = useId();

  const set = (field: keyof Omit<FormValues, "items">) => (value: string) => setValues((v) => ({ ...v, [field]: value }));
  const setRow = (key: string, field: keyof ItemValues, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  // «not found» — лише там, де модель нічого не дала й людина ще нічого не ввела.
  const notFound = (field: keyof Omit<FormValues, "items" | "documentType">) =>
    proposed && !initial[field] && !values[field] ? `${id}-${field}-nf` : undefined;

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await saveValues(runId, toSavePayload({ ...values, items: rows }));
      if (result.ok) onDone();
      else setError(result.error);
    });
  }

  const type = values.documentType;
  return (
    <div className="grid gap-4 border-t border-border pt-4">
      <Field label="Document type" id={`${id}-type`}>
        <Choice
          id={`${id}-type`}
          label="Document type"
          options={DOCUMENT_TYPE_OPTIONS}
          value={type}
          onChange={(v) => setValues((s) => ({ ...s, documentType: isDocumentType(v) ? v : "" }))}
        />
      </Field>

      {type === "maintenance_request" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" id={`${id}-phone`} notFound={notFound("phone")}>
            <Input id={`${id}-phone`} value={values.phone} onChange={(e) => set("phone")(e.target.value)} aria-describedby={notFound("phone")} />
          </Field>
          <Field label="Category" id={`${id}-category`} notFound={notFound("category")}>
            <Choice
              id={`${id}-category`}
              label="Category"
              options={CATEGORY_OPTIONS}
              value={values.category}
              onChange={set("category")}
              describedBy={notFound("category")}
            />
          </Field>
          <Field label="Description" id={`${id}-description`} notFound={notFound("description")} className="sm:col-span-2">
            <Textarea
              id={`${id}-description`}
              value={values.description}
              maxLength={1000}
              rows={3}
              onChange={(e) => set("description")(e.target.value)}
              aria-describedby={notFound("description")}
            />
          </Field>
          <Field label="Urgency" id={`${id}-urgency`} notFound={notFound("urgency")}>
            <Choice
              id={`${id}-urgency`}
              label="Urgency"
              options={URGENCY_OPTIONS}
              value={values.urgency}
              onChange={set("urgency")}
              describedBy={notFound("urgency")}
            />
          </Field>
        </div>
      ) : null}

      {type === "estimate" ? (
        <div className="grid gap-4">
          <div className="grid gap-2" data-testid="estimate-items">
            <p className="text-sm font-semibold">Line items</p>
            {rows.map((row, index) => {
              const n = index + 1;
              return (
                <div key={row.key} className="flex items-center gap-2">
                  <Input aria-label={`Item ${n}`} className="flex-1" value={row.name} onChange={(e) => setRow(row.key, "name", e.target.value)} />
                  <Input
                    aria-label={`Quantity ${n}`}
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(e) => setRow(row.key, "quantity", e.target.value)}
                    className="w-20 tabular-nums"
                  />
                  <Input
                    aria-label={`Unit price ${n}`}
                    inputMode="decimal"
                    value={row.unitPrice}
                    onChange={(e) => setRow(row.key, "unitPrice", e.target.value)}
                    className="w-28 tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove item ${n}`}
                    onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, newRow()])}>
                Add an item
              </Button>
            </div>
          </div>
          <Field label="Total" id={`${id}-total`} notFound={notFound("total")} className="max-w-48">
            <Input
              id={`${id}-total`}
              inputMode="decimal"
              value={values.total}
              onChange={(e) => set("total")(e.target.value)}
              aria-describedby={notFound("total")}
              className="tabular-nums"
            />
          </Field>
        </div>
      ) : null}

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={!type || saving}>
          Save values
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
          Discard
        </Button>
      </div>
      {!type ? <p className="-mt-2 text-sm text-muted-foreground">Choose a document type to save the values.</p> : null}
    </div>
  );
}

function Field({
  label,
  id,
  notFound,
  className,
  children,
}: {
  label: string;
  id: string;
  notFound?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id} id={`${id}-label`}>
        {label}
      </Label>
      {children}
      {notFound ? (
        <p id={notFound} className="text-sm text-muted-foreground">
          {DOC_MESSAGES.NOT_FOUND}
        </p>
      ) : null}
    </div>
  );
}

function Choice({
  id,
  label,
  options,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
}) {
  return (
    <Select items={options} value={value || null} onValueChange={(v) => onChange(typeof v === "string" ? v : "")}>
      <SelectTrigger id={id} aria-label={label} aria-describedby={describedBy} className="w-full">
        <SelectValue>{(v: string | null) => options.find((o) => o.value === v)?.label ?? "Choose…"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
