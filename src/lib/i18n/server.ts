// Server-side language lookup. The language preference is a plain cookie that
// holds "en" or "es" and nothing else.

import { cookies } from "next/headers";
import type { Lang } from "../types";
import { asLang, LANG_COOKIE, translate, type Key } from "./dictionary";

export async function getLang(): Promise<Lang> {
  return asLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT(): Promise<{ lang: Lang; t: (key: Key, vars?: Record<string, string | number>) => string }> {
  const lang = await getLang();
  return { lang, t: (key, vars) => translate(lang, key, vars) };
}
