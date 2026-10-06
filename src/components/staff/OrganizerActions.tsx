"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/client-api";

/** "Still accurate": one tap re-verifies a listing without changing it. */
export function ReconfirmButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <button
      type="button"
      disabled={state === "busy" || state === "done"}
      onClick={async () => {
        setState("busy");
        try {
          await postJson(`/api/organizer/listings/${listingId}/reconfirm`, {});
          setState("done");
          router.refresh();
        } catch {
          setState("error");
        }
      }}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-mint px-3.5 text-sm font-bold text-forest disabled:opacity-70"
    >
      <Check className="h-4 w-4" aria-hidden />
      <span role="status">{state === "done" ? "Verified today" : state === "error" ? "Try again" : "Still accurate"}</span>
    </button>
  );
}
