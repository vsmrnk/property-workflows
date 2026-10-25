import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Brand, Card, Icon, ProgressBar } from "../_components/ui";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "Wrong email or password. Check them and try again.",
};

// Ілюстративний ран для прев'ю на екрані входу (синтетичні дані, не з бази).
const PREVIEW_TASKS = [
  { name: "Inspect the unit", who: "Andrii", done: true },
  { name: "Prepare the lease", who: "Maria", done: true },
  { name: "Order cleaning", who: "Andrii", done: true },
  { name: "Hand over the keys", who: "Maria", done: false },
  { name: "Record meter readings", who: "Andrii", done: false },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* Ліворуч: що це за продукт, у мові панелей референсу. */}
        <Card tint="lavender" className="settle relative hidden overflow-hidden p-10 lg:flex lg:min-h-[560px] lg:flex-col">
          <Brand size="lg" />
          <h2 className="mt-10 max-w-md text-display font-extrabold">
            Every move-in, <span className="text-accent-foreground">run the same way</span>.
          </h2>
          <p className="mt-4 max-w-sm text-base text-foreground/75">
            Launch a process template for a case, share the tasks with your colleagues and see the progress of every run.
          </p>

          {/* Прев'ю рану: та сама мова, що й у застосунку. */}
          <div
            className="relative mt-auto ml-8 -mb-14 rotate-[-1.5deg] rounded-2xl border-[1.6px] border-card-edge bg-card p-5 shadow-float"
            aria-hidden="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-extrabold tracking-tight">Apartment 12, move-in</p>
                <p className="text-xs text-muted-foreground">Tenant move-in</p>
              </div>
              <Badge variant="progress" className="px-3 py-1">
                in progress
              </Badge>
            </div>
            <div className="mt-4">
              <ProgressBar done={3} total={5} label="3 of 5 done" />
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {PREVIEW_TASKS.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className={cn("flex items-center gap-2", t.done ? "text-muted-foreground line-through decoration-1" : "font-medium")}>
                    <span
                      className={cn(
                        "grid size-4 place-items-center rounded-full",
                        t.done ? "bg-success text-success-foreground" : "border-[1.5px] border-foreground/30",
                      )}
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
            className="absolute top-[46%] right-8 rotate-[6deg] rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold shadow-float"
            aria-hidden="true"
          >
            <span className="mr-1.5 inline-grid size-4 place-items-center rounded-full bg-status-done align-middle text-status-done-foreground">
              <Icon name="check" className="size-2.5" />
            </span>
            Task marked as done
          </span>
        </Card>

        {/* Праворуч: вхід. */}
        <Card className="settle settle-2 flex flex-col justify-center p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <Brand size="lg" />
          </div>
          <h1 className="text-title font-extrabold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">For the agency&apos;s managers and administrators.</p>

          <form action={login} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@example.test"
                aria-describedby={message ? "login-error" : undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-describedby={message ? "login-error" : undefined}
              />
            </div>
            {message ? (
              <Alert variant="destructive" id="login-error">
                <AlertDescription className="text-destructive">{message}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="mt-2 w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground">Accounts are created by an administrator. There is no sign-up.</p>
        </Card>
      </div>
    </main>
  );
}
