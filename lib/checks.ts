import { env } from "cloudflare:workers";
import { kv } from "void/kv";
import { storage } from "void/storage";
import { queues } from "void/queues";
import { getSession } from "void/auth";
import { getSandbox } from "void/sandbox";

import { Counter } from "../durable-objects/probe";

export type CheckName = "env" | "d1" | "kv" | "r2" | "do" | "queue" | "cron" | "sandbox" | "auth";

export type CheckResult = {
  name: CheckName;
  ok: boolean;
  detail: string;
  ms: number;
};

export const CHECKS: { name: CheckName; title: string; blurb: string }[] = [
  {
    name: "env",
    title: "Env & bindings",
    blurb: "Bindings the platform wired, plus a secret-backed var.",
  },
  {
    name: "d1",
    title: "D1",
    blurb: "Insert, read back, and delete one row through the app database.",
  },
  {
    name: "kv",
    title: "KV",
    blurb: "Put, get, list, and delete one key in the default namespace.",
  },
  {
    name: "r2",
    title: "R2",
    blurb: "Put, get, head, list, and delete one object in default storage.",
  },
  {
    name: "do",
    title: "Durable Object",
    blurb: "Increment a named counter stub twice and read it back.",
  },
  {
    name: "queue",
    title: "Queue",
    blurb: "Send one message and wait for the consumer receipt in KV.",
  },
  { name: "cron", title: "Cron", blurb: "Read the last heartbeat tick the per-minute job wrote." },
  {
    name: "sandbox",
    title: "Sandbox",
    blurb: "Run node --version inside a managed sandbox container.",
  },
  {
    name: "auth",
    title: "Auth",
    blurb: "Resolve the current session; proves the Better Auth wiring answers.",
  },
];

export function isCheckName(value: string): value is CheckName {
  return CHECKS.some((check) => check.name === value);
}

function redact(message: unknown): string {
  const text = message instanceof Error ? message.message : String(message);
  return text.slice(0, 300);
}

async function timed(detail: () => Promise<{ ok: boolean; detail: string }>): Promise<{
  ok: boolean;
  detail: string;
  ms: number;
}> {
  const start = performance.now();
  try {
    const out = await detail();
    return { ...out, ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { ok: false, detail: redact(error), ms: Math.round(performance.now() - start) };
  }
}

async function checkEnv(): Promise<{ ok: boolean; detail: string }> {
  // The ambient worker env has no index signature: read through a record
  // view instead of touching the typed surface.
  const bag = env as unknown as Record<string, unknown>;
  const present = ["DB", "KV", "STORAGE", "SANDBOX"].filter((key) => bag[key] !== undefined);
  const ping = typeof bag.DEBUG_PING === "string" && bag.DEBUG_PING.length > 0;
  return {
    ok: present.includes("DB") && present.includes("KV") && present.includes("STORAGE"),
    detail: `bindings: ${present.join(", ") || "none"}; DEBUG_PING=${ping ? "set" : "not set"} (set it as an app secret to verify secret injection)`,
  };
}

async function checkD1(): Promise<{ ok: boolean; detail: string }> {
  const label = `probe-${Date.now()}`;
  // The table comes from db/migrations/0002_debug.sql: a missing table
  // means the platform did not apply migrations, and the check must fail.
  await env.DB.prepare("INSERT INTO debug_probe (label) VALUES (?)").bind(label).run();
  const row = await env.DB.prepare("SELECT id, label FROM debug_probe WHERE label = ?")
    .bind(label)
    .first<{ id: number; label: string }>();
  await env.DB.prepare("DELETE FROM debug_probe WHERE label = ?").bind(label).run();
  if (row?.label !== label) {
    return { ok: false, detail: "insert succeeded but the row did not read back" };
  }
  return { ok: true, detail: `row id ${row.id} round-tripped through debug_probe` };
}

async function checkKv(): Promise<{ ok: boolean; detail: string }> {
  const key = `debug:kv-${Date.now()}`;
  await kv.put(key, "pong");
  const back = await kv.get(key);
  const listed = await kv.list({ prefix: "debug:" });
  await kv.delete(key);
  const gone = await kv.get(key);
  if (back !== "pong" || gone !== null || !listed.keys.some((entry) => entry.name === key)) {
    return { ok: false, detail: `put/get/list/delete mismatch (back=${back}, gone=${gone})` };
  }
  return { ok: true, detail: `key round-tripped; ${listed.keys.length} debug: key(s) listed` };
}

async function checkR2(): Promise<{ ok: boolean; detail: string }> {
  const key = `debug/${Date.now()}.txt`;
  await storage.put(key, "ping");
  const got = await storage.get(key);
  const text = got ? await got.text() : null;
  const head = await storage.head(key);
  const listed = await storage.list({ prefix: "debug/" });
  const seen = listed.objects.some((object) => object.key === key);
  await storage.delete(key);
  const after = await storage.get(key);
  if (text !== "ping" || head?.size !== 4 || !seen || after !== null) {
    return {
      ok: false,
      detail: `put/get/head/list/delete mismatch (text=${text}, size=${head?.size}, seen=${seen})`,
    };
  }
  return { ok: true, detail: `object round-tripped (${head.size} bytes) with head + prefix list` };
}

async function checkDo(): Promise<{ ok: boolean; detail: string }> {
  const stub = Counter.get("debug");
  const before = await stub.read();
  const after = await stub.bump();
  if (after !== before + 1) {
    return { ok: false, detail: `counter went ${before} -> ${after}, expected +1` };
  }
  return { ok: true, detail: `named stub counter ${before} -> ${after} across RPCs` };
}

async function checkQueue(): Promise<{ ok: boolean; detail: string }> {
  const id = Math.random().toString(36).slice(2, 10);
  await queues.debug.send({ id, at: Date.now() });
  // The consumer writes debug:queue-receipt:<id> to KV; poll briefly.
  for (let i = 0; i < 16; i++) {
    const receipt = await kv.get(`debug:queue-receipt:${id}`);
    if (receipt !== null) {
      await kv.delete(`debug:queue-receipt:${id}`);
      return { ok: true, detail: `message ${id} produced and consumed (receipt in KV)` };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { ok: false, detail: `message ${id} sent but no consumer receipt arrived in 8s` };
}

async function checkCron(): Promise<{ ok: boolean; detail: string }> {
  const last = await kv.get("debug:cron-last");
  if (last === null) {
    return {
      ok: false,
      detail: "no heartbeat yet — the per-minute job has not ticked (wait and re-run)",
    };
  }
  const age = Math.max(0, Math.round((Date.now() - Number(last)) / 1000));
  return {
    ok: age < 600,
    detail: `last tick ${age}s ago (${new Date(Number(last)).toISOString()})`,
  };
}

async function checkSandbox(): Promise<{ ok: boolean; detail: string }> {
  const sandbox = await getSandbox("debug");
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("sandbox exec timed out after 20s")), 20000),
  );
  const out = await Promise.race([sandbox.run(["node", "--version"]), timeout]);
  const version = String(out.stdout ?? "")
    .trim()
    .slice(0, 40);
  if (out.exitCode !== 0) {
    return {
      ok: false,
      detail: `node --version exited ${out.exitCode}: ${String(out.stderr ?? "").slice(0, 200)}`,
    };
  }
  return { ok: true, detail: `sandbox answered: ${version || "(empty stdout)"}` };
}

async function checkAuth(): Promise<{ ok: boolean; detail: string }> {
  const session = getSession();
  if (!session) {
    return {
      ok: true,
      detail:
        "no active session (signed out) — the auth stack resolved; use the panel below to sign up and prove the full cookie flow",
    };
  }
  return { ok: true, detail: `active session for ${session.user.email}` };
}

const RUNNERS: Record<CheckName, () => Promise<{ ok: boolean; detail: string }>> = {
  env: checkEnv,
  d1: checkD1,
  kv: checkKv,
  r2: checkR2,
  do: checkDo,
  queue: checkQueue,
  cron: checkCron,
  sandbox: checkSandbox,
  auth: checkAuth,
};

export async function runCheck(name: CheckName): Promise<CheckResult> {
  const { ok, detail, ms } = await timed(RUNNERS[name]);
  return { name, ok, detail, ms };
}
