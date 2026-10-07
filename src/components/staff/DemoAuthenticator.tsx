"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/client-api";

interface DemoAccount {
  label: string;
  id: string;
  code: string | null;
}

interface DemoResponse {
  demo: boolean;
  secondsLeft: number;
  accounts: DemoAccount[];
  note: string;
}

export function DemoAuthenticator() {
  const [data, setData] = useState<DemoResponse | null>(null);
  const [seconds, setSeconds] = useState(30);

  async function refresh() {
    try {
      const next = await getJson<DemoResponse>("/api/demo-authenticator");
      setData(next);
      setSeconds(next.secondsLeft);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          void refresh();
          return 30;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="rounded-2xl border border-ai-line bg-ai-soft/70 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ai text-white">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-ink">FoodLink Demo Authenticator</h2>
          <p className="mt-0.5 text-xs text-muted">
            For class/demo use only. Real organizations use Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {data?.accounts.map((account) => (
          <div key={account.id} className="rounded-xl border border-ai-line bg-paper p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{account.label}</p>
            <p className="mt-1 text-xs text-body">{account.id}</p>
            <p className="mt-3 font-display text-3xl font-semibold tracking-[0.25em] text-ai-dark">
              {account.code ? account.code.slice(0, 3) + " " + account.code.slice(3) : "------"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>New code in {seconds}s</span>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-ai transition-[width] duration-1000" style={{ width: `${Math.max(0, Math.min(100, (seconds / 30) * 100))}%` }} />
        </div>
      </div>
    </section>
  );
}
