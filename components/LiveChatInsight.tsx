/**
 * LiveChatInsight — Thanh tom tat phien chat voi Agent Minh (thu gon mac dinh).
 * Khong hien outline truc tiep de tranh trung lap voi noi dung khung chat
 * ben tren; chi tai outline khi moi giao vien bam mo.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, MessageSquareText, RefreshCw } from 'lucide-react';
import { api } from '../services/api/apiClient';

type OutlineTopic = { question: string; answer: string; ts: string };
type Outline = {
  leadId: string;
  messageCount: number;
  greeting: string | null;
  topics: OutlineTopic[];
  lastActive: string | null;
};

export default function LiveChatInsight({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Outline>('/api/public/livechat/outline/' + leadId);
      setOutline(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Khong tai duoc phien chat');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    setOutline(null);
    setOpen(false);
  }, [leadId]);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && !outline && !loading) void load();
  }, [open, outline, loading, load]);

  return (
    <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)]">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <MessageSquareText size={14} className="text-[var(--sgs-primary)]" />
        <span className="font-medium">Tóm tắt phiên chat với Agent Minh</span>
        {outline && (
          <span className="ml-1 rounded-full bg-[var(--glass-surface)] px-2 py-0.5 text-[11px]">
            {outline.messageCount} tin nhắn · {outline.topics.length} câu hỏi
          </span>
        )}
      </button>

      {open && (
        <div className="max-h-64 space-y-2 overflow-y-auto border-t border-[var(--glass-border)] px-3 py-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Làm mới
            </button>
          </div>
          {error && <p className="text-xs text-[var(--text-secondary)]">{error}</p>}
          {!error && loading && !outline && (
            <p className="text-xs text-[var(--text-secondary)]">Đang tải...</p>
          )}
          {outline?.greeting && (
            <div className="rounded-md bg-[var(--glass-surface)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
              {outline.greeting}
            </div>
          )}
          {outline?.topics.map((t, i) => (
            <details key={i} className="group rounded-md border border-[var(--glass-border)]">
              <summary className="cursor-pointer list-none px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] group-open:hidden">
                {t.question}
              </summary>
              <div className="space-y-1 px-2.5 py-1.5">
                <p className="text-xs font-medium text-[var(--text-primary)]">{t.question}</p>
                {t.answer && <p className="text-xs text-[var(--text-secondary)]">{t.answer}</p>}
              </div>
            </details>
          ))}
          {outline && outline.topics.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              Chưa có câu hỏi nào trong phiên chat này.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
