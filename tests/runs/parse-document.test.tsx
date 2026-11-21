// @vitest-environment happy-dom
// Блок «Parse a document» у браузері (impl-document-parsing, design.md U2–U8): що бачить і що може зробити менеджер
// рану. Дії сервера підмінені: тест перевіряє, що показує блок і що він надсилає, а самі дії — tests/runs/document-actions.test.ts,
// права й запис — tests/db/run-documents-db.test.ts.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proposeValues, saveValues } from "@/app/runs/[id]/document-actions";
import { ParseDocumentBlock } from "@/app/runs/[id]/parse-document-block";

// eslint-disable-next-line no-restricted-syntax -- Server Actions — мережева межа (POST-ендпойнти); тест перевіряє UI блоку, а самі дії — tests/runs/document-actions.test.ts і SQL/RLS у tests/db/
vi.mock("@/app/runs/[id]/document-actions", () => ({ proposeValues: vi.fn(), saveValues: vi.fn() }));

const RUN = "6b6a73ab-7180-434a-ab55-0920f16e7312";
const TAP = "Subject: Dripping tap. Hi, the kitchen tap in apartment 12 has been dripping for three days. Please send someone this week. My phone is 555-0101. Lena Test";

const empty = {
  status: "ok" as const,
  documentType: null,
  phone: null,
  description: null,
  category: null,
  urgency: null,
  items: [],
  total: null,
  notes: [],
  warning: null,
};
const tapRequest = {
  ...empty,
  documentType: "maintenance_request" as const,
  phone: "555-0101",
  description: "The kitchen tap in apartment 12 has been dripping for three days.",
  category: "plumbing" as const,
  urgency: "not urgent" as const,
};
const proposed = (document: object) => ({ kind: "proposed", id: crypto.randomUUID(), document: { ...empty, ...document } });

const propose = vi.mocked(proposeValues);
const save = vi.mocked(saveValues);

beforeEach(() => {
  propose.mockReset();
  save.mockReset();
  save.mockResolvedValue({ ok: true, id: "doc-1" });
});
afterEach(cleanup);

const textBox = () => screen.getByRole("textbox", { name: "Paste the text of a document" }) as HTMLTextAreaElement;
const proposeButton = () => screen.getByRole("button", { name: "Propose values" });

async function proposeWith(state: unknown, text = TAP) {
  propose.mockResolvedValue(state as never);
  render(<ParseDocumentBlock runId={RUN} />);
  fireEvent.change(textBox(), { target: { value: text } });
  await act(async () => {
    fireEvent.click(proposeButton());
  });
  // Дія з useActionState завершується за кілька мікрозадач після act — чекаємо, доки зникне «Reading the document…».
  await waitFor(() => expect(screen.queryByText("Reading the document…")).toBeNull());
}

async function choose(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  const item = await screen.findByRole("option", { name: option });
  item.focus();
  fireEvent.keyDown(item, { key: "Enter" });
  await waitFor(() => expect(screen.getByRole("combobox", { name: label }).textContent).toContain(option));
}

describe("блок «Parse a document»", () => {
  it("AC-DOCAI-03: поки AI працює — «Reading the document…», «Propose values» вимкнена, значень немає", async () => {
    // Відповідь дії приходить лише наприкінці тесту: незавершена асинхронна дія React «заплутує» (entangles) наступні
    // переходи, і стан «pending» не знявся б і в наступних тестах.
    let finish!: (state: unknown) => void;
    propose.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
    render(<ParseDocumentBlock runId={RUN} />);
    fireEvent.change(textBox(), { target: { value: TAP } });
    await act(async () => {
      fireEvent.click(proposeButton());
    });
    expect(screen.getByRole("status").textContent).toContain("Reading the document…");
    expect((proposeButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("combobox", { name: "Document type" })).toBeNull();
    // Текст іде на сервер з полем text — більше нічого.
    expect(propose.mock.calls[0][0]).toBe(RUN);
    expect((propose.mock.calls[0][2] as FormData).get("text")).toBe(TAP);
    await act(async () => finish({ kind: "idle" }));
  });

  it("AC-DOCAI-01: запропоновані значення — Maintenance request, 555-0101, опис, plumbing, not urgent; нічого не збережено", async () => {
    await proposeWith(proposed(tapRequest));
    expect(screen.getByRole("combobox", { name: "Document type" }).textContent).toContain("Maintenance request");
    expect((screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement).value).toBe("555-0101");
    expect((screen.getByRole("textbox", { name: "Description" }) as HTMLTextAreaElement).value).toContain("dripping for three days");
    expect(screen.getByRole("combobox", { name: "Category" }).textContent).toContain("plumbing");
    expect(screen.getByRole("combobox", { name: "Urgency" }).textContent).toContain("not urgent");
    expect(save).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-06: телефону в документі немає — поле Phone порожнє з позначкою «not found»", async () => {
    await proposeWith(proposed({ ...tapRequest, phone: null, category: "appliance", description: "The oven in apartment 5 does not heat up." }));
    const phone = screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement;
    expect(phone.value).toBe("");
    expect(phone.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(phone.getAttribute("aria-describedby")!)?.textContent).toBe("not found");
    expect(screen.getByRole("combobox", { name: "Category" }).textContent).toContain("appliance");
  });

  it("AC-DOCAI-07: дві проблеми — блок показує примітку «the email has two problems»", async () => {
    await proposeWith(proposed({ ...tapRequest, notes: ["the email has two problems"] }));
    expect(screen.getByText("the email has two problems")).toBeTruthy();
  });

  it("AC-DOCAI-10: інструкції в тексті — примітка «the text contains instructions to the AI that were ignored»", async () => {
    await proposeWith(proposed({ ...tapRequest, category: "heating and cooling", notes: ["the text contains instructions to the AI that were ignored"] }));
    expect(screen.getByText("the text contains instructions to the AI that were ignored")).toBeTruthy();
  });

  it("AC-DOCAI-08: кошторис — три позиції, Total 200.00 як написано й попередження про суму", async () => {
    await proposeWith(
      proposed({
        documentType: "estimate",
        items: [
          { name: "Inspection", quantity: 1, unitPrice: 90 },
          { name: "Replace valve", quantity: 1, unitPrice: 70 },
          { name: "Labour", quantity: 1, unitPrice: 60 },
        ],
        total: 200,
        warning: "items add up to 220.00, the stated total is 200.00",
      }),
    );
    expect(screen.getByRole("combobox", { name: "Document type" }).textContent).toContain("Estimate");
    const names = screen.getAllByRole("textbox", { name: /^Item \d$/ }).map((i) => (i as HTMLInputElement).value);
    expect(names).toEqual(["Inspection", "Replace valve", "Labour"]);
    expect((screen.getByRole("textbox", { name: "Unit price 3" }) as HTMLInputElement).value).toBe("60.00");
    expect((screen.getByRole("textbox", { name: "Total" }) as HTMLInputElement).value).toBe("200.00");
    expect(screen.getByText("items add up to 220.00, the stated total is 200.00")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Phone" })).toBeNull();
  });

  it("AC-DOCAI-02: кошторис без розбіжності — попередження немає", async () => {
    await proposeWith(
      proposed({
        documentType: "estimate",
        items: [
          { name: "Replace kitchen tap", quantity: 1, unitPrice: 85 },
          { name: "Labour", quantity: 2, unitPrice: 60 },
          { name: "Disposal fee", quantity: 1, unitPrice: 15 },
        ],
        total: 220,
      }),
    );
    expect((screen.getByRole("textbox", { name: "Quantity 2" }) as HTMLInputElement).value).toBe("2");
    expect(screen.queryByText(/items add up to/)).toBeNull();
  });

  it("AC-DOCAI-04: менеджер змінює Urgency на «urgent» і зберігає — дія отримує саме це, блок знову порожній", async () => {
    await proposeWith(proposed(tapRequest));
    await choose("Urgency", "urgent");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save values" }));
    });
    expect(save).toHaveBeenCalledWith(RUN, {
      documentType: "maintenance_request",
      phone: "555-0101",
      description: "The kitchen tap in apartment 12 has been dripping for three days.",
      category: "plumbing",
      urgency: "urgent",
      items: [],
      total: null,
    });
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Document type" })).toBeNull());
    expect(textBox().value).toBe("");
  });

  it("AC-DOCAI-04: збереження не вдалося — повідомлення, а виправлені значення лишаються у формі", async () => {
    save.mockResolvedValue({ ok: false, error: "Not enough rights" });
    await proposeWith(proposed(tapRequest));
    await choose("Urgency", "urgent");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save values" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("Not enough rights");
    expect((screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement).value).toBe("555-0101");
    expect(screen.getByRole("combobox", { name: "Urgency" }).textContent).toContain("urgent");
    expect(textBox().value).toBe(TAP);
  });

  it("AC-DOCAI-05: «Discard» — блок знову порожній, нічого не збережено", async () => {
    await proposeWith(proposed(tapRequest));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("combobox", { name: "Document type" })).toBeNull();
    expect(textBox().value).toBe("");
    expect(save).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-09: меню — повідомлення PM, форми значень немає", async () => {
    await proposeWith({ kind: "refused", id: "r1", message: "This document is not a maintenance request or an estimate." });
    expect(screen.getByText("This document is not a maintenance request or an estimate.")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Document type" })).toBeNull();
  });

  it("AC-DOCAI-11: порожній текст — «Paste the text of a document», значень немає", async () => {
    await proposeWith({ kind: "error", id: "e1", message: "Paste the text of a document" }, "   ");
    expect(screen.getByRole("alert").textContent).toContain("Paste the text of a document");
    expect(screen.queryByRole("combobox", { name: "Document type" })).toBeNull();
  });

  it("AC-DOCAI-12: «photo.png» через «Upload a text file» — «Only plain text files (.txt) are accepted», текст і запит не змінюються", async () => {
    render(<ParseDocumentBlock runId={RUN} />);
    fireEvent.change(textBox(), { target: { value: TAP } });
    const file = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Upload a text file"), { target: { files: [file] } });
    });
    expect(screen.getByRole("alert").textContent).toContain("Only plain text files (.txt) are accepted");
    expect(textBox().value).toBe(TAP);
    expect(propose).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-12: файл .txt зчитується в поле тексту, а модель не викликається, доки людина не натисне «Propose values»", async () => {
    render(<ParseDocumentBlock runId={RUN} />);
    const file = new File([TAP], "request.txt", { type: "text/plain" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Upload a text file"), { target: { files: [file] } });
    });
    await waitFor(() => expect(textBox().value).toBe(TAP));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-13: асистент недоступний — повідомлення PM, порожня форма; людина заповнює її сама й зберігає", async () => {
    await proposeWith({ kind: "unavailable", id: "u1", reason: "no_key", message: "The assistant is not available now. Fill in the values yourself." });
    expect(screen.getByText("The assistant is not available now. Fill in the values yourself.")).toBeTruthy();
    const type = screen.getByRole("combobox", { name: "Document type" });
    expect(type.textContent).not.toContain("Maintenance request");
    expect((screen.getByRole("button", { name: "Save values" }) as HTMLButtonElement).disabled).toBe(true);

    await choose("Document type", "Maintenance request");
    fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), { target: { value: "555-0102" } });
    // Значень моделі немає — і позначки «not found» теж: їх ніхто не шукав.
    expect(screen.queryByText("not found")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save values" }));
    });
    expect(save).toHaveBeenCalledWith(RUN, expect.objectContaining({ documentType: "maintenance_request", phone: "555-0102" }));
  });

  it("AC-DOCAI-13: кошторис вручну — позиції додаються й видаляються, числа йдуть на сервер числами", async () => {
    await proposeWith({ kind: "unavailable", id: "u2", reason: "rate_limited", message: "The assistant is not available now. Fill in the values yourself." });
    await choose("Document type", "Estimate");
    fireEvent.click(screen.getByRole("button", { name: "Add an item" }));
    fireEvent.click(screen.getByRole("button", { name: "Add an item" }));
    const row = within(screen.getByTestId("estimate-items"));
    fireEvent.change(row.getByRole("textbox", { name: "Item 1" }), { target: { value: "Labour" } });
    fireEvent.change(row.getByRole("textbox", { name: "Quantity 1" }), { target: { value: "2" } });
    fireEvent.change(row.getByRole("textbox", { name: "Unit price 1" }), { target: { value: "60" } });
    fireEvent.click(row.getByRole("button", { name: "Remove item 2" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Total" }), { target: { value: "120" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save values" }));
    });
    expect(save).toHaveBeenCalledWith(RUN, expect.objectContaining({ documentType: "estimate", items: [{ name: "Labour", quantity: 2, unitPrice: 60 }], total: 120 }));
  });
});
