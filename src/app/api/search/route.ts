// POST /api/search  ->  the "Search API" box in the system design.
// Filters verified listings by the tags and sorts them closest first.
//
// POST is used on purpose: a ZIP code or location in a GET query string would
// end up in server access logs and browser history. Nothing here is stored.

import { searchListings } from "@/lib/db/listings";
import { PILOT_ZIPS, zipToPoint } from "@/lib/geo";
import { guardPublicWrite, json, readJson } from "@/lib/security/http";
import { searchSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  try {
    const blocked = guardPublicWrite(request, "search", "search");
    if (blocked) return blocked;

    const body = await readJson(request, searchSchema);
    if (body.response) return body.response;
    const { tags, origin } = body.data;

    // A device location (already rounded on the device) wins over a typed ZIP.
    const point = origin ?? zipToPoint(tags.zip);
    const result = await searchListings(tags, point);

    return json({
      ...result,
      origin: point,
      originKind: origin ? "device" : point ? "zip" : "none",
      zipOutsidePilot: !!tags.zip && !(tags.zip in PILOT_ZIPS),
    });
  } catch (error) {
    console.error("FoodLink search failed:", error);
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? `Search failed: ${error.message}`
        : "Search is temporarily unavailable. Please try again.";
    return json({ error: detail }, 500);
  }
}
