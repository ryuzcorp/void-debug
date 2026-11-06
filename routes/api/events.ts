import { defineHandler } from "void";
import { eventStream } from "void/sse";

// Finite stream the SSE probe reads to completion: three ticks, then the
// server closes. No keep-alive: the point is delivery, not an open pipe.
export const GET = defineHandler(() =>
  eventStream(async (stream) => {
    for (let i = 1; i <= 3; i++) {
      await stream.send({ event: "tick", data: String(i), id: String(i) });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await stream.close();
  }),
);
