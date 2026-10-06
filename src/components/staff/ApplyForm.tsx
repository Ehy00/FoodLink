"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, postJson } from "@/lib/client-api";
import { ErrorNote, Field, primaryButton, TextInput } from "./ui";

export function ApplyForm() {
  const [form, setForm] = useState({ orgName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/apply", form);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your application.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3" role="status">
        <h1 className="font-display text-xl font-semibold text-ink">Application received</h1>
        <p className="text-sm text-body">
          A person on the FoodLink team will call the number you gave to confirm your organization. Once you are
          verified you can sign in and set up two-step sign-in.
        </p>
        <Link href="/organizer/login" className="font-bold text-forest underline">
          Back to sign-in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-2.5 text-ink">
        <Users className="h-6 w-6 text-forest" aria-hidden />
        <h1 className="font-display text-xl font-semibold">Apply for an organizer account</h1>
      </div>
      <p className="text-sm text-muted">
        For food banks, pantries, churches and nonprofits in Madison County. We verify every organization by phone
        before it can post.
      </p>
      <Field label="Organization name" htmlFor="orgName">
        <TextInput id="orgName" value={form.orgName} onChange={set("orgName")} required minLength={3} maxLength={100} autoComplete="organization" />
      </Field>
      <Field label="Work email" htmlFor="apply-email">
        <TextInput id="apply-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
      </Field>
      <Field label="Phone number" hint="Used once, to verify your organization. Stored encrypted." htmlFor="apply-phone">
        <TextInput id="apply-phone" type="tel" value={form.phone} onChange={set("phone")} required autoComplete="tel" />
      </Field>
      <Field label="Choose a password" hint="At least 12 characters. A few random words work well." htmlFor="apply-password">
        <TextInput
          id="apply-password"
          type="password"
          value={form.password}
          onChange={set("password")}
          required
          minLength={12}
          autoComplete="new-password"
        />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
        Send application
      </button>
    </form>
  );
}
