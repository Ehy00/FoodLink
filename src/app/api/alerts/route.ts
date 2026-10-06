// POST /api/alerts  ->  recent changes near a ZIP code.
// The ZIP lives only on the resident's phone; the server keeps no subscriber list.

import { getAlerts } from "@/lib/db/listings";
import { zipToPoint } from "@/lib/geo";
import { guardPublicWrite, json, readJson } from "@/lib/security/http";
import { eventsSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  const blocked = guardPublicWrite(request, "search", "alerts");
  if (blocked) return blocked;

  const body = await readJson(request, eventsSchema);
  if (body.response) return body.response;

  const point = body.data.origin ?? zipToPoint(body.data.zip);
  return json({ alerts: await getAlerts(point) });
}
