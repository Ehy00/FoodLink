import { MapPin } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";

/** Frame for organizer and reviewer pages. These are staff tools, so they are English-only in the prototype. */
export function StaffShell({
  area,
  who,
  children,
  narrow = false,
}: {
  area: "Organizers" | "Review team";
  who?: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-white">
              <MapPin className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-semibold text-ink">FoodLink</span>
              <span className="block text-xs text-muted">{area}</span>
            </span>
          </Link>
          {who && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-muted sm:inline">{who}</span>
              <SignOutButton />
            </div>
          )}
        </div>
      </header>
      <main className={`mx-auto px-5 py-6 ${narrow ? "max-w-md" : "max-w-4xl"}`}>{children}</main>
    </div>
  );
}
