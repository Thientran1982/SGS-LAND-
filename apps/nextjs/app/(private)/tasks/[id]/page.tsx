// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, User, Tag, CheckCircle, Clock, AlertCircle, Edit2, Loader2 } from "lucide-react";

interface Task { id: number; title?: string; description?: string; status?: string; priority?: string; due_date?: string; assignee_name?: string; project_name?: string; listing_title?: string; lead_name?: string; type?: string; created_at?: string; updated_at?: string; tags?: string[]; }

const STATUS_LABEL: Record<string, string> = { todo: "Chưa làm", in_progress: "Đang làm", done: "Hoàn thành", cancelled: "Đã hủy" };
const STATUS_COLOR: Record<string, string> = { todo: "#6b7280", in_progress: "#f59e0b", done: "#10b981", cancelled: "#ef4444" };
const PRIORITY_LABEL: Record<string, string> = { low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp" };
const PRIORITY_COLOR: Record<string, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444", urgent: "#dc2626" };

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric" }) : "—"; }

export default function TaskDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/tasks/${id}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setTask(d.task || d); else setError("Không tìm thấy công việc"); })
      .catch(() => setError("Lỗi kết nối"))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!task) return;
    setUpdating(true);
    try {
      const r = await fetch(`/api/tasks/${task.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
      if (r.ok) setTask((prev) => prev ? { ...prev, status } : prev);
    } finally { setUpdating(false); }
  };

  if (loading) return <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--border-default)" }} />)}</div>;
  if (error) return <div className="p-6 lg:p-8 max-w-2xl mx-auto"><div className="p-4 rounded-xl text-sm flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}><AlertCircle className="w-4 h-4" />{error}</div></div>;
  if (!task) return null;

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity" style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft className="w-4 h-4" />Quay lại
      </button>

      <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{task.title || `Công việc #${task.id}`}</h1>
          <div className="flex gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${STATUS_COLOR[task.status || "todo"]}18`, color: STATUS_COLOR[task.status || "todo"] || "#6b7280" }}>
              {STATUS_LABEL[task.status || "todo"] || task.status}
            </span>
            {task.priority && <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${PRIORITY_COLOR[task.priority] || "#6b7280"}18`, color: PRIORITY_COLOR[task.priority] || "#6b7280" }}>
              {PRIORITY_LABEL[task.priority] || task.priority}
            </span>}
          </div>
        </div>

        {task.description && <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>{task.description}</p>}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          {task.assignee_name && <div className="flex items-center gap-2"><User className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><dt className="text-xs" style={{ color: "var(--text-secondary)" }}>Phụ trách:</dt><dd style={{ color: "var(--text-primary)" }}>{task.assignee_name}</dd></div>}
          {task.due_date && <div className="flex items-center gap-2"><Calendar className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><dt className="text-xs" style={{ color: "var(--text-secondary)" }}>Hạn:</dt><dd style={{ color: new Date(task.due_date) < new Date() ? "#ef4444" : "var(--text-primary)" }}>{fmtDate(task.due_date)}</dd></div>}
          {task.project_name && <div className="col-span-2 flex items-center gap-2"><Tag className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><dt className="text-xs" style={{ color: "var(--text-secondary)" }}>Dự án:</dt><dd style={{ color: "var(--text-primary)" }}>{task.project_name}</dd></div>}
          {task.lead_name && <div className="col-span-2 flex items-center gap-2"><User className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><dt className="text-xs" style={{ color: "var(--text-secondary)" }}>Khách hàng:</dt><dd style={{ color: "var(--text-primary)" }}>{task.lead_name}</dd></div>}
        </dl>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Cập nhật trạng thái</h2>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABEL).map(([status, label]) => (
            <button key={status} onClick={() => updateStatus(status)} disabled={updating || task.status === status} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-60"
              style={{ background: task.status === status ? `${STATUS_COLOR[status]}18` : "var(--bg-elevated)", color: task.status === status ? STATUS_COLOR[status] : "var(--text-secondary)", border: `1px solid ${task.status === status ? STATUS_COLOR[status] + "40" : "var(--border-default)"}` }}>
              {updating && task.status !== status ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs flex justify-between" style={{ color: "var(--text-muted)" }}>
        <span>Tạo: {fmtDate(task.created_at)}</span>
        <span>Cập nhật: {fmtDate(task.updated_at)}</span>
      </div>
    </div>
  );
}
