import { Card, Icon, ProgressBar, btnPrimary, inputClass } from "../_components/ui";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Вкажіть email і пароль.",
  invalid: "Невірний email або пароль.",
};

// Ілюстративний ран для прев'ю на екрані входу (синтетичні дані, не з бази).
const PREVIEW_TASKS = [
  { name: "Inspect the unit", who: "Andrii", done: true },
  { name: "Prepare the lease", who: "Maria", done: true },
  { name: "Order cleaning", who: "Andrii", done: true },
  { name: "Hand over the keys", who: "Maria", done: false },
  { name: "Record meter readings", who: "Andrii", done: false },
];

function Brand() {
  return (
    <div className="flex items-center gap-2 font-extrabold tracking-[-0.02em]">
      <span className="grid size-9 place-items-center rounded-[12px] bg-primary text-primary-foreground">
        <Icon name="logo" className="size-4" />
      </span>
      Property Workflows
    </div>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6" lang="uk">
      <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* Ліворуч: що це за продукт, у мові панелей референсу. */}
        <Card tint="lime" className="settle relative hidden overflow-hidden p-10 lg:flex lg:min-h-[560px] lg:flex-col">
          <Brand />
          <h2 className="mt-10 max-w-md text-[2.4rem] leading-[1.15] font-extrabold tracking-[-0.03em]">
            Кожне заселення — <span className="text-accent">за одним сценарієм</span>.
          </h2>
          <p className="mt-4 max-w-sm text-base text-foreground/75">
            Запускайте шаблон процесу для кейсу, розподіляйте задачі між колегами й бачте прогрес кожного рану.
          </p>

          {/* Прев'ю рану: та сама мова, що й у застосунку. */}
          <div
            className="relative mt-auto ml-8 -mb-14 rotate-[-1.5deg] rounded-[18px] border-[1.6px] border-card-edge bg-surface p-5 shadow-[0_14px_32px_rgba(64,74,44,0.18)]"
            aria-hidden="true"
            lang="en"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-extrabold tracking-[-0.02em]">Apartment 12, move-in</p>
                <p className="text-xs text-muted-foreground">Tenant move-in</p>
              </div>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">in progress</span>
            </div>
            <div className="mt-4">
              <ProgressBar done={3} total={5} label="3 of 5 done" />
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {PREVIEW_TASKS.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className={`flex items-center gap-2 ${t.done ? "text-muted-foreground line-through decoration-1" : "font-medium"}`}>
                    <span
                      className={`grid size-4 place-items-center rounded-full ${t.done ? "bg-success text-white dark:text-black" : "shadow-[0_0_0_1.5px_rgba(0,0,0,0.25)] dark:shadow-[0_0_0_1.5px_rgba(255,255,255,0.3)]"}`}
                    >
                      {t.done ? <Icon name="check" className="size-2.5" /> : null}
                    </span>
                    {t.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.who}</span>
                </li>
              ))}
            </ul>
          </div>

          <span
            className="absolute top-[46%] right-8 rotate-[6deg] rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold shadow-[0_0_0_3px_rgba(0,0,0,0.047),0_6px_16px_rgba(64,74,44,0.12)]"
            aria-hidden="true"
            lang="en"
          >
            <span className="mr-1.5 inline-grid size-4 place-items-center rounded-full bg-success-soft align-middle text-success">
              <Icon name="check" className="size-2.5" />
            </span>
            Task marked as done
          </span>
        </Card>

        {/* Праворуч: вхід. */}
        <Card className="settle settle-2 flex flex-col justify-center p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">Вхід</h1>
          <p className="mt-1 text-sm text-muted-foreground">Для менеджерів і адміністраторів агенції.</p>

          <form action={login} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@example.test"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Пароль
              <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
            </label>
            {message ? (
              <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                {message}
              </p>
            ) : null}
            <button type="submit" className={`${btnPrimary} mt-2 w-full`}>
              Увійти
            </button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground">Облікові записи створює адміністратор. Реєстрації немає.</p>
        </Card>
      </div>
    </main>
  );
}
