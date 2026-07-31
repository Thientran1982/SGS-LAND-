"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface CalTask {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  deadline?: string | null;
  category?: string;
  is_overdue?: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#9ca3af",
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function TaskCalendarView() {
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  const fetchMonth = useCallback(() => {
    setLoading(true);
    setError(null);
    const from = ymd(monthStart);
    const to = ymd(monthEnd);
    fetch(`/api/tasks?deadline_from=${from}&deadline_to=${to}&limit=300`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Lỗi ${r.status}`);
        return r.json();
      })
      .then((d) => setTasks(Array.isArray(d) ? d : (d.data ?? [])))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.getFullYear(), cursor.getMonth()]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  const tasksByDay: Record<string, CalTask[]> = {};
  for (const t of tasks) {
    if (!t.deadline) continue;
    const key = ymd(new Date(t.deadline));
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(t);
  }

  const gridStart = new Date(monthStart);
  const startWeekday = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - startWeekday);

  const days: Date[] = [];
  const walker = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(walker));
    walker.setDate(walker.getDate() + 1);
  }

  const todayKey = ymd(new Date());
  const weekdayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-2 rounded-lg hover:opacity-70"
            style={{ border: "1px solid var(--border-default)" }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-base font-semibold min-w-[120px] text-center" style={{ color: "var(--text-primary)" }}>
            Tháng {cursor.getMonth() + 1}/{cursor.getFullYear()}
          </div>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-2 rounded-lg hover:opacity-70"
            style={{ border: "1px solid var(--border-default)" }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => {
            const d = new Date();
            d.setDate(1);
            setCursor(d);
          }}
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
        >
          Hôm nay
        </button>
      </div>

      {error && (
        <p className="text-sm mb-3" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
      {loading && (
        <p className="text-sm mb-3" style={{ color: "var(--text-tertiary)" }}>
          Đang tải...
        </p>
      )}

      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ background: "var(--border-default)" }}>
        {weekdayLabels.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-xs font-medium text-center"
            style={{ background: "var(--bg-elevated)", color: "var(--text-tertiary)" }}
          >
            {w}
          </div>
        ))}
        {days.map((d, idx) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayTasks = tasksByDay[key] || [];
          const isToday = key === todayKey;
          return (
            <div
              key={idx}
              className="min-h-[110px] p-1.5"
              style={{ background: inMonth ? "var(--bg-canvas)" : "var(--bg-elevated)" }}
            >
              <div
                className="text-xs mb-1 inline-block"
                style={{
                  color: isToday ? "#fff" : inMonth ? "var(--text-secondary)" : "var(--text-tertiary)",
                  padding: isToday ? "1px 6px" : undefined,
                  borderRadius: isToday ? "9999px" : undefined,
                  background: isToday ? "#2563eb" : undefined,
                }}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    className="block text-[12px] px-1.5 py-1 rounded truncate hover:opacity-80"
                    style={{
                      background: "var(--bg-elevated)",
                      borderLeft: `3px solid ${PRIORITY_DOT[t.priority || "medium"] || "#9ca3af"}`,
                      color: "var(--text-primary)",
                    }}
                    title={t.title}
                  >
                    {t.title}
                  </Link>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    +{dayTasks.length - 3} khác
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
