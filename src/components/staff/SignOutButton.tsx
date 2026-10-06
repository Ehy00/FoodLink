"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await postJson("/api/auth/logout", {}).catch(() => null);
        router.push("/organizer/login");
        router.refresh();
      }}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-sm font-bold text-ink"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      Sign out
    </button>
  );
}
