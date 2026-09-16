import { afterEach, describe, expect, it, vi } from "vitest";
import { createMinhSession, interactionToMessage } from "../../packages/chat-widget/src/core/minhSession";

describe("Minh session async acknowledgement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("preserves clarification metadata on restored assistant messages", () => {
    expect(interactionToMessage({
      id: "outbound-clarify",
      direction: "OUTBOUND",
      content: "Anh/chị muốn hỏi loại sản phẩm nào ạ?",
      metadata: {
        isAgent: true,
        intent: "CLARIFY",
        missingData: ["property_type"],
        clarificationRequired: true,
      },
    })).toMatchObject({
      intent: "CLARIFY",
      missingData: ["property_type"],
      clarificationRequired: true,
    });
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

  it("retries a degraded answer using the same inbound interaction", async () => {
    window.localStorage.setItem("livechat_lead_id", "lead-1");
    window.localStorage.setItem("livechat_lead_name", "Nguyễn Minh");

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/api/public/ai/livechat")) {
        const body = JSON.parse(String(init.body));
        expect(body.inboundInteractionId).toBe("inbound-1");
        expect(body.retry).toBe(true);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            reply: {
              id: "outbound-2",
              direction: "OUTBOUND",
              content: "Mình sẽ kiểm tra lại thông tin.",
              metadata: {
                isAgent: true,
                inboundInteractionId: "inbound-1",
                degraded: true,
                degradedReason: "PROVIDER_TIMEOUT",
                providerOutcome: "TIMEOUT",
              },
            },
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
    const result = await session.retryUserMessage("inbound-1", "Tin nhắn cũ");

    expect(result.user.id).toBe("inbound-1");
    expect(result.assistant).toMatchObject({
      id: "outbound-2",
      degraded: true,
      degradedReason: "PROVIDER_TIMEOUT",
      providerOutcome: "TIMEOUT",
    });
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).includes("/api/public/livechat/message") && init?.method === "POST",
    )).toBe(false);
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

  it("expires a pending run from localStorage after five minutes", () => {
    window.localStorage.setItem("livechat_pending_run", JSON.stringify({
      runId: "run-1",
      inboundInteractionId: "inbound-1",
      startedAt: Date.now() - 5 * 60_000 - 1,
    }));

    const session = createMinhSession();

    expect(session.getPendingRun()).toBeNull();
    expect(window.localStorage.getItem("livechat_pending_run")).toBeNull();
  });

  it("returns STATUS_UNREACHABLE after six consecutive status failures", async () => {
    window.localStorage.setItem("livechat_lead_id", "lead-1");
    window.localStorage.setItem("livechat_lead_name", "Nguyễn Minh");

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/public/ai/livechat/status/")) {
        return {
          ok: false,
          status: 503,
          headers: { get: () => null },
          json: async () => ({ error: "unavailable" }),
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
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(session.getPendingStatus("inbound-1")).resolves.toMatchObject({
        status: "PROCESSING",
        transient: true,
      });
    }
    await expect(session.getPendingStatus("inbound-1")).resolves.toEqual({
      status: "FAILED",
      code: "STATUS_UNREACHABLE",
    });
  });
});