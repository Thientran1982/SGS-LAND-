"use client";
/**
 * Khung chat voi agent Minh (CRM lead + socket.io + human takeover).
 * Dung chung cho trang /livechat va cho bubble noi (MinhChatWidget).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Headset, Loader2, RefreshCw, Send, Mic, Check, X } from "lucide-react";
import { createMinhSession } from "./core/minhSession";
import type { MinhSession, MinhThreadStatus } from "./core/minhSession";
import type { ChatMessage } from "./core/types";
import { renderChatContent } from "./renderChatContent";

const SUGGESTIONS = [
  "Aqua City pháp lý thế nào?",
  "Giá khoảng bao nhiêu 1 căn?",
  "Còn quỹ căn nào đẹp không?",
  "Cho tôi xem chính sách thanh toán",
];

const CSS = (v: string, f: string) => "var(" + v + ", " + f + ")";

/** Dung design token cua site (globals.css) de hop ca light va dark mode. */
const S: Record<string, React.CSSProperties> = {
  // The outer border used to remain visible as a pale-gold crescent at the
  // bottom corners. Match it to the panel surface so the radius is seamless.
  panel: { background: CSS("--cw-parchment", "#F5F1E6"), borderColor: CSS("--cw-parchment", "#F5F1E6"), fontFamily: "var(--font-be-vietnam), system-ui, sans-serif" },
  header: { background: CSS("--cw-navy", "#0B1D26"), borderColor: CSS("--cw-navy", "#0B1D26") },
  brand: { background: CSS("--cw-gold", "#C6923D") },
  title: { color: CSS("--cw-paper", "#FFFFFF"), fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 600 },
  sub: { color: "rgba(255,255,255,0.72)" },
  formText: { color: CSS("--cw-ink", "#26221C") },
  muted: { color: CSS("--cw-ink-dim", "#8A8474"), fontFamily: "var(--font-ibm-plex-mono), monospace" },
  field: {
    background: CSS("--cw-paper", "#FFFFFF"),
    borderColor: CSS("--cw-line", "#EAE4D4"),
    color: CSS("--cw-ink", "#26221C"),
  },
  primaryBtn: { background: CSS("--cw-navy", "#0B1D26"), color: CSS("--cw-paper", "#FFFFFF") },
  bubbleUser: {
    background: CSS("--cw-navy", "#0B1D26"),
    borderColor: CSS("--cw-navy", "#0B1D26"),
    color: CSS("--cw-paper", "#FFFFFF"),
  },
  bubbleAi: {
    background: CSS("--cw-paper", "#FFFFFF"),
    borderColor: CSS("--cw-line", "#EAE4D4"),
    color: CSS("--cw-ink", "#26221C"),
  },
  chip: {
    background: CSS("--cw-paper", "#FFFFFF"),
    borderColor: CSS("--cw-line", "#EAE4D4"),
    color: CSS("--cw-ink", "#26221C"),
  },
  // Composer belongs to the panel surface; using --cw-paper here created a
  // white horizontal strip against the parchment chat background.
  bar: { background: CSS("--cw-parchment", "#F5F1E6"), borderColor: CSS("--cw-line", "#EAE4D4") },
};

export interface MinhChatPanelProps {
  apiBase?: string;
  /** LINK | EMBED | QR | WEB | WIDGET */
  source?: string;
  className?: string;
  /** Class chieu cao cho vung tin nhan. */
  heightClass?: string;
  showHeader?: boolean;
  title?: string;
  description?: string;
  /** Nội dung gợi ý được điền sẵn từ các CTA contextual. */
  initialMessage?: string;
}

export function MinhChatPanel({
  apiBase,
  source = "WEB",
  className = "",
  heightClass = "h-[460px]",
  showHeader = true,
  title = "SGS Land Live Chat",
  description = "Chúng tôi sẵn sàng hỗ trợ bạn 24/7",
  initialMessage = "",
}: MinhChatPanelProps) {
  const sessionRef = useRef<MinhSession | null>(null);
  if (!sessionRef.current) sessionRef.current = createMinhSession({ apiBase, source });
  const session = sessionRef.current;

  const [ready, setReady] = useState(false);
  const [hasLead, setHasLead] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastFailed, setLastFailed] = useState("");
  const [mode, setMode] = useState<MinhThreadStatus>("AI_ACTIVE");

  // Voice input (client-side only via Web Speech API, no new backend endpoint)
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [waveformPoints, setWaveformPoints] = useState("0,12 12,12 24,12 36,12 48,12 60,12 72,12 84,12 96,12 108,12");
  const [voiceSupported] = useState<boolean>(() => typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  const recognitionRef = useRef<any>(null);
  // ===== P1: MediaRecorder fallback + booking form =====
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [voiceSupported2, setVoiceSupported2] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingDone, setBookingDone] = useState<string | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceTranscriptRef = useRef("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const appendUnique = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  // 1. Khoi phuc phien cu tu localStorage (neu lead con hop le).
  useEffect(() => {
    let alive = true;
    session
      .restore()
      .then((r) => {
        if (!alive) return;
        if (r) {
          setMessages(r.messages);
          setMode(r.threadStatus);
          setName(r.name);
          setHasLead(true);
        }
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  // 2. Socket realtime: tin nhan cua chuyen vien + doi trang thai AI/nguoi that.
  useEffect(() => {
    if (!hasLead) return;
    let alive = true;
    let cleanup: (() => void) | null = null;
    session
      .connect({
        onMessage: (m) => {
          appendUnique(m);
          if (m.role === "assistant") setLoading(false);
        },
        onModeChange: (s) => {
          setMode(s);
          setLoading(false);
        },
      })
      .then((fn) => {
        if (alive) cleanup = fn;
        else fn();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (cleanup) cleanup();
    };
  }, [hasLead, session, appendUnique]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleStart = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !phone.trim()) {
        setFormError("Vui lòng nhập họ tên và số điện thoại.");
        return;
      }
      setFormError("");
      setStarting(true);
      try {
        const r = await session.start({ name, phone });
        setMessages([r.welcome]);
        setHasLead(true);
      } catch {
        setFormError("Không tạo được phiên chat. Vui lòng thử lại hoặc gọi 0379 281 445.");
      } finally {
        setStarting(false);
      }
    },
    [name, phone, session],
  );

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || loading) return;
      setInput("");
      setError("");
      setLastFailed("");
      const tempId = "temp-" + Date.now();
      setMessages((prev) => [
        ...prev,
        { id: tempId, role: "user", content: text, ts: Date.now() } as ChatMessage,
      ]);
      setLoading(true);
      try {
        const res = await session.sendUserMessage(text);
        setMessages((prev) => {
          const replaced = prev.map((m) => (m.id === tempId ? res.user : m));
          const seen = new Set<string>();
          const out: ChatMessage[] = [];
          for (const m of replaced) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            out.push(m);
          }
          if (res.assistant && !seen.has(res.assistant.id)) out.push(res.assistant);
          return out;
        });
        if (res.noReply) setMode("HUMAN_TAKEOVER");
      } catch (err: any) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setLastFailed(text);
        setError(
          err && err.code === "NO_LEAD"
            ? "Phiên chat đã hết hạn. Vui lòng bắt đầu lại."
            : "Không gửi được tin nhắn. Vui lòng thử lại hoặc gọi 0379 281 445.",
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading, session],
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const formatRecTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  const stopRecordingInternal = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
  }, []);

  const startRecording = useCallback(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      void startMediaRecording();
      return;
    }
    voiceTranscriptRef.current = "";
    const recognition = new SR();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      voiceTranscriptRef.current = text;
    };
    recognition.onerror = (event: any) => {
      if (event?.error !== "aborted") {
        setError(
          event?.error === "not-allowed" || event?.error === "service-not-allowed"
            ? "Microphone access is blocked. Please allow microphone access in your browser and try again."
            : "Voice input could not start. Please try again or type your message.",
        );
      }
      stopRecordingInternal();
    };
    recognition.onend = () => {
      // Chrome can end recognition after a silence/network interruption
      // without firing an error. Do not leave the composer stuck in recording mode.
      if (recognitionRef.current === recognition) stopRecordingInternal();
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { return; }
    setIsRecording(true);
    setRecordSeconds(0);
    recordTimerRef.current = setInterval(() => {
      setRecordSeconds((sec) => sec + 1);
      setWaveformPoints(Array.from({ length: 10 }, (_, i) => `${i * 12},${4 + Math.round(Math.random() * 16)}`).join(" "));
    }, 1000);
  }, [stopRecordingInternal]);

  // ===== P1.2: MediaRecorder + Gemini transcribe fallback =====
  const transcribeAudio = useCallback(async (blob: Blob): Promise<string | null> => {
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || "").split(",")[1] || "");
        fr.onerror = () => reject(new Error("read_failed"));
        fr.readAsDataURL(blob);
      });
      const res = await fetch(
        String(apiBase || "").replace(/\/+$/, "") + "/api/public/livechat/transcribe",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: b64, mimeType: blob.type || "audio/webm" }),
        },
      );
      if (!res.ok) return null;
      const data: any = await res.json();
      return typeof data?.text === "string" ? data.text : null;
    } catch {
      return null;
    }
  }, [apiBase]);

  const startMediaRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size < 1200) { stopRecordingInternal(); return; }
        voiceTranscriptRef.current = "Đang xử lý giọng nói...";
        const text = await transcribeAudio(blob);
        if (text) {
          voiceTranscriptRef.current = text;
          setInput(text);
        } else {
          setError("Không nhận diện được giọng nói. Bạn vui lòng nhập câu hỏi bằng văn bản nhé.");
        }
        stopRecordingInternal();
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
        setWaveformPoints(Array.from({ length: 10 }, (_, i) => `${i * 12},${4 + Math.round(Math.random() * 16)}`).join(" "));
      }, 1000);
    } catch {
      setError("Trình duyệt không cho phép ghi âm. Bạn vui lòng nhập câu hỏi bằng văn bản nhé.");
    }
  }, [stopRecordingInternal, transcribeAudio]);

  const stopMediaRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    mediaRecorderRef.current = null;
  }, []);

  // ===== P1.1: Submit booking form =====
  const submitBooking = useCallback(async () => {
    if (!bookingDate.trim()) return;
    setBookingBusy(true);
    try {
      const leadId = session.getLeadId();
      if (!leadId) throw new Error("no_lead");
      const res = await fetch(
        String(apiBase || "").replace(/\/+$/, "") + "/api/public/livechat/book-viewing",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, dateText: bookingDate, notes: bookingNote || undefined }),
        },
      );
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "book_failed");
      setBookingDone(data.scheduledAtFormatted || bookingDate);
      setShowBooking(false);
    } catch {
      setError("Đặt lịch chưa thành công. Vui lòng thử lại hoặc gọi 0379 281 445.");
    } finally {
      setBookingBusy(false);
    }
  }, [bookingDate, bookingNote, session, apiBase]);

  const cancelRecording = useCallback(() => {
    voiceTranscriptRef.current = "";
    stopRecordingInternal();
  }, [stopRecordingInternal]);

  const confirmRecording = useCallback(() => {
    const text = voiceTranscriptRef.current.trim();
    stopRecordingInternal();
    if (text) void send(text);
  }, [stopRecordingInternal, send]);

  const wrapper =
    "flex flex-col rounded-[20px] overflow-hidden " +
    className;

  if (!ready) {
    return (
      <div
        className={wrapper + " " + heightClass + " items-center justify-center"}
        style={{ ...S.panel, borderRadius: "20px", clipPath: "inset(0 round 20px)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
      <div
        className={wrapper + " " + heightClass + " isolate"}
        style={{
          ...S.panel,
          borderRadius: "20px",
          border: "0",
          overflow: "hidden",
          backgroundClip: "padding-box",
          clipPath: "inset(0 round 20px)",
        }}
      >
      {showHeader && (
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={S.header}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={S.brand}>
            {mode === "HUMAN_TAKEOVER" ? (
              <Headset className="w-5 h-5 text-white" />
            ) : (
              <Bot className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate" style={S.title}>{title}</p>
            <p className="text-xs leading-tight" style={S.sub}>
              {mode === "HUMAN_TAKEOVER"
                ? "Chuyên viên đang trả lời trực tiếp"
                : description}
            </p>
          </div>
        </div>
      )}

      {!hasLead ? (
        <form
          onSubmit={handleStart}
          className={"flex flex-col gap-3 p-5 justify-center rounded-b-[20px] " + heightClass}
          style={{ background: CSS("--cw-parchment", "#F5F1E6") }}
        >
          <p className="text-sm leading-relaxed" style={S.formText}>
            Để chuyên viên Minh tư vấn và gửi báo giá, vui lòng cho biết họ tên và số điện thoại.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Họ và tên"
            aria-label="Họ và tên"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ ...S.field, fontSize: "16px" }}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Số điện thoại"
            type="tel"
            inputMode="tel"
            aria-label="Số điện thoại"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ ...S.field, fontSize: "16px" }}
          />
          {formError ? (
            <p role="alert" className="text-xs text-rose-300">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={starting}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={S.primaryBtn}
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Bắt đầu chat với Minh
          </button>
          <p className="text-[11px]" style={S.muted}>
            Thông tin chỉ dùng để tư vấn, không chia sẻ cho bên thứ ba.
          </p>
        </form>
      ) : (
        <>
          <div
            className={"flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 " + heightClass}
            aria-live="polite"
          >
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className="max-w-[85%] rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed"
                  style={m.role === "user" ? S.bubbleUser : S.bubbleAi}
                  dangerouslySetInnerHTML={{ __html: renderChatContent(m.content) }}
                />
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm" style={S.bubbleAi}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Minh đang soạn trả lời...</span>
                </div>
              </div>
            ) : null}

            {mode === "HUMAN_TAKEOVER" ? (
              <p className="text-center text-[11px] text-amber-600">
                Chuyên viên đã tham gia hội thoại và sẽ trả lời trực tiếp.
              </p>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
              >
                <span>{error}</span>
                {lastFailed ? (
                  <button
                    type="button"
                    onClick={() => void send(lastFailed)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Thử lại
                  </button>
                ) : null}
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && mode === "AI_ACTIVE" ? (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border px-3 py-1.5 text-xs"
                  style={S.chip}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {showBooking && (
            <div className="mx-2 mb-1 rounded-xl border p-3 space-y-2" style={S.paper}>
              <div className="text-sm font-semibold" style={{ color: "var(--cw-ink, #2C2822)" }}>Đặt lịch xem nhà</div>
              <input
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                placeholder="Thời gian bạn muốn xem (VD: Chủ nhật 9h sáng)"
                aria-label="Thời gian xem nhà"
                className="w-full rounded-lg border px-2 py-2 text-sm outline-none"
                style={S.field}
              />
              <input
                value={bookingNote}
                onChange={(e) => setBookingNote(e.target.value)}
                placeholder="Ghi chú (dự án/quỹ căn quan tâm)"
                aria-label="Ghi chú đặt lịch"
                className="w-full rounded-lg border px-2 py-2 text-sm outline-none"
                style={S.field}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submitBooking()}
                  disabled={bookingBusy || !bookingDate.trim()}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--cw-gold, #C6923D)" }}
                >
                  {bookingBusy ? "Đang đặt..." : "Xác nhận đặt lịch"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBooking(false)}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ color: "var(--cw-ink-dim, #8A8474)" }}
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
          {bookingDone && (
            <div className="mx-2 mb-1 rounded-xl border p-2 text-sm" style={S.paper}>
              Đã đặt lịch thành công: <strong>{bookingDone}</strong>. Chuyên viên sẽ xác nhận qua điện thoại.
            </div>
          )}
                    <div
            className="flex items-end gap-2 rounded-b-[20px] border-t p-3"
            style={{ ...S.bar, borderBottomLeftRadius: "20px", borderBottomRightRadius: "20px" }}
          >
            {isRecording ? (
              <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--cw-navy, #0B1D26)" }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--cw-rec, #E4685A)", animation: "cwBlink 1s ease-in-out infinite" }} />
                <svg viewBox="0 0 120 20" className="flex-1 h-6" preserveAspectRatio="none">
                  <polyline points={waveformPoints} fill="none" stroke="var(--cw-gold, #C6923D)" strokeWidth="1.5" />
                </svg>
                <span className="text-xs text-white/80 tabular-nums shrink-0" style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{formatRecTime(recordSeconds)}</span>
                <button type="button" onClick={cancelRecording} aria-label="Hủy ghi âm" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white shrink-0 transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <button type="button" onClick={confirmRecording} aria-label="Gửi ghi âm" className="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ background: "var(--cw-gold, #C6923D)" }}>
                  <Check className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
    <div className="flex-1 flex items-end gap-1 rounded-xl border px-2 py-1" style={S.field}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  placeholder="Nhập câu hỏi của bạn..."
                  aria-label="Nội dung tin nhắn"
                  className="min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm outline-none max-h-28"
                  style={{ fontSize: "16px" }}
                />
                {hasLead && !isRecording && (
                <button
                  type="button"
                  onClick={() => { setShowBooking((v) => !v); setBookingDone(null); }}
                  aria-label="Đặt lịch xem nhà"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-black/5"
                  style={{ color: "var(--cw-ink-dim, #8A8474)" }}
                >
                  <span className="text-[10px] font-semibold leading-none">Xem nhà</span>
                </button>
              )}
              {(voiceSupported || (typeof navigator !== "undefined" && !!navigator.mediaDevices)) && (
                  <button
                    type="button"
                    onClick={startRecording}
                    aria-label="Ghi âm giọng nói"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-black/5"
                    style={{ color: "var(--cw-ink-dim, #8A8474)" }}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !input.trim()}
                  aria-label="Gửi tin nhắn"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40"
                  style={S.primaryBtn}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MinhChatPanel;
