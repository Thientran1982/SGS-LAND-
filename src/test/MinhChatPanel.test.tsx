import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinhChatPanel } from "../../packages/chat-widget/src/MinhChatPanel";
import { createMinhSession } from "../../packages/chat-widget/src/core/minhSession";
import type { MinhSession } from "../../packages/chat-widget/src/core/minhSession";

vi.mock("../../packages/chat-widget/src/core/minhSession", () => ({
  createMinhSession: vi.fn(),
}));

const mockedCreateMinhSession = vi.mocked(createMinhSession);

describe("MinhChatPanel", () => {
  beforeEach(() => {
    (HTMLElement.prototype as any).scrollIntoView = vi.fn();
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
      connect: vi.fn().mockResolvedValue(() => undefined),
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
});