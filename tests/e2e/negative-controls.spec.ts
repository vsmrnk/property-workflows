// НЕГАТИВНИЙ КОНТРОЛЬ — навмисно хибне очікування (формат — materials/uat/examples/negative-controls.spec.ts курсу).
// Не AC-тест: назва починається з NC-, а не з AC ID, тож ac:coverage його не рахує. У звичайному прогоні його немає
// (проєкт chromium має grepInvert @negative-control); запуск: npm run uat:nc -- --url … (UAT_NEGATIVE_CONTROLS=1).
// Лише читання: безпечно на проді.
// NC-1 — у тесті неправильний очікуваний текст («Access denied» замість «Not enough rights» з AC-EDITOR-07) →
// перевірка падає → вердикт FAIL (R1), хоч би що сказав агент-рецензент.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { MANAGER_B_STATE, adminPage, templateLinks } from "./support/templates";

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
