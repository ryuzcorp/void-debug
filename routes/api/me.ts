import { defineHandler } from "void";
import { requireAuth } from "void/auth";

// Guard proof for the auth panel: reachable only with a session cookie,
// so the browser flow below ends here instead of at a guess.
export const GET = defineHandler((c) => {
  const user = requireAuth(c);
  return { email: user.email };
});
