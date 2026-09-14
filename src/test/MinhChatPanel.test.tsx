import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("keeps the message composer centered and full width inside the panel", async () => {
    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);

    const input = await waitFor(() => screen.getByRole("textbox", { name: "Nội dung tin nhắn" }));
    const composer = input.closest("div.flex.w-full");

    expect(composer).not.toBeNull();
    expect(composer).toHaveClass("max-w-full");
    expect(composer).toHaveClass("min-w-0");
    expect(composer?.parentElement).toHaveClass("w-full", "self-center");
  });

  it("shows pending immediately while a slow history read continues in the background", async () => {
    let releaseRefresh!: (value: any) => void;
    const refreshMessages = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        releaseRefresh = resolve;
      }),
    );
    const slowSession = {
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [],
      }),
      connect: vi.fn().mockResolvedValue(() => undefined),
      refreshMessages,
      sendUserMessage: vi.fn().mockResolvedValue({
        user: {
          id: "user-1",
          role: "user",
          content: "Aiven contention smoke",
          ts: Date.now(),
        },
        assistant: null,
        noReply: false,
        pending: true,
        raw: { async: true },
      }),
    } as unknown as MinhSession;
    mockedCreateMinhSession.mockReturnValue(slowSession);

    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);

    const input = await waitFor(() => screen.getByRole("textbox", { name: "Nội dung tin nhắn" }));
    fireEvent.change(input, { target: { value: "Aiven contention smoke" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(screen.queryByText(/Minh đang xử lý/)).not.toBeInTheDocument();
    expect(input).not.toBeDisabled();
    await waitFor(() => expect(refreshMessages).toHaveBeenCalled());

    await act(async () => {
      releaseRefresh({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [{
          id: "user-1",
          role: "user",
          content: "Aiven contention smoke",
          ts: Date.now(),
        }, {
          id: "assistant-1",
          role: "assistant",
          content: "Đã nhận tin nhắn.",
          ts: Date.now(),
        }],
      });
    });
  });

  it("does not let stale history overwrite a realtime reply", async () => {
    let releaseRefresh!: (value: any) => void;
    const refreshMessages = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        releaseRefresh = resolve;
      }),
    );
    const raceSession = {
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [],
      }),
      connect: vi.fn().mockImplementation(async (handlers: { onMessage?: (message: ChatMessage) => void }) => {
        realtimeOnMessage = handlers.onMessage;
        return () => undefined;
      }),
      getPendingStatus: vi.fn().mockResolvedValue({ status: "NOT_FOUND" }),
      refreshMessages,
      sendUserMessage: vi.fn().mockResolvedValue({
        user: {
          id: "user-1",
          role: "user",
          content: "Race condition smoke",
          ts: Date.now(),
        },
        assistant: null,
        noReply: false,
        pending: true,
        raw: { async: true, inboundInteractionId: "inbound-1" },
      }),
    } as unknown as MinhSession;
    mockedCreateMinhSession.mockReturnValue(raceSession);

    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);

    const input = await waitFor(() => screen.getByRole("textbox", { name: "Nội dung tin nhắn" }));
    fireEvent.change(input, { target: { value: "Race condition smoke" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(refreshMessages).toHaveBeenCalled());

    act(() => {
      realtimeOnMessage?.({
        id: "assistant-realtime-1",
        role: "assistant",
        content: "Câu trả lời realtime",
        ts: Date.now(),
      });
    });
    await screen.findByText("Câu trả lời realtime");

    await act(async () => {
      releaseRefresh({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [{
          id: "user-1",
          role: "user",
          content: "Race condition smoke",
          ts: Date.now(),
        }],
      });
    });

    expect(screen.getByText("Câu trả lời realtime")).toBeVisible();
    expect(screen.queryByText(/xử lý lâu hơn dự kiến/)).toBeNull();
  });
});
