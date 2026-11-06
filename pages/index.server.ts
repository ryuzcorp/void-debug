import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";
import { kv } from "void/kv";

import { CHECKS, isCheckName, runCheck } from "../lib/checks";
import { getResults, mergeResult } from "../lib/results";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  const [results, cronLast] = await Promise.all([getResults(), kv.get("debug:cron-last")]);
  return {
    checks: CHECKS,
    results,
    userEmail: getUser()?.email ?? null,
    cronLast: typeof cronLast === "string" ? cronLast : null,
  };
});

export const action = defineHandler(async (c) => {
  const body = await c.req.parseBody();
  if (body.intent === "run-one" && typeof body.name === "string" && isCheckName(body.name)) {
    await mergeResult(await runCheck(body.name));
    return;
  }
  if (body.intent === "run-all") {
    // Sequential and stored per check, so a slow check (queue) or a
    // timeout still leaves the earlier outcomes in the table.
    for (const check of CHECKS) {
      await mergeResult(await runCheck(check.name));
    }
  }
  // Unknown intents are ignored so a stale form never breaks the page.
});
