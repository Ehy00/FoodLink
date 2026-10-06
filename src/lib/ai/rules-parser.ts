// Rule-based request parser (English and Spanish).
//
// This is the offline half of "Ask FoodLink". It runs with no API key and no
// network, so the demo never depends on wifi, and it is the safety net when
// the language model is slow or unavailable.

import { PILOT_ZIPS } from "../geo";
import type { Audience, Lang, Offer, ParseResult, SearchTags } from "../types";

/** Lowercase and strip accents so "niños" and "ninos" match the same rule. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type Rule<T> = { tag: T; patterns: RegExp[] };

const NEED_RULES: Rule<Offer>[] = [
  {
    tag: "groceries",
    patterns: [
      /\bgrocer(y|ies)\b/,
      /\bfood (box|boxes|bag|bags|bank|pantry)\b/,
      /\bpantr(y|ies)\b/,
      /\bcanned\b/,
      /\bfood to (cook|take home)\b/,
      /\bdespensa\b/,
      /\bcomestibles\b/,
      /\bviveres\b/,
      /\bmandado\b/,
      /\bbanco de (comida|alimentos)\b/,
      /\bcaja(s)? de (comida|alimentos)\b/,
    ],
  },
  {
    tag: "hot_meal",
    patterns: [
      /\b(hot|warm|free|cooked) (meal|meals|food|lunch|dinner|breakfast)\b/,
      /\bmeals?\b/,
      /\b(lunch|dinner|breakfast|supper)\b/,
      /\bsoup kitchen\b/,
      /\bsomething to eat\b/,
      /\beat (now|today|tonight)\b/,
      /\bcomida caliente\b/,
      /\b(almuerzo|cena|desayuno)\b/,
      /\bcomedor\b/,
      /\balgo (de|para) comer\b/,
    ],
  },
  {
    tag: "produce",
    patterns: [/\bproduce\b/, /\bfresh (fruit|fruits|vegetables|veggies)\b/, /\b(frutas|verduras|vegetales)\b/],
  },
  {
    tag: "baby",
    patterns: [/\bbab(y|ies)\b/, /\bformula\b/, /\bdiapers?\b/, /\bbebes?\b/, /\bpanales\b/],
  },
  {
    tag: "hygiene",
    patterns: [/\bhygiene\b/, /\btoiletries\b/, /\bsoap\b/, /\bhigiene\b/, /\bjabon\b/],
  },
];

const AUDIENCE_RULES: Rule<Audience>[] = [
  {
    tag: "kids",
    patterns: [
      /\bkids?\b/,
      /\bchild(ren)?\b/,
      /\b(son|sons|daughter|daughters|toddler|toddlers)\b/,
      /\bninos?\b/,
      /\bninas?\b/,
      /\bhij[oa]s?\b/,
    ],
  },
  { tag: "families", patterns: [/\bfamil(y|ies)\b/, /\bfamilias?\b/, /\bhousehold\b/] },
  {
    tag: "seniors",
    patterns: [
      /\bseniors?\b/,
      /\belderly\b/,
      /\b(grandma|grandpa|grandmother|grandfather)\b/,
      /\bretired\b/,
      /\b(adultos? )?mayores\b/,
      /\btercera edad\b/,
      /\babuel[oa]s?\b/,
      /\bancian[oa]s?\b/,
    ],
  },
  {
    tag: "students",
    patterns: [/\bstudents?\b/, /\bcollege\b/, /\bcampus\b/, /\bdorm\b/, /\bestudiantes?\b/, /\buniversi(dad|tari[oa]s?)\b/],
  },
];

const NO_ID_PATTERNS = [
  /\bno (photo )?id\b/,
  /\bwithout (an? |any |photo )?id\b/,
  /\b(don'?t|do not|dont) have (an? |any |my |a photo )?id\b/,
  /\bno (identification|papers|documents|paperwork)\b/,
  /\bwithout (identification|papers|documents|paperwork)\b/,
  /\bid not (required|needed)\b/,
  /\bsin (id|identificacion|papeles|documentos)\b/,
  /\bno tengo (id|identificacion|papeles|documentos)\b/,
];

const WHEELCHAIR_PATTERNS = [
  /\bwheel ?chair\b/,
  /\baccessible\b/,
  /\bramp\b/,
  /\bwalker\b/,
  /\bdisab(led|ility)\b/,
  /\bsilla de ruedas\b/,
  /\baccesible\b/,
  /\brampa\b/,
  /\bandador\b/,
];

const NOW_PATTERNS = [/\b(right )?now\b/, /\bopen now\b/, /\bimmediately\b/, /\bahora( mismo)?\b/, /\bya\b/];
const TODAY_PATTERNS = [/\btoday\b/, /\btonight\b/, /\bthis (morning|afternoon|evening)\b/, /\bhoy\b/, /\besta (noche|tarde|manana)\b/];

const SPANISH_MARKERS = [
  "para", "mis", "sin", "comida", "necesito", "cerca", "donde", "hoy", "ninos", "gratis",
  "tengo", "ahora", "hijos", "busco", "ayuda", "alimentos", "despensa", "de", "la", "el", "los",
  "una", "con", "quiero", "puedo", "abierto", "familia",
];
const ENGLISH_MARKERS = [
  "the", "for", "my", "need", "near", "where", "today", "free", "food", "kids", "with",
  "without", "open", "now", "have", "and", "is", "a", "i", "can", "get",
];

export function detectLang(text: string): Lang {
  const words = normalize(text).split(/[^a-z0-9']+/).filter(Boolean);
  let es = 0;
  let en = 0;
  for (const w of words) {
    if (SPANISH_MARKERS.includes(w)) es++;
    if (ENGLISH_MARKERS.includes(w)) en++;
  }
  // Spanish punctuation and the letter ñ are strong signals on their own.
  if (/[¿¡ñ]/i.test(text)) es += 2;
  return es > en ? "es" : "en";
}

/** Pull a 5-digit ZIP out of free text. Prefers a pilot-area ZIP if several appear. */
export function extractZip(text: string): string | null {
  const all = text.match(/\b\d{5}\b/g);
  if (!all) return null;
  return all.find((z) => z in PILOT_ZIPS) ?? all[0];
}

function matchAll<T>(rules: Rule<T>[], text: string): T[] {
  return rules.filter((r) => r.patterns.some((p) => p.test(text))).map((r) => r.tag);
}

export function emptyTags(): SearchTags {
  return { needs: [], audiences: [], noId: false, wheelchair: false, when: "any", zip: null };
}

export function parseWithRules(input: string): ParseResult {
  const text = normalize(input);
  const tags = emptyTags();

  tags.needs = matchAll(NEED_RULES, text);
  tags.audiences = matchAll(AUDIENCE_RULES, text);
  tags.noId = NO_ID_PATTERNS.some((p) => p.test(text));
  tags.wheelchair = WHEELCHAIR_PATTERNS.some((p) => p.test(text));
  tags.when = NOW_PATTERNS.some((p) => p.test(text))
    ? "now"
    : TODAY_PATTERNS.some((p) => p.test(text))
      ? "today"
      : "any";
  tags.zip = extractZip(input);

  // "meals" inside "free meals for my kids" should not also drag in baby items etc.
  // Keep needs in a stable order for predictable UI.
  const order: Offer[] = ["groceries", "hot_meal", "produce", "baby", "hygiene"];
  tags.needs = order.filter((o) => tags.needs.includes(o));

  return { tags, lang: detectLang(input), engine: "rules" };
}
