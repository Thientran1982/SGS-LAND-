"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Loader2, Minimize2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào! Tôi là **SGS AI** — trợ lý bất động sản thông minh của SGS LAND.\n\nTôi có thể giúp bạn:\n• 🏠 Tìm kiếm bất động sản phù hợp\n• 💰 Định giá & phân tích đầu tư\n• ⚖️ Tư vấn pháp lý, sổ hồng\n• 📊 Thị trường Đông Nam Bộ\n\nBạn đang quan tâm đến BĐS nào?",
  ts: Date.now(),
};

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setUnread(0);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Bạn có thể hỏi lại không?",
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Unread badge when minimized/closed
      if (minimized || !open) setUnread((n) => n + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Xin lỗi, có lỗi kết nối. Vui lòng thử lại hoặc gọi hotline **0971 132 378**.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple markdown-to-HTML renderer
  const renderContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>");
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-24 right-4 sm:right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            minimized ? "h-14" : "h-[520px]"
          }`}
          style={{
            width: "min(400px, calc(100vw - 32px))",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0 cursor-pointer"
            style={{ background: "var(--primary-600)" }}
            onClick={() => setMinimized((v) => !v)}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">SGS AI Assistant</p>
              <p className="text-xs text-white/70">Trả lời tức thì • 24/7</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {msg.role === "assistant" && (
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                        style={{ background: "var(--primary-subtle)" }}
                      >
                        <Bot className="w-3.5 h-3.5" style={{ color: "var(--primary-600)" }} />
                      </div>
                    )}
                    <div
                      className="max-w-[78%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={
                        msg.role === "user"
                          ? { background: "var(--primary-600)", color: "#fff", borderBottomRightRadius: "4px" }
                          : { background: "var(--bg-elevated)", color: "var(--text-primary)", borderBottomLeftRadius: "4px", border: "1px solid var(--border-default)" }
                      }
                      dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                    />
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: "var(--primary-subtle)" }}>
                      <Bot className="w-3.5 h-3.5" style={{ color: "var(--primary-600)" }} />
                    </div>
                    <div className="px-3 py-2.5 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-tertiary)" }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: "var(--border-default)" }}>
                <div className="flex items-end gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Hỏi về BĐS, giá cả, pháp lý..."
                    rows={1}
                    className="flex-1 resize-none text-sm bg-transparent outline-none leading-relaxed max-h-28"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="p-1.5 rounded-lg shrink-0 transition-all disabled:opacity-40"
                    style={{ background: input.trim() ? "var(--primary-600)" : "transparent" }}
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
                <p className="text-center text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                  Powered by SGS AI — Luôn xác minh thông tin với tư vấn viên
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: "var(--primary-600)" }}
        aria-label="Chat với SGS AI"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </>
  );
}
