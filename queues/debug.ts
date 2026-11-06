import { defineQueue } from "void";
import { kv } from "void/kv";

type DebugMessage = {
  id: string;
  at: number;
};

// queues/debug.ts creates the `debug` queue; the check sends one message
// and waits for this consumer to write its receipt to KV.
export default defineQueue<DebugMessage>(async (batch) => {
  for (const message of batch.messages) {
    await kv.put(
      `debug:queue-receipt:${message.body.id}`,
      JSON.stringify({ id: message.body.id, consumedAt: Date.now() }),
      { ttl: 3600 },
    );
    message.ack();
  }
});
