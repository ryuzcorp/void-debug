import { defineHandler } from "void";

import { mergeIslandResult } from "../../lib/results";

// Browser-driven probes (auth panel, WebSocket, SSE) report here so the
// page shows one table: { name, ok, detail }.
export const POST = defineHandler(async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    name?: unknown;
    ok?: unknown;
    detail?: unknown;
  } | null;
  const name =
    typeof body?.name === "string" && body.name.length > 0 && body.name.length <= 32
      ? body.name
      : null;
  if (!name || typeof body?.ok !== "boolean") {
    return c.json({ error: "expected { name, ok, detail }" }, 422);
  }
  const detail = typeof body?.detail === "string" ? body.detail.slice(0, 500) : "";
  const results = await mergeIslandResult(name, body.ok, detail);
  return { results };
});
