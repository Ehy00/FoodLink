// Small form and status pieces shared by the staff screens.

import type { InputHTMLAttributes, ReactNode } from "react";
import type { ScreeningResult } from "@/lib/types";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink placeholder:text-muted";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      {children}
    </p>
  );
}

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white disabled:opacity-60";
export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-line bg-paper px-5 text-sm font-bold text-ink disabled:opacity-60";

const RISK_STYLE = {
  low: "bg-mint text-forest",
  medium: "bg-amber-soft text-amber",
  high: "bg-danger-soft text-danger",
} as const;

export function RiskBadge({ risk }: { risk: ScreeningResult["risk"] }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${RISK_STYLE[risk]}`}>
      {risk} risk
    </span>
  );
}

const SEVERITY_DOT = { low: "bg-forest", medium: "bg-[#b7791f]", high: "bg-danger" } as const;

/** The AI screening report. Purple, like everything else the AI produces. */
export function ScreeningPanel({ screening }: { screening: ScreeningResult }) {
  return (
    <div className="rounded-2xl border border-ai-line bg-ai-soft p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm font-semibold text-ai-dark">AI screening</span>
        <RiskBadge risk={screening.risk} />
        <span className="text-xs text-muted">
          {screening.engine === "llm+rules" ? "Language model + rule checks" : "Rule checks"}
        </span>
      </div>
      <p className="mt-2 text-sm text-body">{screening.summary}</p>
      {screening.flags.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {screening.flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-body">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[f.severity]}`} aria-hidden />
              <span>
                <span className="sr-only">{f.severity} severity: </span>
                {f.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs font-medium text-ai-dark">
        The AI only advises. A human reviewer decides whether this is published.
      </p>
    </div>
  );
}
