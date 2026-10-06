// POST /api/events  ->  upcoming events, closest first when a location is given.

import { getUpcomingEvents } from "@/lib/db/listings";
import { zipToPoint } from "@/lib/geo";
import { guardPublicWrite, json, readJson } from "@/lib/security/http";
import { eventsSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  const blocked = guardPublicWrite(request, "search", "events");
  if (blocked) return blocked;

  const body = await readJson(request, eventsSchema);
  if (body.response) return body.response;

  const point = body.data.origin ?? zipToPoint(body.data.zip);
  return json({ events: await getUpcomingEvents(point) });
}
