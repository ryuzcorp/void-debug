import { defineScheduled } from "void";
import { kv } from "void/kv";

// Every minute (* * * * *): stamp KV so the cron check can report the
// last tick. The schedule lives in the emitted wrangler config's triggers.
export const cron = "* * * * *";

export default defineScheduled(async (controller) => {
  await kv.put("debug:cron-last", String(controller.scheduledTime));
});
