import { afterEach, describe, expect, it, vi } from "vitest";
import { createMinhClient } from "../../packages/chat-widget/src/core/minhTransport";
import { ChatTransportError } from "../../packages/chat-widget/src/core/types";

describe("Minh transport reliability contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserves server error code, status, and retry hint", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ csrfToken: "csrf-test" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: "Bạn đang gửi tin nhắn quá nhanh.",
          code: "LIVECHAT_RATE_LIMITED",
          retryAfter: 7,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createMinhClient().sendMessage("lead-1", "Xin chào", "INBOUND", {}, "request-1"),
    ).rejects.toMatchObject({
      name: "ChatTransportError",
      code: "LIVECHAT_RATE_LIMITED",
      status: 429,
      retryAfter: 7,
    } satisfies Partial<ChatTransportError>);
  });

  it("forwards requestId to the async AI endpoint", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ csrfToken: "csrf-test" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          async: true,
          status: "PROCESSING",
          inboundInteractionId: "inbound-1",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createMinhClient().ask(
      "lead-1",
      "Giá căn hộ này bao nhiêu?",
      "vn",
      "inbound-1",
      [],
      "request-2",
    );

    expect(result).toEqual({
      async: true,
      status: "PROCESSING",
      inboundInteractionId: "inbound-1",
    });
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toMatchObject({
      leadId: "lead-1",
      inboundInteractionId: "inbound-1",
      requestId: "request-2",
    });
  });
});