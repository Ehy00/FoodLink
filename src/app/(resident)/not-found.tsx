import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-20 text-center">
      <p className="font-display text-lg font-semibold text-ink">{t("detail.notFound")}</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white">
        {t("home.title")}
      </Link>
    </div>
  );
}
