// UAT зрізу 3 «Assign a vendor and let the vendor work on their own tasks» (requirements/39-assign-vendor-own-tasks.md,
// openspec/specs/vendor-access/spec.md): по одному test на кожен AC-VENDOR-01…10, «Тоді» — дослівно з AC PM.
// Дані «Дано» — синтетичні uat-<run>-…@example.test і їхні рани: їх створює проєкт setup (auth.setup.ts, без запису),
// прибирає cleanup.teardown.ts. Тому всі тести — @writes і потребують SUPABASE_SECRET_KEY у .env.local.
// Відмови «напряму, оминаючи сторінки» (AC-VENDOR-07, AC-VENDOR-09) доводить тест бази tests/db/vendor-access-db.test.ts;
// тут — сам прямий запит (supabase-js у Node, не в trace) і крок, що показує на екрані «що не змінилося».
import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient } from "./support/admin";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { apiAs, launchAs, stateOf, vendorData, type UatKey } from "./support/vendor";

const NOT_ENOUGH_RIGHTS = "Not enough rights";
const RUN_NOT_FOUND = "Run not found";
const NO_VENDOR_TASKS = "No tasks assigned to you yet.";
const EMAIL = /^[\w.+-]+@example\.test$/;
const tag = (required: boolean) => (required ? "required" : "optional");

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

/** Сторінка під синтетичним користувачем в окремому контексті (стан сесії — з setup). */
async function pageAs(browser: Browser, key: UatKey): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ storageState: stateOf(key) });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

const runTasks = (page: Page) => page.getByTestId("run-task");
const cellTexts = async (page: Page, testId: string) =>
  (await runTasks(page).getByTestId(testId).allTextContents()).map((s) => s.trim());

test.describe("менеджер A", () => {
  test.use({ storageState: stateOf("manager-a") });

  test(
    "AC-VENDOR-01: менеджер A запускає «Tenant move-in» для «Apartment 12, move-in» з V на задачах 3 і 4 — задачі 3 і 4 за V, 1, 2 і 5 за A",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-01" } },
    async ({ page }) => {
      const data = vendorData();
      const a = data.users["manager-a"];
      const v = data.users["vendor-x"];

      await given('manager A, vendor V and the template "Tenant move-in" with 5 tasks', async () => {
        await page.goto("/runs/new");
        await expect(page.getByTestId("user-email")).toHaveText(a.email);
        await page.getByRole("link", { name: "Launch “Tenant move-in”" }).click();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Launch “Tenant move-in”");
        await expect(page.getByRole("combobox"), "шаблон на проді має рівно 5 задач").toHaveCount(5);
      });

      await when('A launches the template for the case "Apartment 12, move-in" and assigns V as the assignee of tasks 3 and 4', async () => {
        await page.getByLabel("Case name").fill("Apartment 12, move-in");
        for (const n of [2, 3]) {
          await page.getByRole("combobox").nth(n).click();
          await page.getByRole("option").filter({ hasText: v.email }).click();
          await expect(page.getByRole("combobox").nth(n)).toContainText(v.email);
        }
        await page.getByRole("button", { name: "Launch run" }).click();
        await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
        await expect(page.getByTestId("case-name")).toHaveText("Apartment 12, move-in");
      });

      await thenStep(
        page,
        {
          clause: "tasks 3 and 4 have V as the assignee, and tasks 1, 2 and 5 have A.",
          visible: [`tasks 3 and 4 show the assignee ${v.email} (V)`, `tasks 1, 2 and 5 show the assignee ${a.email} (A)`],
          hidden: ["the order of tasks on the page is the order of the template (sections, then tasks)"],
        },
        async () => {
          await expect(runTasks(page)).toHaveCount(5);
          expect(await cellTexts(page, "task-assignee")).toEqual([a.email, a.email, v.email, v.email, a.email]);
          expect((await runTasks(page).locator("td:first-child").allTextContents()).map((s) => s.trim())).toEqual(
            data.template.tasks.map((t) => expect.stringContaining(t.name)),
          );
        },
      );
    },
  );

  test(
    "AC-VENDOR-02: менеджер A у виборі виконавця бачить email B, адміністратора й V, без імен, ролей та інших даних профілю",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-02" } },
    async ({ page }) => {
      const data = vendorData();
      const v = data.users["vendor-x"];
      let options: string[] = [];

      await given("managers A and B, an administrator and vendor V, and A launching a template", async () => {
        await page.goto(`/runs/new?template=${data.template.id}`);
        await expect(page.getByTestId("user-email")).toHaveText(data.users["manager-a"].email);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Launch “Tenant move-in”");
      });

      await when("A opens the assignee picker", async () => {
        await page.getByRole("combobox").first().click();
        await expect(page.getByRole("listbox")).toBeVisible();
        // Текст пункту — без аватара-ініціала (span.truncate — сам підпис пункту).
        options = (await page.getByRole("option").locator("span.truncate").allTextContents()).map((s) => s.trim());
      });

      await thenStep(
        page,
        {
          clause: "A sees the emails of B, of the administrator and of V, and no names, roles or other profile data.",
          visible: [
            "the email manager-b@example.test (B) in the list",
            "the email admin@example.test (the administrator) in the list",
            `the email ${v.email} (V) in the list`,
            "every entry is only an email (or «Me (run manager)»): no names and no role labels",
          ],
        },
        async () => {
          expect(options).toEqual(expect.arrayContaining(["manager-b@example.test", "admin@example.test", v.email]));
          for (const option of options) expect(option === "Me (run manager)" || EMAIL.test(option), `«${option}» — лише email`).toBe(true);
          // Імен (full_name демо-акаунтів: «… Demo-…») у списку немає.
          await expect(page.getByRole("listbox")).not.toContainText("Demo-");
        },
      );
    },
  );
});

test.describe("вендор V", () => {
  test.use({ storageState: stateOf("vendor-v") });

  test(
    "AC-VENDOR-03: вендор V бачить лише «Apartment 12, move-in» зі статусом рану й «Your tasks: 0 of 2 done», без «Apartment 14, repair»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-03" } },
    async ({ page, browser }) => {
      const data = vendorData();

      await given('vendor V who is the assignee of 2 tasks in the run "Apartment 12, move-in" and of no task in the run "Apartment 14, repair"', async () => {
        // «Дано» звіряємо очима менеджера A: обидва рани існують, у «Apartment 12, move-in» у V рівно 2 задачі.
        const a = await pageAs(browser, "manager-a");
        try {
          await a.page.goto(`/runs/${data.runs.run12}`);
          expect((await cellTexts(a.page, "task-assignee")).filter((e) => e === data.users["vendor-v"].email)).toHaveLength(2);
          await a.page.goto(`/runs/${data.runs.run14}`);
          await expect(a.page.getByTestId("case-name")).toHaveText("Apartment 14, repair");
          expect(await cellTexts(a.page, "task-assignee")).not.toContain(data.users["vendor-v"].email);
        } finally {
          await a.close();
        }
      });

      await when("V opens the list of runs", async () => {
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText(data.users["vendor-v"].email);
      });

      await thenStep(
        page,
        {
          clause: 'V sees only the run "Apartment 12, move-in" with its run status and "Your tasks: 0 of 2 done", and does not see "Apartment 14, repair".',
          visible: ['one run "Apartment 12, move-in"', 'its run status "in progress"', '"Your tasks: 0 of 2 done"'],
          hidden: ['"Apartment 14, repair" is nowhere on the page'],
        },
        async () => {
          const rows = page.getByTestId("vendor-run");
          await expect(rows).toHaveCount(1);
          await expect(rows.first()).toContainText("Apartment 12, move-in");
          await expect(rows.first().getByTestId("run-status")).toHaveText("in progress");
          await expect(rows.first().getByTestId("your-tasks")).toHaveText("Your tasks: 0 of 2 done");
          await expect(page.locator("body")).not.toContainText("Apartment 14, repair");
        },
      );
    },
  );

  test(
    "AC-VENDOR-04: вендор V у рані «Apartment 12, move-in» бачить рівно задачі 3 і 4 з назвою, секцією, позначкою й статусом — без задач 1, 2, 5, email інших і прогресу рану",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-04" } },
    async ({ page }) => {
      const data = vendorData();
      const [t1, t2, t3, t4, t5] = data.template.tasks;

      await given('vendor V who is the assignee of tasks 3 and 4 in the run "Apartment 12, move-in" (5 tasks)', async () => {
        expect(data.template.tasks).toHaveLength(5);
        await page.goto("/");
        await expect(page.getByTestId("vendor-run")).toHaveCount(1);
      });

      await when("V opens this run", async () => {
        await page.getByRole("link", { name: "Apartment 12, move-in" }).click();
        await expect(page.getByTestId("case-name")).toHaveText("Apartment 12, move-in");
      });

      await thenStep(
        page,
        {
          clause:
            'V sees exactly tasks 3 and 4, each with its name, its section, the mark "required" or "optional" and its status, and does not see tasks 1, 2 and 5, the emails of other users or the progress of the whole run.',
          visible: [
            `exactly two tasks: "${t3.name}" and "${t4.name}"`,
            `their sections "${t3.section}" and "${t4.section}"`,
            `their marks "${tag(t3.required)}" and "${tag(t4.required)}"`,
            'their status "to do"',
          ],
          hidden: [
            `no tasks "${t1.name}", "${t2.name}", "${t5.name}" anywhere on the page`,
            "no email except V's own in the header; no assignee column",
            'no progress of the whole run: no progress bar and no "N of 5 done"',
          ],
        },
        async () => {
          await expect(runTasks(page)).toHaveCount(2);
          expect(await cellTexts(page, "task-name")).toEqual([t3.name, t4.name]);
          expect(await cellTexts(page, "task-section")).toEqual([t3.section, t4.section]);
          expect(await cellTexts(page, "task-requirement")).toEqual([tag(t3.required), tag(t4.required)]);
          expect(await cellTexts(page, "task-status")).toEqual(["to do", "to do"]);
          for (const t of [t1, t2, t5]) await expect(page.locator("main")).not.toContainText(t.name);
          const emails = (await page.content()).match(/[\w.+-]+@example\.test/g) ?? [];
          expect(new Set(emails)).toEqual(new Set([data.users["vendor-v"].email]));
          await expect(page.getByTestId("task-assignee")).toHaveCount(0);
          await expect(page.getByRole("progressbar")).toHaveCount(0);
          await expect(page.locator("main")).not.toContainText(/of 5 done/);
        },
      );
    },
  );

  test(
    "AC-VENDOR-06: вендор V за прямим посиланням на «Apartment 14, repair» бачить «Run not found» і жодної задачі рану",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-06" } },
    async ({ page }) => {
      const data = vendorData();

      await given('the run "Apartment 14, repair" in which vendor V has no task', async () => {
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText(data.users["vendor-v"].email);
        await expect(page.locator("main")).not.toContainText("Apartment 14, repair");
      });

      await when("V opens the page of this run by a direct link", async () => {
        await page.goto(`/runs/${data.runs.run14}`);
      });

      await thenStep(
        page,
        {
          clause: 'V sees the message "Run not found" and none of the tasks of the run.',
          visible: ['the message "Run not found"'],
          hidden: ['no task rows; no case name "Apartment 14, repair"'],
        },
        async () => {
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(RUN_NOT_FOUND);
          await expect(runTasks(page)).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText("Apartment 14, repair");
        },
      );
    },
  );

  test(
    "AC-VENDOR-07: вендор V позначає задачу 1 менеджера A напряму, оминаючи сторінки, — задача 1 лишається «to do»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-07" } },
    async ({ browser }) => {
      const data = vendorData();
      let task1 = "";
      let refusal = "";

      await given('the run "Apartment 12, move-in" in which task 1 is assigned to manager A and tasks 3 and 4 to vendor V', async () => {
        const { data: rows, error } = await adminClient()
          .from("run_tasks")
          .select("id, assignee_id, status")
          .eq("run_id", data.runs.run12)
          .order("section_position")
          .order("position");
        if (error) throw error;
        expect(rows?.map((r) => r.assignee_id)).toEqual([
          data.users["manager-a"].id,
          data.users["manager-a"].id,
          data.users["vendor-v"].id,
          data.users["vendor-v"].id,
          data.users["manager-a"].id,
        ]);
        task1 = rows![0].id;
        expect(rows![0].status).toBe("to_do");
      });

      await when("V tries to mark task 1 as done directly, bypassing the pages of the application", async () => {
        const v = await apiAs(data.users["vendor-v"]);
        const { error } = await v.rpc("mark_task_done", { p_task_id: task1 });
        refusal = error?.message ?? "";
        await test.info().attach("direct-request.json", {
          body: JSON.stringify({ rpc: "mark_task_done", task: "task 1", refused: Boolean(error), message: refusal }, null, 2),
          contentType: "application/json",
        });
      });

      // Що не змінилося, видно на сторінці рану менеджера A (вендор задачі 1 не бачить — AC-VENDOR-04).
      const a = await pageAs(browser, "manager-a");
      try {
        await a.page.goto(`/runs/${data.runs.run12}`);
        await thenStep(
          a.page,
          {
            clause: 'task 1 stays "to do".',
            visible: [`task 1 "${data.template.tasks[0].name}" with the status "to do" on the page of the run (manager A)`],
            hidden: ["the direct request was refused with NOT_ALLOWED; in the database task 1 is still to_do"],
          },
          async () => {
            expect(refusal).toContain("NOT_ALLOWED");
            await expect(runTasks(a.page).first()).toContainText(data.template.tasks[0].name);
            await expect(runTasks(a.page).first().getByTestId("task-status")).toHaveText("to do");
            const { data: row } = await adminClient().from("run_tasks").select("status, done_by").eq("id", task1).single();
            expect(row).toEqual({ status: "to_do", done_by: null });
          },
        );
      } finally {
        await a.close();
      }
    },
  );

  test(
    "AC-VENDOR-08: вендор V за прямим посиланням на список шаблонів бачить «Not enough rights» і жодного шаблону",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-08" } },
    async ({ page }) => {
      const data = vendorData();

      await given("vendor V signed in", async () => {
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText(data.users["vendor-v"].email);
      });

      await when("V opens the list of templates by a direct link", async () => {
        await page.goto("/templates");
      });

      await thenStep(
        page,
        {
          clause: 'V sees the message "Not enough rights" and no template.',
          visible: ['the message "Not enough rights"'],
          hidden: ['no templates table and no template names ("Tenant move-in", "Maintenance request")'],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(NOT_ENOUGH_RIGHTS);
          await expect(page.getByTestId("templates")).toHaveCount(0);
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.locator("main")).not.toContainText(/Tenant move-in|Maintenance request/);
        },
      );
    },
  );

  test(
    "AC-VENDOR-09: вендор V запускає «Tenant move-in» напряму, оминаючи сторінки, — рану не створено, список ранів не змінився",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-09" } },
    async ({ page }) => {
      const data = vendorData();
      let before: string[] = [];
      let refusal = "";

      await given('vendor V signed in and the template "Tenant move-in" with current version 1', async () => {
        // На проді «Tenant move-in» має ту поточну версію, яку лишили попередні зрізи (UAT WS8 зберіг версію 2);
        // на «Тоді» номер версії не впливає. Звіряємо: шаблон збережено як версію, і V бачить свій список ранів.
        expect(data.template.version).toBeGreaterThanOrEqual(1);
        await test.info().attach("given-template.json", {
          body: JSON.stringify({ template: data.template.name, currentVersion: data.template.version }, null, 2),
          contentType: "application/json",
        });
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText(data.users["vendor-v"].email);
        before = (await page.getByTestId("vendor-run").allTextContents()).map((s) => s.trim());
        expect(before).toHaveLength(1);
      });

      await when("V tries to launch this template directly, bypassing the pages of the application", async () => {
        const v = await apiAs(data.users["vendor-v"]);
        const result = await launchAs(v, data.template.id, "Apartment 15, move-in").then(
          (id) => `created ${id}`,
          (e: Error) => e.message,
        );
        refusal = result;
        await test.info().attach("direct-request.json", {
          body: JSON.stringify({ rpc: "launch_run", template: data.template.name, result }, null, 2),
          contentType: "application/json",
        });
        await page.reload();
      });

      await thenStep(
        page,
        {
          clause: "no run is created, and the list of runs does not change.",
          visible: ['the list of runs of V shows the same single run "Apartment 12, move-in" as before'],
          hidden: ['the direct request was refused with NOT_ALLOWED; no run "Apartment 15, move-in" exists in the database'],
        },
        async () => {
          expect(refusal).toContain("NOT_ALLOWED");
          expect((await page.getByTestId("vendor-run").allTextContents()).map((s) => s.trim())).toEqual(before);
          await expect(page.locator("main")).not.toContainText("Apartment 15, move-in");
          const { count } = await adminClient()
            .from("runs")
            .select("id", { count: "exact", head: true })
            .eq("case_name", "Apartment 15, move-in");
          expect(count).toBe(0);
        },
      );
    },
  );
});

test.describe("вендор V (позначка задачі)", () => {
  test.use({ storageState: stateOf("vendor-y") });

  test(
    "AC-VENDOR-05: вендор V позначає задачу 3 — вона «done», і V бачить «Your tasks: 1 of 2 done»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-05" } },
    async ({ page, browser }) => {
      const data = vendorData();
      const t3 = data.template.tasks[2];

      await given('vendor V who is the assignee of task 3 with status "to do", which is not the last required task of the run "Apartment 12, move-in"', async () => {
        await page.goto(`/runs/${data.runs.run12y}`);
        await expect(page.getByTestId("user-email")).toHaveText(data.users["vendor-y"].email);
        await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 0 of 2 done");
        await expect(runTasks(page).first().getByTestId("task-name")).toHaveText(t3.name);
        await expect(runTasks(page).first().getByTestId("task-status")).toHaveText("to do");
        // Не остання обов'язкова: обов'язкові задачі менеджера A (1 і 2) ще «to do».
        expect(data.template.tasks.slice(0, 2).some((t) => t.required)).toBe(true);
      });

      await when("V marks task 3 as done", async () => {
        await page.getByRole("button", { name: `Mark “${t3.name}” as done` }).click();
        // Не остання обов'язкова — без підтвердження.
        await expect(page.getByTestId("confirm-last-required")).toHaveCount(0);
        await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 2 done");
      });

      await thenStep(
        page,
        {
          clause: 'task 3 has status "done", and V sees "Your tasks: 1 of 2 done".',
          visible: [`task "${t3.name}" with the status "done"`, '"Your tasks: 1 of 2 done"'],
        },
        async () => {
          await expect(runTasks(page).first().getByTestId("task-status")).toHaveText("done");
          await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 2 done");
        },
      );

      // Крок 5 основного сценарію PM (не частина «Тоді»): менеджер рану бачить новий статус і прогрес рану.
      await test.step("Менеджер рану A бачить задачу 3 «done» і прогрес «1 of 5 done»", async () => {
        const a = await pageAs(browser, "manager-a");
        try {
          await a.page.goto(`/runs/${data.runs.run12y}`);
          await expect(runTasks(a.page).nth(2).getByTestId("task-status")).toHaveText("done");
          await expect(a.page.getByTestId("run-progress").first()).toHaveText("1 of 5 done");
        } finally {
          await a.close();
        }
      });
    },
  );
});

test.describe("вендор без задач", () => {
  test.use({ storageState: stateOf("vendor-w") });

  test(
    "AC-VENDOR-10: вендор V без жодної задачі бачить «No tasks assigned to you yet.» і жодної порожньої таблиці",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-10" } },
    async ({ page }) => {
      const data = vendorData();

      await given("vendor V to whom no task is assigned", async () => {
        const { count } = await adminClient()
          .from("run_tasks")
          .select("id", { count: "exact", head: true })
          .eq("assignee_id", data.users["vendor-w"].id);
        expect(count).toBe(0);
      });

      await when("V opens the list of runs", async () => {
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText(data.users["vendor-w"].email);
      });

      await thenStep(
        page,
        {
          clause: 'V sees the message "No tasks assigned to you yet." and no empty table.',
          visible: ['the message "No tasks assigned to you yet."'],
          hidden: ["no table element on the page"],
        },
        async () => {
          await expect(page.getByTestId("vendor-runs-empty")).toHaveText(NO_VENDOR_TASKS);
          await expect(page.getByRole("table")).toHaveCount(0);
        },
      );
    },
  );
});
