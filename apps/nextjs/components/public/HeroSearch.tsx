"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FormSelect from "@/components/ui/FormSelect";
import { SlidersHorizontal, X } from "lucide-react";

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
  .hs-topline { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:12px; }
  .hs-tabs { display:inline-flex; gap:4px; padding:4px; border:1px solid rgba(255,255,255,.32); border-radius:999px; background:rgba(11,27,43,.42); backdrop-filter:blur(14px); }
  .hs-tab { min-height:38px; padding:0 17px; border:0; border-radius:999px; background:transparent; color:rgba(255,255,255,.82); font-size:13px; font-weight:600; cursor:pointer; transition:background .18s,color .18s; }
  .hs-tab[aria-pressed="true"] { background:#FAF8F4; color:#0B1B2B; }
  .hs-tab:focus-visible,.hs-ai:focus-visible,.hs-main:focus-visible { outline:3px solid #C8963E; outline-offset:3px; }
  .hs-input:focus-visible:not(.hs-input-pointer-focus) { outline:3px solid #C8963E; outline-offset:3px; }
  .hs-ai { min-height:42px; padding:0 16px; display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid rgba(255,255,255,.42); border-radius:999px; background:rgba(255,255,255,.12); color:#fff; backdrop-filter:blur(14px); font:600 13px var(--font-be-vietnam,sans-serif); cursor:pointer; transition:background .18s,transform .18s; }
  .hs-ai-mark { width:20px; height:20px; display:inline-grid; place-items:center; border-radius:50%; background:#C8963E; color:#0B1B2B; font-size:9px; font-weight:800; letter-spacing:-.05em; }
  .hs-ai:hover { background:rgba(255,255,255,.2); transform:translateY(-1px); }
  .hs-bar { display:grid; grid-template-columns:minmax(190px,1.45fr) minmax(145px,.8fr) minmax(145px,.8fr) auto; align-items:stretch; gap:0; padding:7px; border:1px solid rgba(255,255,255,.74); border-radius:22px; background:rgba(250,248,244,.96); box-shadow:0 20px 54px rgba(0,0,0,.2); backdrop-filter:blur(20px); }
  .hs-field { min-width:0; padding:8px 16px; display:flex; flex-direction:column; justify-content:center; gap:3px; }
  .hs-field + .hs-field { border-left:1px solid #E4DED3; }
  .hs-field label { color:#666D73; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
  .hs-input,.hs-field .hs-form-select-trigger { width:100%; min-width:0; height:30px; padding:0; border:0; outline:0; background:transparent; color:#0B1B2B; font:500 14px var(--font-be-vietnam,sans-serif); }
  .hs-input::placeholder { color:#7B8186; opacity:1; }
  .hs-field .hs-form-select-trigger { cursor:pointer; border-radius:0!important; box-shadow:none; text-align:left; }
  .hs-field .hs-form-select-trigger:focus-visible { outline:2px solid #123b46; outline-offset:2px; border-radius:4px!important; box-shadow:none; }
  .hs-field [role="listbox"] { white-space:nowrap; }
  .hs-main { min-height:56px; min-width:126px; padding:0 22px; border:0; border-radius:16px; background:#C8963E; color:#0B1B2B; font:700 14px var(--font-be-vietnam,sans-serif); cursor:pointer; transition:filter .18s,transform .18s; }
  .hs-main:hover { filter:brightness(1.06); transform:translateY(-1px); }
  .hs-support { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:12px; color:rgba(255,255,255,.84); font-size:12px; }
  .hs-suggestion { min-height:31px; padding:0 11px; border:1px solid rgba(255,255,255,.32); border-radius:999px; background:rgba(11,27,43,.25); color:#fff; font:500 11px var(--font-be-vietnam,sans-serif); cursor:pointer; }
  .hs-suggestion:hover { background:rgba(255,255,255,.16); }
  .hs-valuation { color:#F3D79D; text-underline-offset:3px; font-weight:600; }
  .hs-location-control { min-width:0; }
  .hs-ai-inline,.hs-mobile-actions,.hs-filter-backdrop { display:none; }
  .hs-ai-inline { border-color:#D9D3C9; background:#F3EFE7; color:#0B1B2B; backdrop-filter:none; white-space:nowrap; }
  .hs-ai-inline:hover { background:#EFE7D8; }
  .hs-filter-trigger { min-height:56px; padding:0 18px; border:1px solid #D9D3C9; border-radius:16px; background:#fff; color:#0B1B2B; font:650 14px var(--font-be-vietnam,sans-serif); cursor:pointer; }
  .hs-filter-backdrop { position:fixed; z-index:2147483640; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:12px 12px 0; background:rgba(7,19,30,.58); }
  .hs-filter-sheet { width:min(100%,520px); max-height:min(720px,calc(100dvh - 24px)); overflow:auto; padding:20px 20px calc(18px + env(safe-area-inset-bottom)); border-radius:22px 22px 0 0; background:#FAF8F4; color:#0B1B2B; box-shadow:0 -18px 60px rgba(0,0,0,.2); }
  .hs-sheet-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
  .hs-sheet-eyebrow { display:block; color:#946D2A; font-size:11px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; }
  .hs-sheet-head h2 { margin:5px 0 0; font:500 24px/1.15 var(--font-fraunces,Georgia,serif); }
  .hs-sheet-close { display:grid; width:44px; height:44px; flex:0 0 auto; place-items:center; border:1px solid #D9D3C9; border-radius:50%; background:#fff; color:#0B1B2B; cursor:pointer; }
  .hs-sheet-field { display:flex; flex-direction:column; gap:7px; margin-top:14px; }
  .hs-sheet-field label { color:#4F5961; font-size:14px; font-weight:650; }
  .hs-sheet-field .hs-form-select-trigger { width:100%; min-height:48px; padding:0 13px!important; border:1px solid #D9D3C9!important; border-radius:12px!important; background:#fff!important; color:#0B1B2B!important; font-size:15px!important; text-align:left; }
  .hs-sheet-field .hs-mobile-select { width:100%; min-height:48px; padding:0 13px; border:1px solid #D9D3C9; border-radius:12px; background:#fff; color:#0B1B2B; font:500 15px var(--font-be-vietnam,sans-serif); }
  .hs-sheet-field .hs-mobile-select:focus-visible { outline:3px solid #C8963E; outline-offset:3px; }
  .hs-sheet-actions { display:grid; grid-template-columns:.8fr 1.2fr; gap:10px; margin-top:22px; }
  .hs-sheet-actions button { min-height:50px; border-radius:12px; font:650 15px var(--font-be-vietnam,sans-serif); cursor:pointer; }
  .hs-sheet-reset { border:1px solid #D9D3C9; background:#fff; color:#0B1B2B; }
  .hs-sheet-apply { border:0; background:#C8963E; color:#0B1B2B; }
  .hs-tab:focus-visible,.hs-ai:focus-visible,.hs-main:focus-visible,.hs-filter-trigger:focus-visible,
  .hs-sheet-close:focus-visible,.hs-sheet-actions button:focus-visible { outline:3px solid #C8963E; outline-offset:3px; }
  @media (max-width: 767px) {
    .hs-topline { align-items:flex-start; margin-bottom:10px; }
    .hs-topline .hs-ai { display:none; }
    .hs-ai-inline { display:inline-flex; min-height:44px; flex:0 0 auto; padding:0 10px; font-size:14px; }
    .hs-bar { display:flex; flex-direction:column; gap:8px; padding:9px; border-radius:18px; }
    .hs-field:first-child { min-height:70px; padding:2px 8px 4px; border:0; }
    .hs-field:first-child label { font-size:14px; letter-spacing:0; text-transform:none; }
    .hs-location-control { display:flex; align-items:center; gap:5px; }
    .hs-input { height:48px!important; flex:1 1 auto; font-size:15px!important; }
    .hs-desktop-filter-field,.hs-desktop-submit { display:none!important; }
    .hs-mobile-actions { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.1fr); gap:8px; }
    .hs-filter-trigger { min-height:52px; display:flex; align-items:center; justify-content:center; gap:8px; padding:0 10px; border-radius:12px; font-size:14px; white-space:nowrap; }
    .hs-filter-count { display:inline-grid; min-width:21px; height:21px; padding-inline:5px; place-items:center; border-radius:999px; background:#F3EFE7; color:#0B1B2B; font-size:12px; }
    .hs-mobile-actions .hs-main { width:100%; min-width:0; min-height:52px; padding:0 12px; border-radius:12px; font-size:15px; }
    .hs-filter-backdrop { display:flex; }
    .hs-support { gap:8px; font-size:13px; }
    .hs-suggestion { min-height:40px; padding-inline:12px; font-size:13px; }
    .hs-valuation { min-height:40px; display:inline-flex; align-items:center; font-size:14px; }
    .hs-tab { min-height:44px; }
  }
  @media (max-width: 420px) {
    .hs-tab { padding:0 12px; font-size:13px; }
    .hs-support { gap:6px; }
    .hs-support > span:first-child { width:100%; }
  }
  @media (prefers-reduced-motion:reduce) { .hs-tab,.hs-ai,.hs-main { transition:none; } }
`;

export default function HeroSearch({ lang, action, valuationHref, onAskAi, withTabs }: Props) {
  const [tx, setTx] = useState<"SALE" | "RENT">("SALE");
  const vi = lang === "vi";
  const inputRef = useRef<HTMLInputElement>(null);
  const [locationPointerFocused, setLocationPointerFocused] = useState(false);
  const [propertyType, setPropertyType] = useState("");
  const [budget, setBudget] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterSheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget = filterSheetRef.current?.querySelector<HTMLElement>("button");
    focusTarget?.focus();
    const onSheetKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
      if (event.key !== "Tab") return;
      const focusable = Array.from(filterSheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[role="button"],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]',
      ) || []).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnDesktopResize = () => {
      if (window.innerWidth > 767) setFiltersOpen(false);
    };
    window.addEventListener("keydown", onSheetKeyDown);
    window.addEventListener("resize", closeOnDesktopResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onSheetKeyDown);
      window.removeEventListener("resize", closeOnDesktopResize);
      filterTriggerRef.current?.focus();
    };
  }, [filtersOpen]);
  const selectedFilterCount = Number(Boolean(propertyType)) + Number(Boolean(budget));
  const propertyTypeOptions = [
    { value: "", label: vi ? "Tất cả loại" : "Any type" },
    { value: "Apartment", label: vi ? "Căn hộ" : "Apartment" },
    { value: "Townhouse", label: vi ? "Nhà phố" : "Townhouse" },
    { value: "Villa", label: vi ? "Biệt thự" : "Villa" },
    { value: "Land", label: vi ? "Đất nền" : "Land" },
  ];
  const budgetOptions = [
    { value: "", label: vi ? "Chọn ngân sách" : "Choose a budget" },
    { value: "3", label: vi ? "Dưới 3 tỷ" : "Under VND 3B" },
    { value: "5", label: vi ? "Dưới 5 tỷ" : "Under VND 5B" },
    { value: "10", label: vi ? "Dưới 10 tỷ" : "Under VND 10B" },
    { value: "20", label: vi ? "Dưới 20 tỷ" : "Under VND 20B" },
  ];
  const suggestions = vi
    ? ["Thủ Đức", "Aqua City", "Dưới 5 tỷ"]
    : ["Thu Duc", "Aqua City", "Under VND 5B"];
  const fillSuggestion = (value: string) => {
    if (/under|dưới/i.test(value)) {
      setBudget("5");
      return;
    }
    if (inputRef.current) {
      inputRef.current.value = value;
      inputRef.current.focus();
    }
  };
  const askAi = () => {
    const location = inputRef.current?.value.trim() || "";
    const typeLabel = propertyType ? propertyTypeOptions.find(option => option.value === propertyType)?.label || "" : "";
    const budgetLabel = budget === "5" ? (vi ? "dưới 5 tỷ" : "under VND 5B") : "";
    const details = [location, typeLabel, budgetLabel].filter(Boolean).join(", ");
    onAskAi?.(details ? (vi ? `Tôi đang tìm bất động sản ${details}.` : `I'm looking for a property: ${details}.`) : "");
  };

  return (
    <>
    <style>{CSS}</style>
    <div className="hs-search">
      <div className="hs-topline">
        {withTabs && (
          <div className="hs-tabs" role="group" aria-label={vi ? "Loại giao dịch" : "Transaction type"}>
            <button type="button" className="hs-tab" aria-pressed={tx === "SALE"} onClick={() => setTx("SALE")}>{vi ? "Mua bán" : "Buy"}</button>
            <button type="button" className="hs-tab" aria-pressed={tx === "RENT"} onClick={() => setTx("RENT")}>{vi ? "Cho thuê" : "Rent"}</button>
          </div>
        )}
        {onAskAi && (
          <button type="button" className="hs-ai" onClick={askAi}>
            <span className="hs-ai-mark" aria-hidden="true">AI</span>{vi ? "Hỏi AI" : "Ask AI"}
          </button>
        )}
      </div>
      <form action={action} method="get" role="search" data-hero-search className="hs-bar">
        {withTabs && <input type="hidden" name="transaction" value={tx} />}
        <div className="hs-field">
          <label htmlFor="lp-hero-q">{vi ? "Khu vực" : "Location"}</label>
          <div className="hs-location-control">
            <input
              ref={inputRef}
              id="lp-hero-q"
              name="q"
              type="search"
              autoComplete="off"
              className={`hs-input${locationPointerFocused ? " hs-input-pointer-focus" : ""}`}
              onPointerDown={() => setLocationPointerFocused(true)}
              onKeyDown={event => {
                if (event.key === "Tab") setLocationPointerFocused(false);
              }}
              onBlur={() => setLocationPointerFocused(false)}
              placeholder={vi ? "Nhập khu vực" : "Enter location"}
            />
            {onAskAi && (
              <button type="button" className="hs-ai hs-ai-inline" onClick={askAi}>
                <span className="hs-ai-mark" aria-hidden="true">AI</span>{vi ? "Hỏi AI" : "Ask AI"}
              </button>
            )}
          </div>
        </div>
        <div className="hs-field hs-desktop-filter-field">
          <label htmlFor="lp-hero-type">{vi ? "Loại bất động sản" : "Property type"}</label>
          <FormSelect
            id="lp-hero-type"
            name="type"
            value={propertyType}
            onChange={setPropertyType}
            options={propertyTypeOptions}
            buttonClassName="hs-form-select-trigger"
            buttonStyle={{ height: "30px", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: "#0B1B2B" }}
            menuStyle={{ width: "max-content", minWidth: "100%", maxWidth: "calc(100vw - 32px)" }}
          />
        </div>
        <div className="hs-field hs-desktop-filter-field">
          <label htmlFor="lp-hero-budget">{vi ? "Ngân sách tối đa" : "Maximum budget"}</label>
          <FormSelect
            id="lp-hero-budget"
            name="maxPrice"
            value={budget}
            onChange={setBudget}
            options={budgetOptions}
            buttonClassName="hs-form-select-trigger"
            buttonStyle={{ height: "30px", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: "#0B1B2B" }}
            menuAlign="right"
            menuStyle={{ width: "max-content", minWidth: "100%", maxWidth: "calc(100vw - 32px)" }}
          />
        </div>
        <button type="submit" className="hs-main hs-desktop-submit">{vi ? "Tìm nhà" : "Find a home"}</button>
        <div className="hs-mobile-actions">
          <button
            ref={filterTriggerRef}
            type="button"
            className="hs-filter-trigger"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            aria-controls="hs-filter-sheet"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            {vi ? "Bộ lọc" : "Filters"}
            {selectedFilterCount > 0 && <span className="hs-filter-count" aria-label={vi ? `${selectedFilterCount} bộ lọc đang chọn` : `${selectedFilterCount} filters selected`}>{selectedFilterCount}</span>}
          </button>
          <button type="submit" className="hs-main">{vi ? "Tìm nhà" : "Search"}</button>
        </div>
      </form>
      {filtersOpen && typeof document !== "undefined" && createPortal(
        <div className="hs-filter-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setFiltersOpen(false);
        }}>
          <section
            id="hs-filter-sheet"
            ref={filterSheetRef}
            className="hs-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hs-filter-title"
          >
            <div className="hs-sheet-head">
              <div>
                <span className="hs-sheet-eyebrow">{vi ? "Tùy chỉnh tìm kiếm" : "Refine your search"}</span>
                <h2 id="hs-filter-title">{vi ? "Bộ lọc bất động sản" : "Property filters"}</h2>
              </div>
              <button type="button" className="hs-sheet-close" aria-label={vi ? "Đóng bộ lọc" : "Close filters"} onClick={() => setFiltersOpen(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="hs-sheet-field">
              <label htmlFor="lp-hero-type-mobile">{vi ? "Loại bất động sản" : "Property type"}</label>
              <select
                id="lp-hero-type-mobile"
                className="hs-mobile-select"
                value={propertyType}
                onChange={event => setPropertyType(event.target.value)}
              >
                {propertyTypeOptions.map(option => (
                  <option key={option.value || "all-types"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="hs-sheet-field">
              <label htmlFor="lp-hero-budget-mobile">{vi ? "Ngân sách tối đa" : "Maximum budget"}</label>
              <select
                id="lp-hero-budget-mobile"
                className="hs-mobile-select"
                value={budget}
                onChange={event => setBudget(event.target.value)}
              >
                {budgetOptions.map(option => (
                  <option key={option.value || "all-budgets"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="hs-sheet-actions">
              <button type="button" className="hs-sheet-reset" onClick={() => { setPropertyType(""); setBudget(""); }}>
                {vi ? "Xóa lọc" : "Clear"}
              </button>
              <button type="button" className="hs-sheet-apply" onClick={() => setFiltersOpen(false)}>
                {vi ? "Áp dụng" : "Apply"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
      <div className="hs-support">
        <span>{vi ? "Gợi ý:" : "Try:"}</span>
        {suggestions.map(suggestion => (
          <button key={suggestion} type="button" className="hs-suggestion" onClick={() => fillSuggestion(suggestion)}>{suggestion}</button>
        ))}
        <a className="hs-valuation" href={valuationHref}>{vi ? "Định giá miễn phí" : "Free valuation"}</a>
      </div>
    </div>
    </>
  );
}
