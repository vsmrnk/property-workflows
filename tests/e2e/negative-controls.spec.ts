// НЕГАТИВНИЙ КОНТРОЛЬ — навмисно хибне очікування (формат — materials/uat/examples/negative-controls.spec.ts курсу).
// Не AC-тест: назва починається з NC-, а не з AC ID, тож ac:coverage його не рахує. У звичайному прогоні його немає
// (проєкт chromium має grepInvert @negative-control); запуск: npm run uat:nc -- --url … (UAT_NEGATIVE_CONTROLS=1).
// Лише читання: безпечно на проді.
// NC-1 — у тесті неправильний очікуваний текст («Access denied» замість «Not enough rights» з AC-EDITOR-07) →
// перевірка падає → вердикт FAIL (R1), хоч би що сказав агент-рецензент.
// NC-2 (зріз 3) — у тесті неправильний лічильник («Your tasks: 2 of 2 done» замість «0 of 2» з AC-VENDOR-03) → FAIL.
// Дані NC-2 (вендор V і його ран) створює проєкт setup — той самий, що й для AC-VENDOR-*; прибирає cleanup.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { MANAGER_B_STATE, adminPage, templateLinks } from "./support/templates";
import { stateOf, vendorData } from "./support/vendor";

test.use({ storageState: MANAGER_B_STATE });

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

const WRONG_MESSAGE = "Access denied";

test(
  "NC-1 (AC-EDITOR-07, навмисно хибне очікування в тесті: інший текст повідомлення)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-EDITOR-07" },
      { type: "case", description: "NC-1" },
    ],
  },
  async ({ page, browser }) => {
    let versionsHref = "";
    await given('manager B signed in and the template "Tenant move-in" with versions 1 and 2', async () => {
      const admin = await adminPage(browser);
      try {
        versionsHref = (await templateLinks(admin.page, "Tenant move-in")).versions;
      } finally {
        await admin.ctx.close();
      }
      await page.goto("/");
    });
    await when("B opens the list of versions of this template by a direct link", async () => {
      await page.goto(versionsHref);
    });
    await thenStep(
      page,
      { clause: 'B sees the message "Not enough rights" and no versions.', visible: ['the message "Not enough rights"'] },
      async () => {
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(WRONG_MESSAGE, {
          timeout: 5_000,
        });
      },
    );
  },
);

test.describe("вендор V", () => {
  test.use({ storageState: stateOf("vendor-v") });

  const WRONG_COUNT = "Your tasks: 2 of 2 done";

  test(
    "NC-2 (AC-VENDOR-03, навмисно хибне очікування в тесті: інший лічильник «Your tasks»)",
    {
      tag: ["@negative-control"],
      annotation: [
        { type: "ac", description: "AC-VENDOR-03" },
        { type: "case", description: "NC-2" },
      ],
    },
    async ({ page }) => {
      await given('vendor V who is the assignee of 2 tasks in the run "Apartment 12, move-in"', async () => {
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText(vendorData().users["vendor-v"].email);
      });
      await when("V opens the list of runs", async () => {
        await page.goto("/");
      });
      await thenStep(
        page,
        {
          clause: 'V sees only the run "Apartment 12, move-in" with its run status and "Your tasks: 0 of 2 done", and does not see "Apartment 14, repair".',
          visible: ['"Your tasks: 0 of 2 done"'],
        },
        async () => {
          await expect(page.getByTestId("vendor-run").first().getByTestId("your-tasks")).toHaveText(WRONG_COUNT, {
            timeout: 5_000,
          });
        },
      );
    },
  );
});
