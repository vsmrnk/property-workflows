// UAT зрізу «Редагування шаблону й версії» (requirements/20-edit-template-version-control.md): список версій.
// Лише читання: тести нічого не пишуть у базу, тож безпечні на проді. Дані «Дано» готує людина в UI заздалегідь
// (docs/qa/uat/README.md): «Tenant move-in» з версіями 1 і 2, новий шаблон «Repair» без жодної версії.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { ADMIN_STATE, MANAGER_B_STATE, adminPage, templateLinks, versionLabels } from "./support/templates";

const NOT_ENOUGH_RIGHTS = "Not enough rights";
const NO_VERSIONS = "No versions yet. Save the template to create version 1.";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.describe("менеджер B", () => {
  test.use({ storageState: MANAGER_B_STATE });

  test(
    "AC-EDITOR-07: менеджер B за прямим посиланням на версії «Tenant move-in» бачить «Not enough rights» і жодної версії",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-EDITOR-07" } },
    async ({ page, browser }) => {
      let versionsHref = "";

      await given('manager B signed in and the template "Tenant move-in" with versions 1 and 2', async () => {
        // Версії бачить лише адміністратор: «Дано» звіряємо його сесією в окремому контексті.
        const admin = await adminPage(browser);
        try {
          versionsHref = (await templateLinks(admin.page, "Tenant move-in")).versions;
          expect(await versionLabels(admin.page, versionsHref)).toEqual(["Version 2", "Version 1"]);
        } finally {
          await admin.ctx.close();
        }
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText("manager-b@example.test");
        await expect(page.getByTestId("user-role")).toHaveText(/manager/i);
      });

      await when("B opens the list of versions of this template by a direct link", async () => {
        await page.goto(versionsHref);
      });

      await thenStep(
        page,
        {
          clause: 'B sees the message "Not enough rights" and no versions.',
          visible: ['the message "Not enough rights"'],
          hidden: [
            "no versions: no versions table, no version rows and no «Version 1» / «Version 2» anywhere on the page",
          ],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(NOT_ENOUGH_RIGHTS);
          await expect(page.getByTestId("versions")).toHaveCount(0);
          await expect(page.getByTestId("version")).toHaveCount(0);
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText(/Version \d/);
        },
      );
    },
  );
});

test.describe("адміністратор A", () => {
  test.use({ storageState: ADMIN_STATE });

  test(
    "AC-EDITOR-18: адміністратор A відкриває версії нового шаблону «Repair» — «No versions yet. Save the template to create version 1.» і без порожньої таблиці",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-EDITOR-18" } },
    async ({ page }) => {
      await given('administrator A and the new template "Repair" that has never been saved as a version', async () => {
        await page.goto("/templates");
        await expect(page.getByTestId("user-email")).toHaveText("admin@example.test");
        await expect(page.getByTestId("user-role")).toHaveText(/admin/i);
        const versionsLink = page.getByRole("link", { name: "Versions of “Repair”", exact: true });
        const row = page.getByTestId("templates").getByRole("row").filter({ has: versionsLink });
        await expect(row).toHaveCount(1);
        // Шаблон без версії не можна запустити: у рядку немає «Launch».
        await expect(row.getByRole("link", { name: /^Launch/ })).toHaveCount(0);
      });

      await when('A opens the list of versions of "Repair"', async () => {
        await page.getByRole("link", { name: "Versions of “Repair”", exact: true }).click();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Versions of “Repair”");
      });

      await thenStep(
        page,
        {
          clause: 'A sees the message "No versions yet. Save the template to create version 1." and no empty table.',
          visible: ['the message "No versions yet. Save the template to create version 1."'],
          hidden: ["no empty table: there is no table element on the page (no headers «Version», «Saved», «Saved by»)"],
        },
        async () => {
          await expect(page.getByTestId("versions-empty")).toHaveText(NO_VERSIONS);
          await expect(page.getByRole("main").getByText(NO_VERSIONS, { exact: true })).toBeVisible();
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.getByRole("columnheader")).toHaveCount(0);
        },
      );
    },
  );
});
