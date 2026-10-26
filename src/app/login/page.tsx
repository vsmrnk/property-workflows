import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand, Card } from "../_components/ui";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "Wrong email or password. Check them and try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Brand />
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-title font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">For the agency&apos;s managers and administrators.</p>

        <Form action={login} className="mt-6 flex flex-col gap-4">
          <Field name="email">
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
            <FieldError match="valueMissing">Enter your email.</FieldError>
            <FieldError match="typeMismatch">Enter an email like name@example.test.</FieldError>
          </Field>
          <Field name="password">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-describedby={message ? "login-error" : undefined}
            />
            <FieldError match="valueMissing">Enter your password.</FieldError>
          </Field>
          {message ? (
            <Alert variant="destructive" id="login-error">
              <AlertDescription className="text-destructive">{message}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="mt-2 w-full">
            Sign in
          </Button>
        </Form>
      </Card>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Accounts are created by an administrator. There is no sign-up.
      </p>
    </main>
  );
}
