import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { emitFrontendAlert, withWatchdog } from "./alerting";

vi.mock("@sentry/react", () => {
  const captureMessage = vi.fn();
  const addBreadcrumb = vi.fn();
  const withScope = (
    fn: (scope: { setTag: () => void; setContext: () => void; setLevel: () => void }) => void
  ) => fn({ setTag: () => undefined, setContext: () => undefined, setLevel: () => undefined });
  return { captureMessage, addBreadcrumb, withScope };
});

describe("U-ALERT-001..004: frontend alerting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("U-ALERT-001 — emitFrontendAlert calls Sentry.captureMessage with the formatted title", async () => {
    const { captureMessage } = await import("@sentry/react");
    emitFrontendAlert({
      kind: "synthetic",
      severity: "notify",
      message: "drill",
      context: { x: 1 },
    });
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect((captureMessage as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatch(
      /^\[ALERT notify\] synthetic: drill$/
    );
  });

  it("U-ALERT-001b — emitFrontendAlert without context still works (covers `?? {}` fallback)", async () => {
    const { captureMessage } = await import("@sentry/react");
    emitFrontendAlert({ kind: "synthetic", severity: "info", message: "no context" });
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it("U-ALERT-002 — withWatchdog does NOT fire when the op resolves before the budget", async () => {
    const { captureMessage } = await import("@sentry/react");
    const promise = withWatchdog("fast", async () => "ok", 1000);
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;
    expect(result).toBe("ok");
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("U-ALERT-003 — withWatchdog fires a notify-level alert when the op exceeds the budget", async () => {
    const { captureMessage, addBreadcrumb } = await import("@sentry/react");
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve("done"), 200));
    const promise = withWatchdog("slow", () => slow, 50);
    await vi.advanceTimersByTimeAsync(60);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect((captureMessage as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain(
      "stuck_loading"
    );
    await vi.advanceTimersByTimeAsync(200);
    await promise;
    expect(addBreadcrumb).toHaveBeenCalledTimes(1);
  });

  it("U-ALERT-004 — withWatchdog clears the timer when the op rejects fast", async () => {
    const { captureMessage } = await import("@sentry/react");
    const failing = withWatchdog(
      "rejecting",
      () =>
        new Promise<string>((_resolve, reject) => {
          queueMicrotask(() => reject(new Error("nope")));
        }),
      1000
    );
    await expect(failing).rejects.toThrow("nope");
    await vi.advanceTimersByTimeAsync(2000);
    expect(captureMessage).not.toHaveBeenCalled();
  });
});
