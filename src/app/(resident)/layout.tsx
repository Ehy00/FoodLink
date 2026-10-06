import { BottomNav, PrototypeBanner } from "@/components/chrome";
import { SearchProvider } from "@/components/SearchProvider";

// Resident screens share one phone-width column. On a laptop or projector it is
// centred and framed so it reads like the phone mockups.
export default function ResidentLayout({ children }: LayoutProps<"/">) {
  return (
    <SearchProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-cream sm:my-5 sm:min-h-[calc(100dvh-2.5rem)] sm:overflow-clip sm:rounded-[2rem] sm:border sm:border-line sm:shadow-phone">
        <PrototypeBanner />
        <main className="flex flex-1 flex-col">{children}</main>
        <BottomNav />
      </div>
    </SearchProvider>
  );
}
