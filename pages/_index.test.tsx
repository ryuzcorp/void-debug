import { expect, test } from "bun:test";

import { renderHtml } from "ilha/test";

import Home from "./index.tsx";

test("renders the probe table with per-check run buttons", async () => {
  // The page is server-rendered in place; its forms stay disabled until
  // the client hydrates, so an early click would be lost instead of
  // falling back to a native GET submit.
  const html = await renderHtml(
    () => (
      <Home
        checks={[{ name: "env", title: "Env & bindings", blurb: "Bindings the platform wired." }]}
        results={{}}
        userEmail={null}
        cronLast={null}
      />
    ),
    { markers: false, snapshot: false },
  );
  expect(html).toContain("Run all checks");
  expect(html).toContain("Env &amp; bindings");
  // Buttons render disabled until the client hydrates, so an early click
  // waits instead of falling back to a native GET submit.
  expect(html).toContain('disabled=""');
});
