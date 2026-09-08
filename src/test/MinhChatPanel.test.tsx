import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinhChatPanel } from "../../packages/chat-widget/src/MinhChatPanel";
import { createMinhSession } from "../../packages/chat-widget/src/core/minhSession";
import type { MinhSession } from "../../packages/chat-widget/src/core/minhSession";
import type { ChatMessage } from "../../packages/chat-widget/src/core/types";

vi.mock("../../packages/chat-widget/src/core/minhSession", () => ({
  createMinhSession: vi.fn(),
}));

const mockedCreateMinhSession = vi.mocked(createMinhSession);
let realtimeOnMessage: ((message: ChatMessage) => void) | undefined;

describe("MinhChatPanel", () => {
  beforeEach(() => {
    (HTMLElement.prototype as any).scrollIntoView = vi.fn();
    realtimeOnMessage = undefined;
    mockedCreateMinhSession.mockReturnValue({
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content:
              "Landing công khai: https://example.com/landing/aqua-city. " +
              "Bản nháp: /landing-ai/chinh-sua/aqua-city",
            ts: Date.now(),
          },
        ],
      }),
      connect: vi.fn().mockImplementation(async (handlers: { onMessage?: (message: ChatMessage) => void }) => {
        realtimeOnMessage = handlers.onMessage;
        return () => undefined;
      }),
    } as unknown as MinhSession);
  });

  it("keeps public and draft landing URLs clickable in the rendered chat", async () => {
    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);

    const links = await waitFor(() =>
      screen.getAllByRole("link", { name: /landing/ }),
    );

    expect(links).toHaveLength(2);

    const publicLandingLink = links.find(
      (link) => link.getAttribute("href") === "https://example.com/landing/aqua-city",
    );
    const draftLandingLink = links.find(
      (link) => link.getAttribute("href") === "/landing-ai/chinh-sua/aqua-city",
    );

    expect(publicLandingLink).toBeDefined();
    expect(draftLandingLink).toBeDefined();

    for (const link of [publicLandingLink, draftLandingLink]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("keeps landing URLs clickable when a realtime assistant message arrives", async () => {
    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);

    await waitFor(() => expect(realtimeOnMessage).toEqual(expect.any(Function)));

    const publicLandingUrl = "https://example.com/landing/realtime-aqua-city";
    const draftLandingUrl = "/landing-ai/chinh-sua/realtime-aqua-city";
    act(() => {
      realtimeOnMessage?.({
        id: "assistant-realtime-1",
        role: "assistant",
        content: `Tin nhắn mới: ${publicLandingUrl} và bản nháp ${draftLandingUrl}`,
        ts: Date.now(),
      });
    });

    const publicLandingLink = await waitFor(() =>
      screen.getByRole("link", { name: publicLandingUrl }),
    );
    const draftLandingLink = screen.getByRole("link", { name: draftLandingUrl });

    for (const link of [publicLandingLink, draftLandingLink]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
