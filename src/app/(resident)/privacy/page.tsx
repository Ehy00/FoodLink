// Plain-language privacy page. Every statement here describes something the
// code actually does; see docs/SECURITY.md for where each one is implemented.

import { ChevronLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getLlmClient } from "@/lib/ai/llm";
import { getT } from "@/lib/i18n/server";
import type { Lang } from "@/lib/types";

interface Section {
  title: string;
  points: string[];
}

function content(lang: Lang, aiModelOn: boolean): Section[] {
  if (lang === "es") {
    return [
      {
        title: "Lo que nunca pedimos ni guardamos",
        points: [
          "No hay cuentas para quienes buscan comida. No pedimos tu nombre, correo, teléfono ni identificación.",
          "No guardamos lo que escribes, tu código postal ni tu ubicación.",
          "No usamos anuncios, analíticas ni rastreadores.",
        ],
      },
      {
        title: "Qué pasa cuando buscas",
        points: [
          "Tus palabras se envían a FoodLink, se convierten en etiquetas de filtro y se descartan. No se escriben en ninguna base de datos ni registro.",
          aiModelOn
            ? "Ahora mismo la búsqueda con IA usa un modelo de lenguaje de Anthropic. Antes de enviarle tus palabras quitamos teléfonos, correos, direcciones y números largos, y no adjuntamos nada que te identifique."
            : "Ahora mismo la búsqueda con IA funciona por completo dentro de FoodLink. Tus palabras no se envían a ninguna otra empresa.",
          "La IA solo sugiere filtros que puedes cambiar. Nunca decide quién puede recibir comida.",
          "Tu búsqueda nunca aparece en la dirección web, así que no queda en el historial del navegador.",
        ],
      },
      {
        title: "Tu ubicación",
        points: [
          "Solo se usa si tocas “Usar mi ubicación una vez”.",
          "Tu teléfono la redondea a más o menos una cuadra antes de enviarla. Se usa para ordenar por distancia y no se guarda.",
        ],
      },
      {
        title: "Lo que queda en tu teléfono",
        points: [
          "Tu preferencia de idioma.",
          "El código postal de Alertas, solo si decides guardarlo. Puedes borrarlo con “Olvidar este código postal”.",
        ],
      },
      {
        title: "Lo que sí guardamos",
        points: [
          "“Sí, recibí comida”: el lugar y la fecha. Nada sobre ti.",
          "Reportes: el lugar, el motivo, la fecha y tu nota. Quitamos teléfonos y correos de la nota. Una persona revisa cada reporte.",
          "Para frenar a los bots contamos solicitudes con una versión cifrada de tu dirección de red que cambia cada día y solo vive en la memoria del servidor.",
        ],
      },
      {
        title: "Otros sitios",
        points: [
          "Las imágenes del mapa vienen de OpenStreetMap. Ellos ven qué parte del mapa se pidió, no quién eres ni por qué.",
          "“Cómo llegar” abre tu aplicación de mapas solo con la dirección del lugar. “Llamar” usa tu teléfono.",
          "La empresa que aloja el servidor puede guardar registros técnicos de conexión, como cualquier sitio web. Como tu búsqueda y tu ubicación nunca van en la dirección web, esos registros no pueden contenerlas.",
        ],
      },
      {
        title: "Organizadores",
        points: [
          "Solo las organizaciones verificadas pueden publicar, y deben usar verificación en dos pasos.",
          "Su correo, teléfono y clave de dos pasos se guardan cifrados. Cada publicación pasa por una revisión con IA y por una persona antes de mostrarse.",
        ],
      },
    ];
  }
  return [
    {
      title: "What we never ask for or keep",
      points: [
        "There are no accounts for people looking for food. We do not ask for your name, email, phone number or ID.",
        "We do not save what you type, your ZIP code or your location.",
        "No ads, no analytics and no trackers.",
      ],
    },
    {
      title: "What happens when you search",
      points: [
        "Your words are sent to FoodLink, turned into filter tags, and thrown away. They are not written to any database or log.",
        aiModelOn
          ? "Right now AI search uses a language model from Anthropic. Before your words are sent to it we remove phone numbers, emails, street addresses and long numbers, and we attach nothing that identifies you."
          : "Right now AI search runs entirely inside FoodLink. Your words are not sent to any other company.",
        "The AI only suggests filters that you can change. It never decides who can get food.",
        "Your search never appears in the web address, so it is not left in your browser history.",
      ],
    },
    {
      title: "Your location",
      points: [
        "Used only if you tap “Use my location once”.",
        "Your phone rounds it to about one city block before sending it. It is used to sort by distance and is not stored.",
      ],
    },
    {
      title: "What stays on your phone",
      points: [
        "Your language choice.",
        "Your Alerts ZIP code, only if you choose to save it. Remove it any time with “Forget this ZIP code”.",
      ],
    },
    {
      title: "What we do store",
      points: [
        "“Yes, I got food”: the place and the date. Nothing about you.",
        "Reports: the place, the reason, the date and your note. We strip phone numbers and emails out of the note. A person reviews every report.",
        "To stop bots we count requests using a scrambled version of your network address that changes every day and lives only in the server's memory.",
      ],
    },
    {
      title: "Other sites",
      points: [
        "Map pictures come from OpenStreetMap. They see which part of the map was requested, not who you are or why.",
        "“Directions” opens your maps app with only the destination address. “Call” uses your phone.",
        "The company that hosts the server may keep technical connection logs, like any website. Because your search and location never go in the web address, those logs cannot contain them.",
      ],
    },
    {
      title: "Organizers",
      points: [
        "Only verified organizations can post, and they must use two-step sign-in.",
        "Their email, phone number and two-step secret are stored encrypted. Every post is screened by AI and approved by a person before it is shown.",
      ],
    },
  ];
}

export default async function PrivacyPage() {
  const { lang, t } = await getT();
  const sections = content(lang, getLlmClient() !== null);
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
          <h1 className="font-display text-[26px] font-semibold text-ink sm:text-[32px]">{t("privacy.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">{t("security.center.body")}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {sections.map((s) => (
          <section key={s.title} className="interactive-card rounded-2xl border border-line bg-paper/90 p-5 shadow-card backdrop-blur">
            <h2 className="font-display text-[15px] font-semibold text-ink">{s.title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-snug text-body">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-muted">
        <Link href="/organizer/login" className="underline">
          {lang === "es" ? "Acceso para organizadores" : "Organizer sign-in"}
        </Link>
      </p>
    </div>
  );
}
