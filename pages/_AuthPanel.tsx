import { atom } from "ilha";
import type { View } from "ilha";
import { auth } from "void/client";

type Props = {
  email: string | null;
};

// Browser-side auth proof: real sign-up / sign-in / sign-out through the
// Better Auth client (cookies included), plus a "Verify session" button
// that hits the requireAuth-guarded /api/me route and posts the outcome
// to the results table. Server truth (loader) is shown above the form.
export default function AuthPanel({ email }: Props): View {
  const address = atom("debug@example.com");
  const password = atom("");
  const status = atom(email ? `signed in (server sees ${email})` : "signed out");

  async function act(kind: "up" | "in" | "out") {
    status.set("working…");
    try {
      if (kind === "out") {
        await auth.signOut();
      } else if (kind === "up") {
        const res = (await auth.signUp.email({
          email: address(),
          password: password(),
          name: "Debug",
        })) as unknown as { error?: { message?: string } | null };
        if (res?.error) {
          status.set(`sign-up failed: ${res.error.message ?? "unknown error"}`);
          return;
        }
      } else {
        const res = (await auth.signIn.email({
          email: address(),
          password: password(),
        })) as unknown as {
          error?: { message?: string } | null;
        };
        if (res?.error) {
          status.set(`sign-in failed: ${res.error.message ?? "unknown error"}`);
          return;
        }
      }
      window.location.reload();
    } catch (error) {
      status.set(`failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200));
    }
  }

  async function verify() {
    status.set("verifying session…");
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const body = (await res.json()) as { email?: string };
        status.set(`verified: /api/me answered ${body.email ?? "?"}`);
        await fetch("/api/island-result", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "auth-ui",
            ok: true,
            detail: `/api/me answered ${body.email ?? "?"}`,
          }),
        });
      } else {
        status.set(`not signed in: /api/me answered ${res.status}`);
        await fetch("/api/island-result", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "auth-ui",
            ok: false,
            detail: `/api/me answered ${res.status} — sign in first`,
          }),
        });
      }
    } catch (error) {
      status.set(
        `verify failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200),
      );
    }
  }

  return (
    <div class="flex flex-col gap-2">
      <div class="join w-full">
        <input
          aria-label="Email"
          placeholder="debug@example.com"
          value={address()}
          oninput={(event) => address.set(event.currentTarget.value)}
          class="input join-item input-sm grow"
        />
        <input
          aria-label="Password"
          type="password"
          placeholder="password (8+ chars)"
          value={password()}
          oninput={(event) => password.set(event.currentTarget.value)}
          class="input join-item input-sm grow"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" onclick={() => void act("up")} class="btn btn-sm">
          Sign up
        </button>
        <button type="button" onclick={() => void act("in")} class="btn btn-sm btn-primary">
          Sign in
        </button>
        <button type="button" onclick={() => void act("out")} class="btn btn-sm btn-ghost">
          Sign out
        </button>
        <button type="button" onclick={() => void verify()} class="btn btn-sm btn-outline">
          Verify session
        </button>
      </div>
      <p role="status" class="text-sm opacity-80">
        {status()}
      </p>
    </div>
  );
}
