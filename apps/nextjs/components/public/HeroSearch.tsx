"use client";
import React, { useRef, useState } from "react";
import FormSelect from "@/components/ui/FormSelect";

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
  .hs-main { min-height:56px; min-width:126px; padding:0 22px; border:0; border-radius:16px; background:#C8963E; color:#0B1B2B; font:700 14px var(--font-be-vietnam,sans-serif); cursor:pointer; transition:filter .18s,transform .18s; }
  .hs-main:hover { filter:brightness(1.06); transform:translateY(-1px); }
  .hs-support { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:12px; color:rgba(255,255,255,.84); font-size:12px; }
  .hs-suggestion { min-height:31px; padding:0 11px; border:1px solid rgba(255,255,255,.32); border-radius:999px; background:rgba(11,27,43,.25); color:#fff; font:500 11px var(--font-be-vietnam,sans-serif); cursor:pointer; }
  .hs-suggestion:hover { background:rgba(255,255,255,.16); }
  .hs-valuation { color:#F3D79D; text-underline-offset:3px; font-weight:600; }
  @media (max-width: 700px) {
    .hs-bar { grid-template-columns:minmax(0,1fr) minmax(0,1fr); border-radius:20px; gap:0; }
    .hs-field:first-child { grid-column:1/-1; border-bottom:1px solid #E4DED3; }
    .hs-field:nth-child(2) { border-left:0; }
    .hs-field { padding:9px 12px; }
    .hs-main { grid-column:1/-1; min-height:48px; margin-top:6px; }
  }
  @media (max-width: 420px) {
    .hs-topline { align-items:flex-start; }
    .hs-tab { padding:0 12px; font-size:12px; }
    .hs-ai { padding:0 11px; font-size:12px; }
    .hs-field label { font-size:9px; }
    .hs-input,.hs-field .hs-form-select-trigger { font-size:12px; }
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
            placeholder={vi ? "Nhập khu vực bạn quan tâm" : "Enter an area"}
          />
        </div>
        <div className="hs-field">
          <label htmlFor="lp-hero-type">{vi ? "Loại bất động sản" : "Property type"}</label>
          <FormSelect
            id="lp-hero-type"
            name="type"
            value={propertyType}
            onChange={setPropertyType}
            options={propertyTypeOptions}
            buttonClassName="hs-form-select-trigger"
            buttonStyle={{ height: "30px", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: "#0B1B2B" }}
          />
        </div>
        <div className="hs-field">
          <label htmlFor="lp-hero-budget">{vi ? "Ngân sách tối đa" : "Maximum budget"}</label>
          <FormSelect
            id="lp-hero-budget"
            name="maxPrice"
            value={budget}
            onChange={setBudget}
            options={budgetOptions}
            buttonClassName="hs-form-select-trigger"
            buttonStyle={{ height: "30px", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: "#0B1B2B" }}
          />
        </div>
        <button type="submit" className="hs-main">{vi ? "Tìm nhà" : "Find a home"}</button>
      </form>
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
