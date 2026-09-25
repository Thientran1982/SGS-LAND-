"use client";
import React, { useEffect, useRef, useState } from "react";

// Home hero search: one field with a split button inside it.
// The main half searches the marketplace; the chevron opens a small menu
// with the free valuation entry, so the hero keeps a single primary action.

type Props = {
  lang: "vi" | "en";
  action: string;
  valuationHref: string;
  onAskAi?: (question: string) => void;
  withTabs?: boolean;
};

const CSS = `
  .hs-bar { display:flex; align-items:center; gap:6px; margin-bottom:26px; padding:6px 6px 6px 18px;
    border:1px solid var(--lp-line); border-radius:16px; background:var(--lp-paper);
    box-shadow:0 1px 2px rgba(15,23,42,.04); transition:border-color .15s, box-shadow .15s; }
  .hs-bar:focus-within { border-color:var(--lp-navy); box-shadow:0 0 0 3px color-mix(in srgb, var(--lp-navy) 18%, transparent); }
  .hs-icon { flex:0 0 auto; color:var(--lp-muted); }
  .hs-input { flex:1 1 auto; min-width:0; height:48px; border:0; outline:0; background:transparent;
    color:var(--lp-ink); font-size:16px; }
  .hs-input::placeholder { color:var(--lp-muted); }
  .hs-split { position:relative; display:flex; flex:0 0 auto; }
  .hs-main, .hs-more { height:48px; border:0; cursor:pointer; background:var(--lp-navy); color:var(--lp-bg);
    font-size:15px; font-weight:600; }
  .hs-main { padding:0 20px; border-radius:12px 0 0 12px; }
  .hs-more { width:44px; display:inline-flex; align-items:center; justify-content:center;
    border-radius:0 12px 12px 0; border-left:1px solid color-mix(in srgb, var(--lp-bg) 28%, transparent); }
  .hs-main:hover, .hs-more:hover { filter:brightness(1.12); }
  .hs-main:focus-visible, .hs-more:focus-visible, .hs-item:focus-visible { outline:2px solid var(--lp-navy); outline-offset:2px; }
  .hs-more svg { transition:transform .15s; }
  .hs-more[aria-expanded="true"] svg { transform:rotate(180deg); }
  .hs-menu { position:absolute; right:0; top:calc(100% + 8px); z-index:40; min-width:240px; padding:6px;
    border:1px solid var(--lp-line); border-radius:14px; background:var(--lp-paper);
    box-shadow:0 12px 32px rgba(15,23,42,.16); }
  .hs-item { width:100%; border:0; background:transparent; text-align:left; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:2px; padding:10px 12px; border-radius:10px;
    color:var(--lp-ink); text-decoration:none; }
  .hs-item:hover { background:color-mix(in srgb, var(--lp-navy) 8%, transparent); }
  .hs-item b { font-size:14px; font-weight:600; }
  .hs-item span { font-size:12.5px; color:var(--lp-muted); }
  .hs-short { display:none; }
  .hs-tabs { display:inline-flex; gap:4px; padding:4px; margin-bottom:10px; border-radius:12px; background:color-mix(in srgb, var(--lp-navy) 7%, transparent); }
  .hs-tab { height:34px; padding:0 16px; border:0; border-radius:9px; background:transparent; color:var(--lp-muted); font-size:14px; font-weight:600; cursor:pointer; }
  .hs-tab[aria-pressed="true"] { background:var(--lp-paper); color:var(--lp-ink); box-shadow:0 1px 3px rgba(15,23,42,.12); }
  .hs-tab:focus-visible { outline:2px solid var(--lp-navy); outline-offset:2px; }
  @media (max-width: 480px) {
    .hs-bar { padding-left:12px; }
    .hs-icon { display:none; }
    .hs-main { padding:0 14px; }
    .hs-long { display:none; }
    .hs-short { display:inline; }
  }
`;

export default function HeroSearch({ lang, action, valuationHref, onAskAi, withTabs }: Props) {
  const [tx, setTx] = useState<"SALE" | "RENT">("SALE");
  const vi = lang === "vi";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    (itemRef.current ?? wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]'))?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); moreRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
    <style>{CSS}</style>
    {withTabs && (
      <div className="hs-tabs" role="group" aria-label={vi ? "Loại giao dịch" : "Transaction type"}>
        <button type="button" className="hs-tab" aria-pressed={tx === "SALE"} onClick={() => setTx("SALE")}>{vi ? "Mua bán" : "Buy"}</button>
        <button type="button" className="hs-tab" aria-pressed={tx === "RENT"} onClick={() => setTx("RENT")}>{vi ? "Cho thuê" : "Rent"}</button>
      </div>
    )}
    <form action={action} method="get" role="search" data-hero-search className="hs-bar">
      {withTabs && <input type="hidden" name="transaction" value={tx} />}
      <svg className="hs-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <label htmlFor="lp-hero-q" className="sr-only">{vi ? "Tìm bất động sản" : "Search properties"}</label>
      <input
        ref={inputRef}
        id="lp-hero-q"
        name="q"
        type="search"
        autoComplete="off"
        className="hs-input"
        placeholder={vi ? "Dự án, khu vực, mã căn" : "Project, area or unit code"}
      />
      <div className="hs-split" ref={wrapRef}>
        <button type="submit" className="hs-main">
          <span className="hs-long">{vi ? "Tìm bất động sản" : "Search properties"}</span>
          <span className="hs-short">{vi ? "Tìm" : "Search"}</span>
        </button>
        <button
          ref={moreRef}
          type="button"
          className="hs-more"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="hs-menu"
          aria-label={vi ? "Tuỳ chọn khác" : "More options"}
          onClick={() => setOpen(o => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && (
          <div id="hs-menu" role="menu" className="hs-menu">
            {onAskAi && (
              <button
                ref={itemRef}
                type="button"
                role="menuitem"
                className="hs-item"
                onClick={() => { setOpen(false); onAskAi(inputRef.current?.value.trim() || ""); }}
              >
                <b>{vi ? "Hỏi AI tư vấn" : "Ask the AI advisor"}</b>
                <span>{vi ? "Mô tả nhu cầu, AI gợi ý căn phù hợp" : "Describe what you need, get matching options"}</span>
              </button>
            )}
            <a role="menuitem" href={valuationHref} className="hs-item" onClick={() => setOpen(false)}>
              <b>{vi ? "Định giá miễn phí" : "Free valuation"}</b>
              <span>{vi ? "Ước tính giá nhà đất bằng AI" : "Estimate a property's value with AI"}</span>
            </a>
          </div>
        )}
      </div>
    </form>
    </>
  );
}
