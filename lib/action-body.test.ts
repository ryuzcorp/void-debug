import { describe, expect, test } from "bun:test";

import { readActionBody } from "./action-body";

describe("readActionBody", () => {
  test("decodes the JSON body the hydrated client submits", async () => {
    const body = await readActionBody({
      header: () => "application/json",
      json: async () => ({ intent: "run-all" }),
      parseBody: async () => {
        throw new Error("parseBody must not run for JSON");
      },
    });
    expect(body).toEqual({ intent: "run-all" });
  });

  test("decodes a plain form post", async () => {
    const body = await readActionBody({
      header: () => "application/x-www-form-urlencoded",
      json: async () => {
        throw new Error("json must not run for a form");
      },
      parseBody: async () => ({ intent: "run-one", name: "env" }),
    });
    expect(body).toEqual({ intent: "run-one", name: "env" });
  });

  test("a malformed JSON body is empty, not a throw", async () => {
    const body = await readActionBody({
      header: () => "application/json; charset=utf-8",
      json: async () => {
        throw new SyntaxError("bad json");
      },
      parseBody: async () => ({ intent: "run-all" }),
    });
    expect(body).toEqual({});
  });
});
