import { Card, Icon, btnPrimary, inputClass } from "../_components/ui";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Вкажіть email і пароль.",
  invalid: "Невірний email або пароль.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16" lang="uk">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Icon name="logo" className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Property Workflows</h1>
            <p className="mt-1 text-sm text-muted-foreground">Вхід для менеджерів і адміністраторів</p>
          </div>
        </div>
        <Card className="p-6">
          <form action={login} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Email
              <input name="email" type="email" autoComplete="email" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Пароль
              <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
            </label>
            {message ? (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {message}
              </p>
            ) : null}
            <button type="submit" className={`${btnPrimary} w-full`}>
              Увійти
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
