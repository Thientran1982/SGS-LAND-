"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <div className="rounded-xl overflow-hidden my-4 shadow-lg" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="flex justify-between items-center px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-[11px] font-mono uppercase" style={{ color: "#94a3b8" }}>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors"
          style={{ color: copied ? "#10b981" : "#94a3b8" }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Đã sao chép" : "Sao chép"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed" style={{ color: "#dbeafe" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
