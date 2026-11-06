import { atom } from "ilha";
import type { View } from "ilha";

type Phase = "idle" | "running" | "done" | "error";

// Reads /api/events to completion in the browser: three ticks, then the
// server closes. Posts one outcome per run.
export default function SseProbe(): View {
  const phase = atom<Phase>("idle");
  const line = atom("not run yet");
  let source: EventSource | null = null;

  function stop() {
    try {
      source?.close();
    } catch {
      // Already gone; the status line below already says what happened.
    }
    source = null;
  }

  function report(ok: boolean, detail: string) {
    void fetch("/api/island-result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "sse", ok, detail }),
    });
  }

  function run() {
    stop();
    phase.set("running");
    line.set("listening…");
    const seen: string[] = [];
    try {
      source = new EventSource("/api/events");
    } catch (error) {
      const detail =
        `EventSource threw: ${error instanceof Error ? error.message : String(error)}`.slice(
          0,
          200,
        );
      phase.set("error");
      line.set(detail);
      report(false, detail);
      return;
    }
    source.addEventListener("tick", (event) => {
      seen.push((event as MessageEvent).data as string);
      line.set(`received ${seen.length}/3: ${seen.join(", ")}`);
      if (seen.length >= 3) {
        const detail = `3 ticks received in order (${seen.join(", ")})`;
        phase.set("done");
        line.set(detail);
        report(true, detail);
        stop();
      }
    });
    source.onerror = () => {
      if (phase() === "running") {
        const detail =
          seen.length > 0
            ? `stream broke after ${seen.length}/3 ticks`
            : "stream failed before the first tick";
        phase.set("error");
        line.set(detail);
        report(false, detail);
      }
      stop();
    };
  }

  return (
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => run()}
          disabled={phase() === "running"}
          class="btn btn-sm btn-primary"
        >
          Run stream
        </button>
        <button type="button" onclick={() => stop()} class="btn btn-sm btn-ghost">
          Stop
        </button>
      </div>
      <p role="status" class="text-sm opacity-80">
        {phase()}: {line()}
      </p>
    </div>
  );
}
