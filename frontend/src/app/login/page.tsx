"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (error) {
      setError(
        error.status === 401
          ? "Wrong email or password."
          : (error.message ?? "Could not sign in. Try again."),
      );
      setPending(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="brand">
          <Logo />
          ReVibe<span className="brand-dot">.</span>
        </div>
        <h1>Sign in</h1>
        <p>Use the admin account set in the app’s settings.</p>
        <form className="login-form" onSubmit={signIn}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="login-error">
              <CircleAlert size={16} />
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-10">
            {pending && (
              <LoaderCircle size={16} className="motion-safe:animate-spin" />
            )}
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
