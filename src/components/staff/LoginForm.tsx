"use client";

// Two-step sign-in: password first, then a 6-digit code from an authenticator app.

import { KeyRound, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, postJson } from "@/lib/client-api";
import { ErrorNote, Field, primaryButton, TextInput } from "./ui";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "code">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await postJson<{ next: "code" | "setup" }>("/api/auth/login", { identifier, password });
      setPassword("");
      if (r.next === "setup") router.push("/organizer/setup-2fa");
      else setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await postJson<{ next: string }>("/api/auth/verify-2fa", { code });
      router.push(r.next);
      router.refresh();
    } catch (err) {
      setCode("");
      setError(err instanceof ApiError ? err.message : "Could not check the code.");
      if (err instanceof ApiError && (err.status === 429 || /timed out/.test(err.message))) setStep("password");
    } finally {
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <div className="flex items-center gap-2.5 text-ink">
          <Smartphone className="h-6 w-6 text-forest" aria-hidden />
          <h1 className="font-display text-xl font-semibold">Enter your 6-digit code</h1>
        </div>
        <p className="text-sm text-muted">Open your authenticator app and type the code for FoodLink. Step 2 of 2.</p>
        <Field label="Authentication code" htmlFor="code">
          <TextInput
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            pattern="\d{6}"
            className="text-center font-display text-2xl tracking-[0.4em]"
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" disabled={busy || code.length !== 6} className={`${primaryButton} w-full`}>
          Verify and sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="space-y-4">
      <div className="flex items-center gap-2.5 text-ink">
        <KeyRound className="h-6 w-6 text-forest" aria-hidden />
        <h1 className="font-display text-xl font-semibold">Organizer sign-in</h1>
      </div>
      <p className="text-sm text-muted">
        For verified food banks, churches and nonprofits. Sign in with your FoodLink organization ID and password. People looking for food never need an account.
      </p>
      <Field label="Organization ID" htmlFor="identifier">
        <TextInput
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value.trim())}
          autoComplete="username"
          placeholder="e.g. user_demo_organizer"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <TextInput
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
        Continue
      </button>
      <p className="rounded-xl bg-cream px-3 py-2 text-xs text-muted">
        Demo account IDs: <strong className="text-ink">user_demo_organizer</strong> and <strong className="text-ink">user_demo_reviewer</strong>. Use the matching demo password from your local .env.local file.
      </p>
      <p className="text-center text-sm text-muted">
        New organization?{" "}
        <Link href="/organizer/apply" className="font-bold text-forest underline">
          Apply for an account
        </Link>
      </p>
    </form>
  );
}
