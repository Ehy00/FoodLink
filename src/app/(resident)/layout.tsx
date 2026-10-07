import { BottomNav, HeaderControls, Logo } from "@/components/chrome";
import { SearchProvider } from "@/components/SearchProvider";
import { FloatingFoodBackdrop } from "@/components/FloatingFoodBackdrop";

// Responsive resident web app: a wide workspace on desktop and a compact,
// touch-first experience on phones.
export default function ResidentLayout({ children }: LayoutProps<"/">) {
  return (
    <SearchProvider>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col overflow-hidden bg-cream md:min-h-screen md:border-x md:border-line">
        <FloatingFoodBackdrop />
        <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <Logo />
          <HeaderControls />
        </header>
        <div className="relative z-10 hidden border-b border-line bg-paper/85 backdrop-blur-xl md:block">
          <BottomNav />
        </div>
        <main className="relative z-10 flex flex-1 flex-col">{children}</main>
        <div className="relative z-10 md:hidden">
          <BottomNav />
        </div>
      </div>
    </SearchProvider>
  );
}
