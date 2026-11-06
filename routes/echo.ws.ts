import * as v from "valibot";
import { defineWebSocket } from "void/ws";

const ping = v.object({ type: v.literal("echo.ping"), id: v.string() });
const pong = v.object({ type: v.literal("echo.pong"), id: v.string() });

// Typed echo: every ping comes back as a pong with the same id, so the
// browser probe measures a real round trip through the route's Durable
// Object rather than a bare upgrade.
export default defineWebSocket({
  messages: {
    client: ping,
    server: pong,
  },
  onConnect: async (ctx) => {
    await ctx.socket.send({ type: "echo.pong", id: "welcome" });
  },
  onMessage: async (ctx, event) => {
    if (event.type === "echo.ping") {
      await ctx.socket.send({ type: "echo.pong", id: event.id });
    }
  },
});
