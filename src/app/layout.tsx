import type { Metadata, Viewport } from "next";
// Fonts are bundled with the app. Nothing is fetched from Google or any other
// font host, so no third party learns that someone opened FoodLink.
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "FoodLink Alabama: find food near you",
  description:
    "Free, no-sign-up guide to verified food banks, pantries and free meals in Huntsville and Madison County. We never track who you are.",
  // Keep the prototype out of search engines: its data is sample data.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6b45",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full">
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
