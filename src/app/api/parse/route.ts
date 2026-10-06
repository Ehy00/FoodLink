// POST /api/parse  ->  the "AI request parser" box in the system design.
// Turns plain words into editable filter tags. The text is used for this one
// response and is never written to a database or a log.

import { parseRequest } from "@/lib/ai/parse";
import { guardPublicWrite, json, readJson } from "@/lib/security/http";
import { parseSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<Response> {
  const blocked = guardPublicWrite(request, "search", "parse");
  if (blocked) return blocked;

  const body = await readJson(request, parseSchema);
  if (body.response) return body.response;

  return json(await parseRequest(body.data.text));
}
