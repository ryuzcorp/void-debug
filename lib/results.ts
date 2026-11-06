import { kv } from "void/kv";

import type { CheckResult } from "./checks";

const KEY = "debug:results";

export type StoredResults = Record<string, { ok: boolean; detail: string; ms: number; at: string }>;

export async function getResults(): Promise<StoredResults> {
  const raw = await kv.get(KEY);
  if (typeof raw !== "string" || raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw) as StoredResults;
  } catch {
    return {};
  }
}

export async function mergeResult(result: CheckResult): Promise<StoredResults> {
  const results = await getResults();
  results[result.name] = {
    ok: result.ok,
    detail: result.detail,
    ms: result.ms,
    at: new Date().toISOString(),
  };
  await kv.put(KEY, JSON.stringify(results));
  return results;
}

export async function mergeIslandResult(
  name: string,
  ok: boolean,
  detail: string,
): Promise<StoredResults> {
  const results = await getResults();
  results[name] = { ok, detail, ms: 0, at: new Date().toISOString() };
  await kv.put(KEY, JSON.stringify(results));
  return results;
}
