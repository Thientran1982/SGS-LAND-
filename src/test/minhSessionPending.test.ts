import { afterEach, describe, expect, it, vi } from "vitest";
import { createMinhSession } from "../../packages/chat-widget/src/core/minhSession";

describe("Minh session async acknowledgement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("returns pending immediately instead of blocking on the reconcile window", async () => {
    window.localStorage.setItem("livechat_lead_id", "lead-1");
    window.localStorage.setItem("livechat_lead_name", "Nguyễn Minh");

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/api/public/livechat/message")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            message: {
              id: "inbound-1",
              direction: "INBOUND",
              content: "Đánh giá tiềm năng tài chính",
              timestamp: new Date().toISOString(),
            },
          }),
        };
      }
      if (init?.method === "POST" && url.includes("/api/public/ai/livechat")) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            async: true,
            status: "PROCESSING",
            code: "AI_ASYNC_PROCESSING",
            inboundInteractionId: "inbound-1",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: "csrf-test" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const startedAt = performance.now();
    const result = await createMinhSession().sendUserMessage(
      "Đánh giá tiềm năng tài chính",
    );
    const elapsedMs = performance.now() - startedAt;

    expect(result.pending).toBe(true);
    expect(result.assistant).toBeNull();
    expect(result.raw.inboundInteractionId).toBe("inbound-1");
    expect(elapsedMs).toBeLessThan(1_000);
    expect(
      fetchMock.mock.calls.some(([url, init]) => init?.method !== "POST" && String(url).includes("/messages/")),
    ).toBe(false);
  });

  it("keeps a rate-limited status read transient and preserves its retry hint", async () => {
    window.localStorage.setItem("livechat_lead_id", "lead-1");
    window.localStorage.setItem("livechat_lead_name", "Nguyễn Minh");

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/api/public/livechat/message")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            message: {
              id: "inbound-1",
              direction: "INBOUND",
              content: "Tin nhắn chờ",
              timestamp: new Date().toISOString(),
            },
          }),
        };
      }
      if (init?.method === "POST" && url.includes("/api/public/ai/livechat")) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            async: true,
            status: "PROCESSING",
            code: "AI_ASYNC_PROCESSING",
            inboundInteractionId: "inbound-1",
          }),
        };
      }
      if (url.includes("/api/public/ai/livechat/status/")) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => "9" },
          json: async () => ({
            error: "rate limited",
            code: "LIVECHAT_STATUS_RATE_LIMITED",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: "csrf-test" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = createMinhSession();
    await session.sendUserMessage("Tin nhắn chờ");
    await expect(session.getPendingStatus("inbound-1")).resolves.toMatchObject({
      status: "PROCESSING",
      code: "LIVECHAT_STATUS_RATE_LIMITED",
      retryAfter: 9,
      transient: true,
    });
  });
});