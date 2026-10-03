"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface FormSelectOption {
  value: string;
  label: string;
}

export interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  id?: string;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  menuAlign?: "left" | "right";
  menuStyle?: React.CSSProperties;
}

export default function FormSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  name,
  disabled,
  id,
  buttonClassName = "",
  buttonStyle,
  menuAlign = "left",
  menuStyle,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<"above" | "below">("below");
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
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

  useEffect(() => {
    if (!open) return;

    const positionMenu = () => {
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!buttonRect || !menu) return;

      const gap = 8;
      const consentBanner = document.querySelector<HTMLElement>("[data-consent-banner]");
      const consentRect = consentBanner?.getBoundingClientRect();
      const bannerCoversDropdown =
        consentRect &&
        consentRect.top < window.innerHeight &&
        consentRect.bottom >= window.innerHeight - 1 &&
        consentRect.left < buttonRect.right &&
        consentRect.right > buttonRect.left;
      const visibleBottom = bannerCoversDropdown ? consentRect.top : window.innerHeight;
      const spaceBelow = Math.max(0, visibleBottom - buttonRect.bottom - gap);
      const spaceAbove = Math.max(0, buttonRect.top - gap);
      const naturalHeight = menu.scrollHeight;
      const openAbove = naturalHeight > spaceBelow && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;

      setMenuPlacement(openAbove ? "above" : "below");
      setMenuMaxHeight(Math.max(72, Math.min(naturalHeight, availableHeight)));
    };

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        id={id}
        ref={buttonRef}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 ${buttonClassName}`}
        style={{
          background: "var(--bg-app)",
          border: "1px solid var(--border-default)",
          color: selected ? "var(--text-primary)" : "var(--text-tertiary)",
          ...buttonStyle,
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
          ref={menuRef}
          role="listbox"
          className={`absolute z-20 ${menuPlacement === "above" ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${menuAlign === "right" ? "right-0" : "left-0"} w-full max-h-64 overflow-auto rounded-xl shadow-xl py-1.5`}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            ...menuStyle,
            maxHeight: menuMaxHeight ? `${menuMaxHeight}px` : undefined,
          }}
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
                {opt.value === value ? (
                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary-600)" }} />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
