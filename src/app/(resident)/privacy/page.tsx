import { ChevronLeft, MapPinCheck, ShieldCheck, Sparkles, UserRoundX } from "lucide-react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { Lang } from "@/lib/types";

interface Section {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}

function content(lang: Lang): Section[] {
  if (lang === "es") {
    return [
      {
        icon: UserRoundX,
        title: "No necesitas una cuenta",
        body: "Puedes buscar comida sin crear un perfil y sin darnos tu nombre, correo o número de teléfono.",
      },
      {
        icon: ShieldCheck,
        title: "Tu búsqueda sigue siendo privada",
        body: "FoodLink usa tu búsqueda para encontrar recursos y luego la descarta. No creamos un historial de lo que buscaste.",
      },
      {
        icon: MapPinCheck,
        title: "Tú decides si compartes tu ubicación",
        body: "Solo usamos tu ubicación si eliges compartirla. Se usa para mostrar opciones cercanas y no se guarda como un historial de ubicación.",
      },
      {
        icon: Sparkles,
        title: "La IA está para ayudarte",
        body: "FoodLink usa IA para entender mejor lo que necesitas y sugerir recursos. Los datos personales se eliminan antes de cualquier solicitud externa de IA.",
      },
    ];
  }

  return [
    {
      icon: UserRoundX,
      title: "No account required",
      body: "You can look for food without creating a profile or giving us your name, email address, or phone number.",
    },
    {
      icon: ShieldCheck,
      title: "Your search stays private",
      body: "FoodLink uses your search to find resources and then discards it. We do not build a history of what you searched for.",
    },
    {
      icon: MapPinCheck,
      title: "You choose whether to share location",
      body: "Your location is used only when you choose to share it. It helps show nearby options and is not kept as a location history.",
    },
    {
      icon: Sparkles,
      title: "AI is here to help",
      body: "FoodLink uses AI to better understand what you need and suggest useful resources. Personal details are removed before any external AI request.",
    },
  ];
}

export default async function PrivacyPage() {
  const { lang, t } = await getT();
  const sections = content(lang);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-forest">
        <ChevronLeft className="h-5 w-5" aria-hidden />
        {t("results.back")}
      </Link>

      <div className="hero-panel fade-up relative mt-2 overflow-hidden rounded-[28px] border border-mint-line bg-mint/80 p-6 shadow-card backdrop-blur-xl">
        <div className="hero-orb hero-orb-one" aria-hidden />
        <div className="relative">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-forest text-white shadow-card">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="font-display text-[26px] font-semibold text-ink sm:text-[32px]">{t("home.private.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">{t("home.private.body")}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {sections.map(({ icon: Icon, title, body }) => (
          <section key={title} className="interactive-card rounded-2xl border border-line bg-paper/90 p-5 shadow-card backdrop-blur">
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-mint text-forest">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
