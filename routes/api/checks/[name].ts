import { defineHandler } from "void";

import { CHECKS, isCheckName, runCheck } from "../../../lib/checks";
import { mergeResult } from "../../../lib/results";

// GET lists the server-side checks; POST /api/checks/<name> runs one and
// stores its outcome for the page (curl-friendly probe endpoint).
export const GET = defineHandler(() => {
  return { checks: CHECKS.map(({ name, title, blurb }) => ({ name, title, blurb })) };
});

export const POST = defineHandler(async (c) => {
  const name = c.req.param("name") ?? "";
  if (!isCheckName(name)) {
    return c.json({ error: `unknown check: ${name}` }, 404);
  }
  const result = await runCheck(name);
  const results = await mergeResult(result);
  return { result, results };
});
