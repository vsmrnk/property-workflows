// UAT зрізу 4 «Parse a document» (requirements/59-…, openspec/specs/document-parsing/spec.md): «Тоді» — дослівно з AC PM.
// Дані «Дано» — синтетичні uat-<run>-…@example.test з auth.setup.ts (менеджер A, вендор V, ран «Apartment 12, move-in»);
// рани «Apartment 12, leak» тест запускає сам від імені A через API. Прибирає cleanup.teardown.ts (OWNED_ROWS).
//
// Дві гілки помічника, і в кожному прогоні рівно одна з них (CI не дозволяє пропущених тестів, тому тести гілки, якої
// немає, не реєструються, а не test.skip):
//   • помічник доступний — UAT_BASE_URL (прод: ключ у Vercel, задача 4.1) або OPENROUTER_API_KEY у .env.local для
//     локальної збірки: AC-DOCAI-01 і AC-DOCAI-04 через справжню безкоштовну модель (2 запити на прогін);
//   • помічника немає — CI (.github/workflows/e2e.yml, ключа немає, живої моделі в CI не буває): AC-DOCAI-13.
// AC-DOCAI-14 і AC-DOCAI-16 моделі не торкаються — є в обох гілках.
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { adminClient } from "./support/admin";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { apiAs, launchAs, stateOf, vendorData, type UatKey } from "./support/vendor";

const AI_LIVE = Boolean(process.env.UAT_BASE_URL || process.env.OPENROUTER_API_KEY?.trim());

const LEAK_TEXT =
  "Subject: Dripping tap. Hi, the kitchen tap in apartment 12 has been dripping for three days. " +
  "Please send someone this week. My phone is 555-0101. Lena Test";
const UNAVAILABLE = "The assistant is not available now. Fill in the values yourself.";
const NOT_ENOUGH_RIGHTS = "Not enough rights";
// «12 Nov 2026, 10:15» — дата й час за Києвом (припущення PM).
const CONFIRMED_AT = /\b\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}\b/;
// Безкоштовна модель відповідає до 45 с (тайм-аут parseDocument), тож тест і очікування — з запасом.
const MODEL_WAIT = 60_000;

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

async function pageAs(browser: Browser, key: UatKey): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ storageState: stateOf(key) });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

const block = (page: Page) => page.getByTestId("parse-document");
const combo = (page: Page, label: string) => block(page).getByRole("combobox", { name: label });
const savedDocuments = (page: Page) => page.getByTestId("saved-document");
// Текст списку вибору — значення й значок «▼»: порівнюємо початок, і «urgent» не збігається з «not urgent».
const selected = (value: string) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w ])`);
/** Кадр «Тоді» — лише видима частина сторінки: прокручуємо доказ угору екрана. */
const toTop = (locator: Locator) => locator.evaluate((el) => el.scrollIntoView({ block: "start" }));

async function choose(page: Page, label: string, option: string) {
  await combo(page, label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(combo(page, label)).toHaveText(selected(option));
}

async function documentsOf(runId: string) {
  const { data, error } = await adminClient()
    .from("run_documents")
    .select("document_type, phone, category, urgency, confirmed_by")
    .eq("run_id", runId);
  if (error) throw error;
  return data ?? [];
}

/** Новий ран «Apartment 12, leak» менеджера A (через API, як дані setup) і його сторінка з уставленим текстом. */
async function leakRunWithText(page: Page): Promise<string> {
  const data = vendorData();
  const runId = await launchAs(await apiAs(data.users["manager-a"]), data.template.id, "Apartment 12, leak");
  await page.goto(`/runs/${runId}`);
  await expect(page.getByTestId("user-email")).toHaveText(data.users["manager-a"].email);
  await expect(page.getByTestId("case-name")).toHaveText("Apartment 12, leak");
  await block(page).getByLabel("Paste the text of a document").fill(LEAK_TEXT);
  return runId;
}

async function expectLeakProposed(page: Page) {
  await expect(combo(page, "Document type")).toHaveText(selected("Maintenance request"), { timeout: MODEL_WAIT });
  await expect(block(page).getByLabel("Phone")).toHaveValue("555-0101");
  await expect(combo(page, "Category")).toHaveText(selected("plumbing"));
  await expect(combo(page, "Urgency")).toHaveText(selected("not urgent"));
}

test.describe("менеджер A", () => {
  test.use({ storageState: stateOf("manager-a") });

  if (AI_LIVE) {
    test(
      "AC-DOCAI-01: менеджер A пропонує значення для заявки про кран — Maintenance request, 555-0101, опис, plumbing, not urgent; нічого не збережено",
      { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-01" } },
      async ({ page }) => {
        test.setTimeout(120_000);
        let runId = "";

        await given('run manager A on the page of the run "Apartment 12, leak" and the pasted text "Subject: Dripping tap. …"', async () => {
          runId = await leakRunWithText(page);
        });

        await when('A chooses "Propose values"', async () => {
          await block(page).getByRole("button", { name: "Propose values" }).click();
        });

        await thenStep(
          page,
          {
            clause:
              'the block shows Document type "Maintenance request", Phone "555-0101", a Description that says the kitchen tap in apartment 12 has been dripping for three days, Category "plumbing" and Urgency "not urgent", and nothing is saved yet.',
            visible: [
              'Document type "Maintenance request", Phone "555-0101", Category "plumbing", Urgency "not urgent" in the block "Parse a document"',
              "the Description about the kitchen tap in apartment 12 dripping for three days",
              '"Save values" and "Discard" at the end of the page, not chosen yet',
            ],
            hidden: ['no "Saved values" on the page of the run', "in the database the run has no saved record (run_documents)"],
          },
          async () => {
            await expectLeakProposed(page);
            // Опис перевіряємо за змістом AC (порядок слів і формулювання — справа моделі): кухня, кран тече, квартира 12, три дні.
            const description = block(page).getByLabel("Description");
            const facts = [/kitchen/i, /\btap\b/i, /\b(drip|leak)\w*/i, /\b(apartment|apt\.?)\s*12\b/i, /\b(three|3)\s+days\b/i];
            for (const fact of facts) {
              await expect(description).toHaveValue(fact);
            }
            await expect(savedDocuments(page)).toHaveCount(0);
            expect(await documentsOf(runId)).toEqual([]);
            // Кінець сторінки: уся форма з значеннями й порожнє місце під нею, де стояв би блок «Saved values».
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          },
        );
      },
    );

    test(
      "AC-DOCAI-04: менеджер A змінює Urgency на «urgent» і зберігає — один запис з email A і датою й часом підтвердження",
      { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-04" } },
      async ({ page }) => {
        test.setTimeout(120_000);
        const a = vendorData().users["manager-a"];
        let runId = "";

        await given(
          'run manager A with Document type "Maintenance request", Phone "555-0101", Category "plumbing" and Urgency "not urgent" proposed in the block',
          async () => {
            runId = await leakRunWithText(page);
            await block(page).getByRole("button", { name: "Propose values" }).click();
            await expectLeakProposed(page);
          },
        );

        await when('A changes Urgency to "urgent" and chooses "Save values"', async () => {
          await choose(page, "Urgency", "urgent");
          await block(page).getByRole("button", { name: "Save values" }).click();
        });

        await thenStep(
          page,
          {
            clause:
              'the page of the run shows one saved record with Document type "Maintenance request", Phone "555-0101", Category "plumbing" and Urgency "urgent", the email of A and the date and time of the confirmation.',
            visible: [
              'one record under "Saved values": Maintenance request, Phone 555-0101, Category plumbing, Urgency urgent',
              `"Confirmed by ${a.email}" with the date and time of the confirmation`,
            ],
            hidden: ["in the database the run has exactly one record, urgency urgent, confirmed by A"],
          },
          async () => {
            await expect(savedDocuments(page)).toHaveCount(1);
            const record = savedDocuments(page).first();
            await expect(record).toContainText("Maintenance request");
            for (const [label, value] of [
              ["Phone", "555-0101"],
              ["Category", "plumbing"],
              ["Urgency", "urgent"],
            ]) {
              await expect(record.locator("dt", { hasText: label }).locator("+ dd")).toHaveText(value);
            }
            await expect(record).toContainText(`Confirmed by ${a.email}`);
            await expect(record).toContainText(CONFIRMED_AT);
            await toTop(page.getByRole("heading", { name: "Saved values" }));
            expect(await documentsOf(runId)).toEqual([
              { document_type: "maintenance_request", phone: "555-0101", category: "plumbing", urgency: "urgent", confirmed_by: a.id },
            ]);
          },
        );
      },
    );
  } else {
    test(
      "AC-DOCAI-13: помічник недоступний — повідомлення, порожні редаговані значення, менеджер A заповнює й зберігає сам",
      { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-13" } },
      async ({ page }) => {
        const a = vendorData().users["manager-a"];
        let runId = "";

        await given("run manager A with a pasted text, and the AI assistant is not available", async () => {
          runId = await leakRunWithText(page);
        });

        await when('A chooses "Propose values"', async () => {
          await block(page).getByRole("button", { name: "Propose values" }).click();
        });

        await thenStep(
          page,
          {
            clause: `the block shows "${UNAVAILABLE}", the Document type and the values are empty and editable,`,
            visible: [`"${UNAVAILABLE}" in the block`, "Document type, Phone and Description empty and editable"],
          },
          async () => {
            await expect(block(page).getByRole("status").filter({ hasText: UNAVAILABLE })).toBeVisible();
            await expect(combo(page, "Document type")).toHaveText(selected("Choose…"));
            await expect(combo(page, "Document type")).toBeEnabled();
            await toTop(block(page).getByRole("status").filter({ hasText: UNAVAILABLE }));
          },
        );

        await when('A fills in the values and chooses "Save values"', async () => {
          await choose(page, "Document type", "Maintenance request");
          // Поля значень з'являються після вибору типу: до заповнення вони порожні й редаговані, а не з чужими значеннями.
          for (const field of ["Phone", "Description"]) {
            await expect(block(page).getByLabel(field)).toHaveValue("");
            await expect(block(page).getByLabel(field)).toBeEditable();
          }
          for (const label of ["Category", "Urgency"]) {
            await expect(combo(page, label)).toHaveText(selected("Choose…"));
            await expect(combo(page, label)).toBeEnabled();
          }
          await block(page).getByLabel("Phone").fill("555-0101");
          await block(page).getByLabel("Description").fill("The kitchen tap in apartment 12 has been dripping for three days.");
          await choose(page, "Category", "plumbing");
          await choose(page, "Urgency", "not urgent");
          await block(page).getByRole("button", { name: "Save values" }).click();
        });

        await thenStep(
          page,
          {
            clause: 'and A can fill them in and choose "Save values".',
            visible: [`one record under "Saved values" with the values A filled in, "Confirmed by ${a.email}"`],
            hidden: ["in the database the run has exactly one record"],
          },
          async () => {
            await expect(savedDocuments(page)).toHaveCount(1);
            await expect(savedDocuments(page).first()).toContainText(`Confirmed by ${a.email}`);
            await toTop(page.getByRole("heading", { name: "Saved values" }));
            expect(await documentsOf(runId)).toEqual([
              { document_type: "maintenance_request", phone: "555-0101", category: "plumbing", urgency: "not urgent", confirmed_by: a.id },
            ]);
          },
        );
      },
    );
  }
});

test.describe("вендор V", () => {
  test.use({ storageState: stateOf("vendor-v") });

  test(
    "AC-DOCAI-14: вендор V відкриває ран «Apartment 12, move-in», де він виконавець задач 3 і 4, — блоку «Parse a document» немає",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-14" } },
    async ({ page }) => {
      const data = vendorData();
      const v = data.users["vendor-v"];

      await given('vendor V who is the assignee of tasks 3 and 4 in the run "Apartment 12, move-in"', async () => {
        const { data: rows, error } = await adminClient()
          .from("run_tasks")
          .select("assignee_id")
          .eq("run_id", data.runs.run12)
          .order("section_position")
          .order("position");
        if (error) throw error;
        expect(rows?.map((r) => r.assignee_id === v.id)).toEqual([false, false, true, true, false]);
      });

      await when("V opens the page of this run", async () => {
        await page.goto(`/runs/${data.runs.run12}`);
        await expect(page.getByTestId("user-email")).toHaveText(v.email);
        await expect(page.getByTestId("case-name")).toHaveText("Apartment 12, move-in");
      });

      await thenStep(
        page,
        {
          clause: 'V does not see the block "Parse a document".',
          visible: ['the page of the run "Apartment 12, move-in" for vendor V without the block "Parse a document"'],
        },
        async () => {
          await expect(page.getByTestId("run-task").first()).toBeVisible();
          await expect(page.getByRole("heading", { name: "Parse a document" })).toHaveCount(0);
          await expect(block(page)).toHaveCount(0);
        },
      );
    },
  );

  test(
    "AC-DOCAI-16: вендор V просить значення й зберігає їх напряму, оминаючи сторінки, — жодного значення й запису, «Not enough rights»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-16" } },
    async ({ page, browser }) => {
      const data = vendorData();
      const run12 = data.runs.run12;
      let proposeReply = "";
      let saveRefusal = "";

      await given('vendor V in the run "Apartment 12, move-in"', async () => {
        await page.goto(`/runs/${run12}`);
        await expect(page.getByTestId("user-email")).toHaveText(data.users["vendor-v"].email);
        await expect(block(page)).toHaveCount(0);
        expect(await documentsOf(run12)).toEqual([]);
      });

      await when("V tries to ask the AI for values and to save values for this run directly, bypassing the pages of the application", async () => {
        // Запит «Propose values» — той самий, що надсилає блок менеджера A (дія сервера з id рану), але з сесією V.
        // A надсилає порожній текст: модель не викликається, а запит має справжній id дії й тіло.
        const a = await pageAs(browser, "manager-a");
        let action: { url: string; headers: Record<string, string>; body: Buffer };
        try {
          await a.page.goto(`/runs/${run12}`);
          const request = a.page.waitForRequest((r) => r.method() === "POST" && "next-action" in r.headers());
          await block(a.page).getByRole("button", { name: "Propose values" }).click();
          const sent = await request;
          const headers = Object.fromEntries(
            Object.entries(await sent.allHeaders()).filter(([k]) => !k.startsWith(":") && !["cookie", "content-length", "host"].includes(k)),
          );
          action = { url: sent.url(), headers, body: sent.postDataBuffer() ?? Buffer.alloc(0) };
          await expect(block(a.page).getByText("Paste the text of a document").last()).toBeVisible();
        } finally {
          await a.close();
        }
        const reply = await page.request.post(action.url, { headers: action.headers, data: action.body });
        proposeReply = await reply.text();

        const v = await apiAs(data.users["vendor-v"]);
        const { error } = await v.rpc("save_run_document", {
          p_run_id: run12,
          p_document_type: "maintenance_request",
          p_phone: "555-0101",
          p_description: "The kitchen tap is dripping.",
          p_category: "plumbing",
          p_urgency: "urgent",
          p_items: [],
          p_total: null,
        });
        saveRefusal = error?.message ?? "";
        await test.info().attach("direct-requests.json", {
          body: JSON.stringify(
            {
              propose: { action: "proposeValues", status: reply.status(), notEnoughRights: proposeReply.includes(NOT_ENOUGH_RIGHTS) },
              save: { rpc: "save_run_document", refused: Boolean(error), message: saveRefusal },
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
      });

      // На екрані — сторінка рану V після запитів: блоку й записів немає; відповідь дії — вкладенням.
      await page.reload();
      await thenStep(
        page,
        {
          clause: 'they receive no value, no record is saved, and they see the message "Not enough rights".',
          visible: ['the page of the run for vendor V: no block "Parse a document" and no "Saved values"'],
          hidden: [
            'the reply to the direct "Propose values" request is "Not enough rights" without any proposed value',
            "the direct save_run_document request was refused with NOT_ENOUGH_RIGHTS; the run has no record in the database",
          ],
        },
        async () => {
          expect(proposeReply).toContain(NOT_ENOUGH_RIGHTS);
          expect(proposeReply).not.toContain('"kind":"proposed"');
          expect(saveRefusal).toContain("NOT_ENOUGH_RIGHTS");
          expect(await documentsOf(run12)).toEqual([]);
          await expect(block(page)).toHaveCount(0);
          await expect(savedDocuments(page)).toHaveCount(0);
        },
      );
    },
  );
});
