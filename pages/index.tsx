import { Form, useForm } from "@ilha/void";
import { atom, watch } from "ilha";

import AuthPanel from "./_AuthPanel" with { island: "load" };
import SseProbe from "./_SseProbe" with { island: "load" };
import WsProbe from "./_WsProbe" with { island: "load" };
import type { Props } from "./index.server.ts";
import type { CheckName } from "../lib/checks";
import type { StoredResults } from "../lib/results";

type CheckDef = { name: CheckName; title: string; blurb: string };

function Badge({ state }: { state: "pass" | "fail" | "pending" }) {
  if (state === "pass") return <span class="badge badge-success">pass</span>;
  if (state === "fail") return <span class="badge badge-error">fail</span>;
  return <span class="badge badge-ghost">not run</span>;
}

function CheckRow({
  check,
  result,
  mounted,
}: {
  check: CheckDef;
  result: StoredResults[string] | undefined;
  mounted: boolean;
}) {
  const run = useForm("/?one" as string, { name: check.name });
  const state = result === undefined ? "pending" : result.ok ? "pass" : "fail";
  return (
    <li class="border-base-300 flex flex-col gap-1 border-b py-3 last:border-b-0">
      <div class="flex items-center gap-2">
        <span class="font-medium">{check.title}</span>
        <Badge state={state} />
        {result ? (
          <span class="text-xs opacity-60">
            {result.ms}ms · {result.at}
          </span>
        ) : null}
        <span class="grow" />
        <Form form={run}>
          <button type="submit" disabled={!mounted || run.pending} class="btn btn-sm btn-outline">
            {run.pending ? "Running…" : "Run"}
          </button>
        </Form>
      </div>
      <p class="text-sm opacity-70">{check.blurb}</p>
      {result ? (
        <p role="status" class="font-mono text-xs break-all opacity-80">
          {result.detail}
        </p>
      ) : null}
    </li>
  );
}

export default function Home({ checks, results, userEmail, cronLast }: Props) {
  const runAll = useForm("/?all" as string, {});
  const mounted = atom(false);
  watch.once(() => {
    if (typeof window === "undefined") {
      return;
    }
    mounted.set(true);
  });
  const passed = checks.filter((check) => results[check.name]?.ok).length;
  return (
    <div class="flex flex-col gap-4">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-2">
          <div class="flex items-center gap-2">
            <h1 class="card-title text-2xl">Void Debug</h1>
            <span class="badge badge-neutral">
              {passed}/{checks.length} passing
            </span>
            <span class="grow" />
            <Form form={runAll}>
              <button
                type="submit"
                disabled={!mounted() || runAll.pending}
                class="btn btn-primary btn-sm"
              >
                {runAll.pending ? "Running…" : "Run all checks"}
              </button>
            </Form>
          </div>
          <p class="text-sm opacity-70">
            Server-side probes for every backend binding, plus browser-driven probes for auth,
            WebSockets, and SSE. Results persist in KV, so a reload keeps the last run.
          </p>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-1">
          <h2 class="card-title text-lg">Backend checks</h2>
          <ul class="divide-base-300 divide-y">
            {checks.map((check) => (
              <CheckRow
                key={check.name}
                check={check}
                result={results[check.name]}
                mounted={mounted()}
              />
            ))}
          </ul>
          <p class="text-sm opacity-70">
            Cron heartbeat:{" "}
            {cronLast ? (
              <span class="font-mono">{new Date(Number(cronLast)).toISOString()}</span>
            ) : (
              "no tick yet — the per-minute job has not fired"
            )}
          </p>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-2">
          <h2 class="card-title text-lg">Auth (browser)</h2>
          <p class="text-sm opacity-70">
            Server sees: <span class="font-mono">{userEmail ?? "signed out"}</span>. Sign up or sign
            in below, then verify — the session cookie must survive to the guarded{" "}
            <span class="font-mono">/api/me</span> route. Outer and Noite both provision{" "}
            <span class="font-mono">BETTER_AUTH_SECRET</span> at deploy.
          </p>
          <AuthPanel email={userEmail} />
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-2">
          <h2 class="card-title text-lg">WebSocket (browser)</h2>
          <p class="text-sm opacity-70">
            Typed echo round trip through <span class="font-mono">/echo</span>: ping out, pong back
            with the same id.
          </p>
          <WsProbe />
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-2">
          <h2 class="card-title text-lg">SSE (browser)</h2>
          <p class="text-sm opacity-70">
            Reads <span class="font-mono">/api/events</span> to completion: three ticks, then the
            server closes.
          </p>
          <SseProbe />
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body gap-2">
          <h2 class="card-title text-lg">Not covered here</h2>
          <p class="text-sm opacity-70">
            AI, email sending, and external Postgres/MySQL are skipped on purpose: celld-based
            platforms do not offer Workers AI or SMTP egress, and external databases depend on your
            own credentials. Cron schedules, queues, and Durable Objects above are the
            platform-managed equivalents.
          </p>
        </div>
      </div>
    </div>
  );
}
