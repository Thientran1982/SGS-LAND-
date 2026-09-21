import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MinhChatPanel } from "../../packages/chat-widget/src/MinhChatPanel";
import { createMinhSession } from "../../packages/chat-widget/src/core/minhSession";
import type { MinhSession } from "../../packages/chat-widget/src/core/minhSession";
import type { ChatMessage } from "../../packages/chat-widget/src/core/types";

vi.mock("../../packages/chat-widget/src/core/minhSession", () => ({
  createMinhSession: vi.fn(),
}));

const mockedCreateMinhSession = vi.mocked(createMinhSession);
let realtimeOnMessage: ((message: ChatMessage) => void) | undefined;
let socketHandlers: any;

describe("MinhChatPanel", () => {
  beforeEach(() => {
    (HTMLElement.prototype as any).scrollIntoView = vi.fn();
    realtimeOnMessage = undefined;
    socketHandlers = undefined;
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
      connect: vi.fn().mockImplementation(async (handlers: any) => {
        socketHandlers = handlers;
        realtimeOnMessage = handlers.onMessage;
        return () => undefined;
      }),
      getPendingRun: vi.fn().mockReturnValue(null),
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
    } as unknown as MinhSession);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("keeps the thinking indicator and delays fallback polling until socket silence", async () => {
    vi.useFakeTimers();
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
      connect: vi.fn().mockImplementation(async (handlers: any) => {
        socketHandlers = handlers;
        return () => undefined;
      }),
      getPendingStatus: vi.fn().mockResolvedValue({ status: "SUCCESS" }),
      refreshMessages,
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
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

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Aiven contention smoke" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(screen.getByText(/Minh đang/)).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(refreshMessages).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshMessages).toHaveBeenCalled();

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

  it("uses socket reply first and cancels fallback polling", async () => {
    vi.useFakeTimers();
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
      connect: vi.fn().mockImplementation(async (handlers: any) => {
        socketHandlers = handlers;
        realtimeOnMessage = handlers.onMessage;
        return () => undefined;
      }),
      getPendingStatus: vi.fn().mockResolvedValue({ status: "NOT_FOUND" }),
      refreshMessages,
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
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

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Race condition smoke" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Minh đang/)).toBeInTheDocument();

    act(() => {
      realtimeOnMessage?.({
        id: "assistant-realtime-1",
        role: "assistant",
        content: "Câu trả lời realtime",
        ts: Date.now(),
        runId: "run-1",
        inboundInteractionId: "inbound-1",
      });
    });
    expect(screen.getByText("Câu trả lời realtime")).toBeInTheDocument();
    expect(input).not.toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshMessages).not.toHaveBeenCalled();
  });

  it("keeps the pending run active when an assistant reply lacks correlation ids", async () => {
    vi.useFakeTimers();
    const pendingSession = {
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [],
      }),
      connect: vi.fn().mockImplementation(async (handlers: any) => {
        realtimeOnMessage = handlers.onMessage;
        return () => undefined;
      }),
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
      sendUserMessage: vi.fn().mockResolvedValue({
        user: {
          id: "user-1",
          role: "user",
          content: "Câu hỏi đang xử lý",
          ts: Date.now(),
        },
        assistant: null,
        noReply: false,
        pending: true,
        raw: { async: true, inboundInteractionId: "inbound-1" },
      }),
    } as unknown as MinhSession;
    mockedCreateMinhSession.mockReturnValue(pendingSession);

    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Câu hỏi đang xử lý" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Minh đang/)).toBeInTheDocument();

    act(() => {
      realtimeOnMessage?.({
        id: "assistant-unrelated-1",
        role: "assistant",
        content: "Tin của chuyên viên khác",
        ts: Date.now(),
      });
    });

    expect(screen.getByText("Tin của chuyên viên khác")).toBeInTheDocument();
    expect(screen.getByText(/Minh đang/)).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it("turns the indicator off and offers retry after a failed run", async () => {
    vi.useFakeTimers();
    const getPendingStatus = vi.fn().mockResolvedValue({ status: "FAILED", code: "AI_UNAVAILABLE" });
    const failedSession = {
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [],
      }),
      connect: vi.fn().mockResolvedValue(() => undefined),
      getPendingStatus,
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
      sendUserMessage: vi.fn().mockResolvedValue({
        user: { id: "user-1", role: "user", content: "Câu hỏi lỗi", ts: Date.now() },
        assistant: null,
        noReply: false,
        pending: true,
        raw: { async: true, inboundInteractionId: "inbound-1" },
      }),
    } as unknown as MinhSession;
    mockedCreateMinhSession.mockReturnValue(failedSession);

    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Câu hỏi lỗi" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Minh đang/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/chưa thể hoàn tất/);
    expect(screen.queryByText(/Minh đang/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thử lại/ })).toBeInTheDocument();
    expect(input).not.toBeDisabled();

    fireEvent.change(input, { target: { value: "Tin nhắn mới sau lỗi" } });
    expect(input).toHaveValue("Tin nhắn mới sau lỗi");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("restores thinking after reconnect while a durable run is processing", async () => {
    vi.useFakeTimers();
    const getPendingStatus = vi.fn().mockResolvedValue({ status: "PROCESSING" });
    const reconnectSession = {
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [{ id: "inbound-1", role: "user", content: "Đang xử lý", ts: Date.now() }],
      }),
      connect: vi.fn().mockImplementation(async (handlers: any) => {
        socketHandlers = handlers;
        handlers.onReconnectStatus?.({ status: "PROCESSING", code: "RUNNING" });
        return () => undefined;
      }),
      getPendingRun: vi.fn().mockReturnValue({
        runId: "run-1",
        inboundInteractionId: "inbound-1",
        startedAt: Date.now() - 5_000,
      }),
      getPendingStatus,
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
    } as unknown as MinhSession;
    mockedCreateMinhSession.mockReturnValue(reconnectSession);

    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Minh đang/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nội dung tin nhắn" })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getPendingStatus).toHaveBeenCalledTimes(1);
  });

  it("fails cleanly when an AI-phase error has no inbound interaction id", async () => {
    const aiFailureSession = {
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [],
      }),
      connect: vi.fn().mockResolvedValue(() => undefined),
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
      sendUserMessage: vi.fn().mockRejectedValue({
        code: "AI_TIMEOUT",
        status: 504,
      }),
    } as unknown as MinhSession;
    mockedCreateMinhSession.mockReturnValue(aiFailureSession);

    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Câu hỏi bị timeout" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/chưa thể hoàn tất/);
    expect(screen.queryByText(/Minh đang/)).not.toBeInTheDocument();
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Thử lại/ })).toBeInTheDocument();
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
      connect: vi.fn().mockImplementation(async (handlers: any) => {
        socketHandlers = handlers;
        realtimeOnMessage = handlers.onMessage;
        return () => undefined;
      }),
      getPendingStatus: vi.fn().mockResolvedValue({ status: "SUCCESS" }),
      refreshMessages,
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
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

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Race condition smoke" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Minh đang/)).toBeInTheDocument();

    act(() => {
      socketHandlers?.onRunFinished?.({
        leadId: "lead-1",
        runId: "run-1",
        inboundInteractionId: "inbound-1",
        status: "SUCCESS",
      });
    });
    await waitFor(() => expect(refreshMessages).toHaveBeenCalled());

    act(() => {
      realtimeOnMessage?.({
        id: "assistant-realtime-1",
        role: "assistant",
        content: "Câu trả lời realtime",
        ts: Date.now(),
        runId: "run-1",
        inboundInteractionId: "inbound-1",
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

  it("keeps the user's question visible when a reconciliation history snapshot is incomplete", async () => {
    vi.useFakeTimers();
    const refreshMessages = vi.fn().mockResolvedValue({
      leadId: "lead-1",
      name: "Nguyễn Minh",
      threadStatus: "AI_ACTIVE",
      messages: [],
    });
    const pendingSession = {
      restore: vi.fn().mockResolvedValue({
        leadId: "lead-1",
        name: "Nguyễn Minh",
        threadStatus: "AI_ACTIVE",
        messages: [],
      }),
      connect: vi.fn().mockImplementation(async (handlers: any) => {
        socketHandlers = handlers;
        return () => undefined;
      }),
      getPendingStatus: vi.fn().mockResolvedValue({ status: "SUCCESS" }),
      refreshMessages,
      savePendingRun: vi.fn(),
      clearPendingRun: vi.fn(),
      sendUserMessage: vi.fn().mockResolvedValue({
        user: {
          id: "user-1",
          role: "user",
          content: "Câu hỏi cần được giữ lại",
          ts: Date.now(),
        },
        assistant: null,
        noReply: false,
        pending: true,
        raw: { async: true, inboundInteractionId: "inbound-1" },
      }),
    } as unknown as MinhSession;
    mockedCreateMinhSession.mockReturnValue(pendingSession);

    render(<MinhChatPanel showHeader={false} heightClass="h-auto" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Câu hỏi cần được giữ lại" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Câu hỏi cần được giữ lại")).toBeInTheDocument();

    act(() => {
      socketHandlers?.onRunFinished?.({
        leadId: "lead-1",
        runId: "run-1",
        inboundInteractionId: "inbound-1",
        status: "SUCCESS",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });

    expect(refreshMessages).toHaveBeenCalled();
    expect(screen.getByText("Câu hỏi cần được giữ lại")).toBeInTheDocument();
  });
});
