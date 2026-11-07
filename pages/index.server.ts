import * as v from "valibot";
import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";
import { kv } from "void/kv";

import { CHECKS, isCheckName, runCheck, type CheckName } from "../lib/checks";
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

const checkName = v.custom<CheckName>((input) => typeof input === "string" && isCheckName(input));

// Named actions, per the Void guide: `?all` runs every check, `?one` takes a
// validated { name }. withValidator() decodes the JSON body the hydrated
// useForm client submits (parseBody only decoded form posts).
export const actions = {
  all: defineHandler(async () => {
    // Sequential and stored per check, so a slow check (queue) or a
    // timeout still leaves the earlier outcomes in the table.
    for (const check of CHECKS) {
      await mergeResult(await runCheck(check.name));
    }
  }),
  one: defineHandler.withValidator({
    body: v.object({ name: checkName }),
  })(async (_c, { body }) => {
    await mergeResult(await runCheck(body.name));
  }),
};
