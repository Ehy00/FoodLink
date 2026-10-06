// Strip personal details from a resident's request before it is sent to any
// language model. The request parser only needs the words that describe the
// need; it never needs a phone number, an email or an ID number.

const PATTERNS: Array<[RegExp, string]> = [
  // Email addresses
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  // US Social Security numbers
  [/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, "[id-number]"],
  // Phone numbers in common US formats
  [/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g, "[phone]"],
  // Card-like or account-like digit runs (9+ digits, optionally grouped)
  [/\b(?:\d[ -]?){9,19}\b/g, "[number]"],
  // Street addresses such as "212 Oakwood Ave"
  [
    /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s){1,4}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|pike|parkway|pkwy|court|ct|circle|cir|way|highway|hwy)\b\.?/gi,
    "[address]",
  ],
];

/** Hard cap on what is ever sent to a model. Requests are short by nature. */
export const MAX_REQUEST_CHARS = 280;

export function redactPII(text: string, maxChars: number = MAX_REQUEST_CHARS): string {
  let out = text.slice(0, maxChars);
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
