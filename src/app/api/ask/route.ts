// POST /api/ask
// One private round trip for conversational FoodLink search:
// parse the resident's words, preserve prior conversation filters when requested,
// then immediately search and rank nearby resources.

import { parseRequest } from "@/lib/ai/parse";
import { searchListings } from "@/lib/db/listings";
import { PILOT_ZIPS, zipToPoint } from "@/lib/geo";
import { guardPublicWrite, json, readJson } from "@/lib/security/http";
import type { SearchTags } from "@/lib/types";
import { askSchema } from "@/lib/validation";

function mergeConversation(previous: SearchTags | null, next: SearchTags): SearchTags {
  if (!previous) return next;
  return {
    needs: next.needs.length > 0 ? next.needs : previous.needs,
    audiences: next.audiences.length > 0 ? next.audiences : previous.audiences,
    noId: next.noId || previous.noId,
    wheelchair: next.wheelchair || previous.wheelchair,
    when: next.when !== "any" ? next.when : previous.when,
    zip: next.zip ?? previous.zip,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const blocked = guardPublicWrite(request, "search", "ask");
    if (blocked) return blocked;

    const body = await readJson(request, askSchema);
    if (body.response) return body.response;

    const { text, previousTags, continueConversation, origin } = body.data;
    const parsed = await parseRequest(text);
    const tags = continueConversation ? mergeConversation(previousTags, parsed.tags) : parsed.tags;

    const point = origin ?? zipToPoint(tags.zip);
    const result = await searchListings(tags, point);

    return json({
      ...result,
      tags,
      engine: parsed.engine,
      lang: parsed.lang,
      origin: point,
      originKind: origin ? "device" : point ? "zip" : "none",
      zipOutsidePilot: !!tags.zip && !(tags.zip in PILOT_ZIPS),
    });
  } catch (error) {
    console.error("FoodLink ask failed:", error);
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? `Ask FoodLink failed: ${error.message}`
        : "FoodLink is temporarily unavailable. Please try again.";
    return json({ error: detail }, 500);
  }
}
