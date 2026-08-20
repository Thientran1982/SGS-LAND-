"use client";
/**
 * Lightweight custom dropdown used to replace native <select> elements
 * on public-facing forms so the picker matches the rest of the design
 * system (rounded surface, CSS-variable colors, focus ring) instead of
 * the browser's default select styling.
 */
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface TopicOption {
  value: string;
  label: string;
}

export interface TopicSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: TopicOption[];
  placeholder?: string;
  name?: string;
}

export function TopicSelect({ value, onChange, options, placeholder = "Select...", name }: TopicSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        name={name}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--ui-focus)]/30"
        style={{
          background: "var(--bg-elevated)",
          border: "1.5px solid var(--border-default)",
          color: selected ? "var(--text-primary)" : "var(--text-tertiary)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 opacity-60"
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1.5 w-full max-h-64 overflow-auto rounded-xl shadow-xl py-1.5"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
        >
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:opacity-80 transition-opacity"
                style={{ color: "var(--text-primary)" }}
              >
                <span>{opt.label}</span>
                {opt.value === value ? <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary-600)" }} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default TopicSelect;
