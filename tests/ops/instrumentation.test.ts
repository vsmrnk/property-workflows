// WS11 (B): onRequestError — що саме йде в Telegram. Шляхи стеку без абсолютного префікса (ім'я користувача ОС),
// кадри, які не вдалося очистити, відкидаються; дедуплікація без digest розрізняє помилки за очищеним стеком.
// Назви без AC ID: технічна перевірка трекера, а не критерій приймання PM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

type Ctx = Parameters<typeof onRequestError>[2];
const request = { path: "/x?secret=1", method: "GET", headers: {} } as Parameters<typeof onRequestError>[1];
const ctx = (routePath: string) =>
  ({ routerKind: "App Router", routePath, routeType: "route", renderSource: undefined, revalidateReason: undefined }) as unknown as Ctx;

function errorWithStack(frames: string[], message = "boom for user@example.test") {
  const error = new Error(message);
  error.stack = [`Error: ${message}`, ...frames.map((f) => `    ${f}`)].join("\n");
  return error;
}

const fetchMock = vi.fn(async () => new Response("{}"));
const sentTexts = () => fetchMock.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string).text as string);

describe("onRequestError", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "1");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("шляхи стеку — лише від .next/src/node_modules; кадри без такої теки відкинуто; без тексту помилки й query", async () => {
    await onRequestError(
      errorWithStack([
        "at handler (/Users/alice/My Project/src/task.ts:10:2)",
        "at /var/task/.next/server/app/page.js:1:234",
        "at C:\\Users\\alice\\proj\\node_modules\\next\\dist\\server.js:5:6",
        "at secretFn (/home/alice/elsewhere/lib.js:3:4)",
        "at new Promise (<anonymous>)",
        "at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
      ]),
      request,
      ctx("/api/frames"),
    );
    const [text] = sentTexts();
    expect(text).toContain("at handler (src/task.ts:10:2)");
    expect(text).toContain("at .next/server/app/page.js:1:234");
    expect(text).toContain("at node_modules\\next\\dist\\server.js:5:6");
    expect(text).not.toMatch(/alice|My Project|secretFn|anonymous|node:internal|user@example\.test|secret=1/);
  });

  it("без digest: інший стек з тією ж назвою на тому ж маршруті — окреме повідомлення; той самий — пауза", async () => {
    const route = ctx("/api/dedup");
    await onRequestError(errorWithStack(["at a (/var/task/src/a.ts:1:1)"]), request, route);
    await onRequestError(errorWithStack(["at a (/var/task/src/a.ts:1:1)"], "other text"), request, route);
    await onRequestError(errorWithStack(["at b (/var/task/src/b.ts:2:2)"]), request, route);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("з digest: ключ — digest, стек не важить", async () => {
    const route = ctx("/api/digest");
    const withDigest = (frame: string) => Object.assign(errorWithStack([frame]), { digest: "123" });
    await onRequestError(withDigest("at a (/var/task/src/a.ts:1:1)"), request, route);
    await onRequestError(withDigest("at b (/var/task/src/b.ts:2:2)"), request, route);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
