// Rule-based request parser for FoodLink's ten supported resident languages.
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
      /\b(epicerie|nourriture|denrees alimentaires)\b/,
      /\b(mantimentos|alimentos|cesta basica)\b/,
      /(مواد غذائية|بقالة|طعام)/,
      /(杂货|食品|食物)/,
      /(किराना|राशन|खाद्य सामग्री)/,
      /(মুদি|খাবার|খাদ্য)/,
      /\b(продукты|продуктовый набор|еда домой)\b/,
      /\b(vyakula|chakula cha kupika)\b/,
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
      /\b(repas chaud|repas gratuit|dejeuner|diner)\b/,
      /\b(refeicao quente|almoco|jantar|cafe da manha)\b/,
      /(وجبة ساخنة|وجبة مجانية|غداء|عشاء|فطور)/,
      /(热餐|免费餐|午餐|晚餐|早餐)/,
      /(गरम खाना|मुफ्त भोजन|दोपहर का खाना|रात का खाना)/,
      /(গরম খাবার|বিনামূল্যের খাবার|দুপুরের খাবার|রাতের খাবার)/,
      /\b(горячая еда|бесплатная еда|обед|ужин|завтрак)\b/,
      /\b(chakula cha moto|mlo wa bure|chakula cha mchana|chakula cha jioni)\b/,
    ],
  },
  {
    tag: "produce",
    patterns: [
      /\bproduce\b/, /\bfresh (fruit|fruits|vegetables|veggies)\b/, /\b(frutas|verduras|vegetales)\b/,
      /\b(fruits|legumes)\b/, /\b(frutas|legumes)\b/, /(فواكه|خضروات)/, /(水果|蔬菜)/,
      /(फल|सब्जी|सब्जियां)/, /(ফল|সবজি)/, /\b(фрукты|овощи)\b/, /\b(matunda|mboga)\b/
    ],
  },
  {
    tag: "baby",
    patterns: [
      /\bbab(y|ies)\b/, /\bformula\b/, /\bdiapers?\b/, /\bbebes?\b/, /\bpanales\b/,
      /\b(bebe|couches|lait infantile)\b/, /\b(bebe|fraldas|formula infantil)\b/,
      /(طفل|حفاضات|حليب أطفال)/, /(婴儿|尿布|奶粉)/, /(बच्चा|डायपर|फॉर्मूला)/,
      /(শিশু|ডায়াপার|ফর্মুলা)/, /\b(ребенок|подгузники|детская смесь)\b/, /\b(mtoto|nepi|maziwa ya mtoto)\b/
    ],
  },
  {
    tag: "hygiene",
    patterns: [
      /\bhygiene\b/, /\btoiletries\b/, /\bsoap\b/, /\bhigiene\b/, /\bjabon\b/,
      /\b(hygiene|savon|articles de toilette)\b/, /\b(higiene|sabonete|produtos de higiene)\b/,
      /(نظافة|صابون|مستلزمات النظافة)/, /(卫生用品|肥皂)/, /(स्वच्छता|साबुन)/,
      /(স্বাস্থ্যবিধি|সাবান)/, /\b(гигиена|мыло|туалетные принадлежности)\b/, /\b(usafi|sabuni)\b/
    ],
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
      /\b(enfants?|fils|fille)\b/, /\b(criancas?|filhos?|filhas?)\b/,
      /(أطفال|طفلي|أولادي)/, /(孩子|儿童)/, /(बच्चे|बच्चा)/, /(শিশু|বাচ্চা)/,
      /\b(дети|ребенок)\b/, /\b(watoto|mtoto)\b/,
    ],
  },
  { tag: "families", patterns: [
    /\bfamil(y|ies)\b/, /\bfamilias?\b/, /\bhousehold\b/, /\bfamille\b/, /\bfamilia\b/,
    /(عائلة|أسرة)/, /(家庭|家人)/, /(परिवार)/, /(পরিবার)/, /\bсемья\b/, /\bfamilia\b/
  ] },
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
      /\b(personnes agees|senior)\b/, /\b(idosos?|terceira idade)\b/, /(كبار السن|مسنين)/,
      /(老人|老年人)/, /(बुजुर्ग|वरिष्ठ नागरिक)/, /(বয়স্ক|প্রবীণ)/, /\b(пожилые|пенсионеры)\b/, /\b(wazee)\b/,
    ],
  },
  {
    tag: "students",
    patterns: [
      /\bstudents?\b/, /\bcollege\b/, /\bcampus\b/, /\bdorm\b/, /\bestudiantes?\b/, /\buniversi(dad|tari[oa]s?)\b/,
      /\b(etudiants?|universite)\b/, /\b(estudantes?|universidade)\b/, /(طلاب|جامعة)/, /(学生|大学)/,
      /(छात्र|विद्यार्थी|कॉलेज)/, /(ছাত্র|শিক্ষার্থী|কলেজ)/, /\b(студенты|университет)\b/, /\b(wanafunzi|chuo kikuu)\b/
    ],
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
  /\b(sans piece d'identite|sans papiers)\b/, /\b(sem documento|sem identificacao)\b/,
  /(بدون هوية|ليس لدي هوية|بدون وثائق)/, /(没有证件|无需证件|没有身份证)/,
  /(बिना आईडी|मेरे पास आईडी नहीं|बिना पहचान पत्र)/, /(আইডি নেই|পরিচয়পত্র নেই)/,
  /\b(без документов|без удостоверения|нет удостоверения)\b/, /\b(bila kitambulisho|sina kitambulisho)\b/,
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
  /\b(fauteuil roulant|accessible)\b/, /\b(cadeira de rodas|acessivel)\b/,
  /(كرسي متحرك|سهولة الوصول)/, /(轮椅|无障碍)/, /(व्हीलचेयर|सुलभ)/, /(হুইলচেয়ার|প্রবেশযোগ্য)/,
  /\b(инвалидная коляска|доступный)\b/, /\b(kiti cha magurudumu|ufikivu)\b/,
];

const NOW_PATTERNS = [
  /\b(right )?now\b/, /\bopen now\b/, /\bimmediately\b/, /\bahora( mismo)?\b/, /\bya\b/,
  /\bmaintenant\b/, /\bagora\b/, /(الآن|حالاً)/, /(现在|马上)/, /(अभी|तुरंत)/, /(এখন|অবিলম্বে)/,
  /\b(сейчас|немедленно)\b/, /\b(sasa|mara moja)\b/
];
const TODAY_PATTERNS = [
  /\btoday\b/, /\btonight\b/, /\bthis (morning|afternoon|evening)\b/, /\bhoy\b/, /\besta (noche|tarde|manana)\b/,
  /\b(aujourd'hui|ce soir)\b/, /\b(hoje|esta noite)\b/, /(اليوم|الليلة)/, /(今天|今晚)/,
  /(आज|आज रात)/, /(আজ|আজ রাতে)/, /\b(сегодня|сегодня вечером)\b/, /\b(leo|usiku wa leo)\b/
];

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
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[ঀ-৿]/.test(text)) return "bn";
  if (/[Ѐ-ӿ]/.test(text)) return "ru";

  const words = normalize(text).split(/[^a-z0-9']+/).filter(Boolean);
  const markers: Record<"es" | "fr" | "pt" | "sw" | "en", string[]> = {
    es: ["para","sin","comida","necesito","cerca","hoy","ninos","gratis","alimentos","despensa","familia","ayuda"],
    fr: ["je","besoin","nourriture","pres","sans","aujourd'hui","gratuit","repas","famille","aide","ouvert"],
    pt: ["preciso","comida","perto","sem","hoje","gratis","alimentos","mantimentos","familia","ajuda","aberto"],
    sw: ["nahitaji","chakula","karibu","bila","leo","bure","vyakula","familia","msaada","wazi","watoto"],
    en: ["the","for","my","need","near","today","free","food","kids","without","open","now","help"],
  };
  const score = (lang: keyof typeof markers) => words.reduce((n, word) => n + (markers[lang].includes(word) ? 1 : 0), 0);
  if (/[¿¡ñ]/i.test(text)) return "es";
  const ranked = (Object.keys(markers) as Array<keyof typeof markers>)
    .map((lang) => [lang, score(lang)] as const)
    .sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : "en";
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
