"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface LandingSection {
  stage: string;
  title?: string;
  body?: string;
  items?: string[];
  phone?: string;
  contactName?: string;
  tokens: number;
}

interface GeneratedLandingPage {
  id: string;
  project_name: string;
  slug: string;
  brochure_name: string | null;
  sections: LandingSection[];
  status: string;
  language: string;
  updated_at: string;
}

const card = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: 16,
  padding: "20px 18px",
  marginBottom: 16,
};
const label = { color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 };
const input = {
  width: "100%",
  background: "var(--ui-surface-subtle)",
  border: "1px solid var(--border-default)",
  borderRadius: 10,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 14,
};
const btnPrimary = {
  background: "var(--ui-brand)",
  color: "var(--ui-on-brand)",
  borderRadius: 10,
  padding: "11px 18px",
  fontWeight: 700,
  fontSize: 14,
  border: "none",
  cursor: "pointer",
};
const btnGhost = {
  ...btnPrimary,
  background: "transparent",
  color: "var(--ui-brand)",
  border: "1px solid var(--ui-border-strong)",
};

function secOf(sections: LandingSection[], stage: string): LandingSection | undefined {
  return sections.find((s) => s.stage === stage);
}

export default function EditorForm({
  initialPage,
  initialKey,
}: {
  initialPage: GeneratedLandingPage;
  initialKey: string;
}) {
  const router = useRouter();
  const [k, setK] = useState(initialKey);
  const [projectName, setProjectName] = useState(initialPage.project_name);
  const [slugInput, setSlugInput] = useState(initialPage.slug);
  const [currentSlug, setCurrentSlug] = useState(initialPage.slug);
  const [sections, setSections] = useState<LandingSection[]>(initialPage.sections || []);
  const [status, setStatus] = useState(initialPage.status);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "unpublish">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const publicUrl = "/landing-ai/" + currentSlug;
  const previewUrl = publicUrl + "?preview=1";

  function setSec(stage: string, patch: Partial<LandingSection>) {
    setSections((prev) => prev.map((s) => (s.stage === stage ? { ...s, ...patch } : s)));
  }
  function setItems(stage: string, text: string) {
    const items = text.split("\n").map((x) => x.trim()).filter(Boolean);
    setSec(stage, { items });
  }

  async function post(url: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
    // Double-submit CSRF: lay token tu /api/csrf-token roi gui lai qua header
    const csrfRes = await fetch("/api/csrf-token", { credentials: "include" });
    const csrfData = await csrfRes.json().catch(() => ({}));
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfData?.csrfToken ? { "X-CSRF-Token": csrfData.csrfToken } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || "Lỗi " + res.status);
    return data;
  }

  async function save() {
    setBusy("save"); setMessage(""); setError("");
    try {
      const data = await post("/api/landing-pages/" + currentSlug, {
        visitorKey: k, projectName, slug: slugInput, sections,
      }, "PATCH");
      const newSlug = data?.page?.slug || currentSlug;
      setCurrentSlug(newSlug);
      setSlugInput(newSlug);
      if (data?.page?.sections) setSections(data.page.sections);
      setMessage("Đã lưu thay đổi.");
      if (newSlug !== currentSlug) {
        router.replace("/landing-ai/chinh-sua/" + newSlug + "?k=" + encodeURIComponent(k));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(""); }
  }

  async function changeStatus(next: "published" | "draft") {
    setBusy(next === "published" ? "publish" : "unpublish"); setMessage(""); setError("");
    try {
      await post("/api/landing-pages/" + currentSlug + (next === "published" ? "/publish" : "/unpublish"), { visitorKey: k });
      setStatus(next);
      setMessage(next === "published" ? "Đã publish - trang công khai." : "Đã chuyển về bản nháp.");
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(""); }
  }

  const hero = secOf(sections, "hero");
  const gallery = secOf(sections, "gallery");
  const legal = secOf(sections, "legal");
  const price = secOf(sections, "price");
  const amenities = secOf(sections, "amenities");
  const contact = secOf(sections, "contact");

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 70px", color: "var(--text-primary)" }}>
      <p style={{ color: "var(--sgs-accent-text)", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
        Trình chỉnh sửa landing
      </p>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}>{projectName}</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 16px" }}>
        Trang: <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: "var(--sgs-accent-text)" }}>{publicUrl}</a>
        {"  ·  "}Trạng thái: <strong>{status === "published" ? "Đã publish" : "Bản nháp"}</strong>
      </p>

      <div style={card}>
        <label style={label}>Mã quản trị (được cấp khi tạo trang)</label>
        <input style={input} value={k} onChange={(e) => setK(e.target.value)} placeholder="visitor key" />
      </div>

      <div style={card}>
        <label style={label}>Tên dự án</label>
        <input style={input} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        <label style={{ ...label, marginTop: 14 }}>Slug (đường dẫn /landing-ai/&lt;slug&gt;)</label>
        <input style={input} value={slugInput} onChange={(e) => setSlugInput(e.target.value)} />
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "6px 0 0" }}>
          Chỉ chữ thường, số và dấu gạch ngang. Đổi slug sẽ đổi luôn link công khai.
        </p>
      </div>

      <div style={card}>
        <label style={label}>Hero - tiêu đề lớn</label>
        <input style={input} value={hero?.title || ""} onChange={(e) => setSec("hero", { title: e.target.value })} />
        <label style={{ ...label, marginTop: 14 }}>Hero - vị trí / mô tả ngắn</label>
        <input style={input} value={hero?.body || ""} onChange={(e) => setSec("hero", { body: e.target.value })} />
      </div>

      {gallery && (
        <div style={card}>
          <label style={label}>Hình ảnh dự án (mỗi dòng một mục)</label>
          <textarea style={{ ...input, minHeight: 70 }} value={(gallery.items || []).join("\n")} onChange={(e) => setItems("gallery", e.target.value)} />
        </div>
      )}

      {legal && (
        <div style={card}>
          <label style={label}>Pháp lý</label>
          <textarea style={{ ...input, minHeight: 70 }} value={legal.body || ""} onChange={(e) => setSec("legal", { body: e.target.value })} />
        </div>
      )}

      {price && (
        <div style={card}>
          <label style={label}>Giá & thanh toán</label>
          <textarea style={{ ...input, minHeight: 70 }} value={price.body || ""} onChange={(e) => setSec("price", { body: e.target.value })} />
        </div>
      )}

      {amenities && (
        <div style={card}>
          <label style={label}>Tiện ích (mỗi dòng một mục)</label>
          <textarea style={{ ...input, minHeight: 90 }} value={(amenities.items || []).join("\n")} onChange={(e) => setItems("amenities", e.target.value)} />
        </div>
      )}

      {contact && (
        <div style={card}>
          <label style={label}>Thông tin liên hệ hiển thị trên trang</label>
          <input style={input} value={contact.contactName || ""} onChange={(e) => setSec("contact", { contactName: e.target.value })} placeholder="Tên người liên hệ" />
          <input style={{ ...input, marginTop: 10 }} value={contact.phone || ""} onChange={(e) => setSec("contact", { phone: e.target.value })} placeholder="Số điện thoại, ví dụ 0912345678" />
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "6px 0 0" }}>
            Số này sẽ thay hotline mặc định trên các nút gọi của trang landing.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        <button style={btnPrimary} onClick={save} disabled={busy !== ""}>{busy === "save" ? "Đang lưu..." : "Lưu thay đổi"}</button>
        <button style={btnGhost} onClick={() => window.open(previewUrl, "_blank")}>Xem trước</button>
        {status === "published" ? (
          <button style={btnGhost} onClick={() => changeStatus("draft")} disabled={busy !== ""}>{busy === "unpublish" ? "Đang gỡ..." : "Gỡ publish"}</button>
        ) : (
          <button style={{ ...btnPrimary, background: "#16a34a" }} onClick={() => changeStatus("published")} disabled={busy !== ""}>{busy === "publish" ? "Đang publish..." : "Publish trang"}</button>
        )}
      </div>

      {message && <p style={{ marginTop: 14, color: "#22c55e", fontSize: 14 }}>{message}</p>}
      {error && <p style={{ marginTop: 14, color: "#ef4444", fontSize: 14 }}>{error}</p>}
      {status === "published" && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--text-tertiary)" }}>
          Trang đang public tại {publicUrl} - draft chỉ xem được qua link xem trước.
        </p>
      )}
    </main>
  );
}
