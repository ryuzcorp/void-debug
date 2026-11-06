import { atom } from "ilha";
import type { View } from "ilha";
import { connect, type VoidSocket } from "void/ws";

type Phase = "idle" | "connecting" | "open" | "done" | "error";

// Live WebSocket round trip through /echo: connect from the browser, send
// a ping, and wait for the typed pong. Posts one outcome per run.
export default function WsProbe(): View {
  const phase = atom<Phase>("idle");
  const line = atom("not run yet");
  let socket: VoidSocket<"/echo"> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cleanup() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    try {
      socket?.close();
    } catch {
      // Already gone; the status line below already says what happened.
    }
    socket = null;
  }

  function report(ok: boolean, detail: string) {
    void fetch("/api/island-result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "ws", ok, detail }),
    });
  }

  function run() {
    cleanup();
    phase.set("connecting");
    line.set("connecting to /echo…");
    const id = Math.random().toString(36).slice(2, 10);
    const started = Date.now();
    try {
      socket = connect("/echo");
    } catch (error) {
      phase.set("error");
      const detail =
        `connect threw: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200);
      line.set(detail);
      report(false, detail);
      return;
    }
    timer = setTimeout(() => {
      if (phase() === "open" || phase() === "connecting") {
        const detail = "no pong within 10s";
        phase.set("error");
        line.set(detail);
        report(false, detail);
        cleanup();
      }
    }, 10000);
    socket.on("open", () => {
      phase.set("open");
      line.set("open — ping sent, waiting for pong…");
      socket?.send({ type: "echo.ping", id });
    });
    socket.on("message", (event) => {
      if (event.type === "echo.pong" && event.id === id) {
        const ms = Date.now() - started;
        const detail = `pong for ${id} in ${ms}ms`;
        phase.set("done");
        line.set(detail);
        report(true, detail);
        cleanup();
      }
    });
    socket.on("error", (error) => {
      const detail = `socket error: ${String(error).slice(0, 200)}`;
      phase.set("error");
      line.set(detail);
      report(false, detail);
      cleanup();
    });
    socket.on("close", () => {
      if (phase() === "connecting" || phase() === "open") {
        const detail = "socket closed before the pong arrived";
        phase.set("error");
        line.set(detail);
        report(false, detail);
      }
      cleanup();
    });
  }

  return (
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => run()}
          disabled={phase() === "connecting" || phase() === "open"}
          class="btn btn-sm btn-primary"
        >
          Connect & ping
        </button>
        <button type="button" onclick={() => cleanup()} class="btn btn-sm btn-ghost">
          Disconnect
        </button>
      </div>
      <p role="status" class="text-sm opacity-80">
        {phase()}: {line()}
      </p>
    </div>
  );
}
