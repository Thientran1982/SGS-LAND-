// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { trackPropertyView } from "@/lib/tracking";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLang } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";
type L = "vi" | "en";
import { MapPin, Bed, Bath, Square, Phone, Share2, Heart, ArrowLeft, CheckCircle, Calendar, Landmark, Eye, ChevronDown } from "lucide-react";
interface Listing {
  id: string;
  code?: string;
  title: string;
  price: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  location?: string;
  coordinates?: { lat?: number; lng?: number };
  projectCode?: string;
  type?: string;
  status?: string;
  description?: string;
  legalStatus?: string;
  images?: string[];
  attributes?: {
    floor?: number;
    tower?: string;
    view?: string;
    furniture?: string;
    legalStatus?: string;
  };
}
interface Props {
  listing: Listing;
  similarListings: Listing[];
}
const ListingMap = dynamic(() => import("./ListingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-sm" style={{ minHeight: "320px", color: "var(--text-tertiary)" }}>{tt(useLang(), "Đang tải bản đồ…", "Loading map…")}</div>
  ),
});

function formatPrice(price: number, g: L = "vi"): string {
  if (price >= 1e9) return g === "en" ? `${(price / 1e9).toFixed(2)}B VND` : `${(price / 1e9).toFixed(2)} tỷ VNĐ`;
  const m = Math.round(price / 1e6).toLocaleString();
  return g === "en" ? `${m}M VND` : `${m} triệu VNĐ`;
}
function formatUnitPrice(price: number, area?: number, g: L = "vi"): string {
  if (!area) return "";
  const unitPrice = price / area / 1e6;
  return g === "en" ? `${unitPrice.toFixed(1)}M/m²` : `${unitPrice.toFixed(1)} triệu/m²`;
}

function TimePicker({ value, onChange, lang }: { value: string; onChange: (value: string) => void; lang: L }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const times = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tt(lang, "Chọn giờ xem nhà", "Choose viewing time")}
        onClick={() => setOpen((current) => !current)}
        className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
      >
        <span>{value}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-tertiary)" }} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={tt(lang, "Các giờ có thể đặt", "Available viewing times")}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl p-1 shadow-lg"
          style={{ background: "var(--bg-surface, #fff)", border: "1px solid var(--border-default)" }}
        >
          {times.map((time) => (
            <button
              key={time}
              type="button"
              role="option"
              aria-selected={time === value}
              onClick={() => { onChange(time); setOpen(false); }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--primary-subtle)]"
              style={{ color: time === value ? "var(--sgs-primary, #1B3A5C)" : "var(--text-primary)", fontWeight: time === value ? 700 : 500 }}
            >
              {time}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoanCalculator({ price }: { price: number }) {
  const lang = useLang();
  const [ratio, setRatio] = useState(70);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(8);
  const [tab, setTab] = useState("loan");
  const [hold, setHold] = useState(5);
  const RENT_M = 0.004, GROWTH = 0.07;
  const monthlyRent = Math.round(price * RENT_M);
  const rentIncome = monthlyRent * 12 * hold;
  const appreciation = Math.round(price * (Math.pow(1 + GROWTH, hold) - 1));
  const totalProfit = rentIncome + appreciation;
  const roi = price > 0 ? (totalProfit / price) * 100 : 0;
  const principal = Math.round((price * ratio) / 100);
  const own = price - principal;
  const monthly = useMemo(() => {
    const r = rate / 100 / 12; const n = years * 12;
    if (r === 0) return principal / n;
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }, [principal, years, rate]);
  const vnd = (x: number) => Math.round(x).toLocaleString("vi-VN") + (lang === "en" ? " VND" : " đ");
  const inp = { background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
  return (
    <div className="p-6 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
      <div className="flex mb-5 -mx-6 -mt-6 overflow-hidden rounded-t-2xl" style={{ borderBottom: "1px solid var(--border-default)" }}>
        <button onClick={() => setTab("loan")} className="flex-1 py-3.5 text-xs font-bold uppercase tracking-wide transition-colors" style={{ background: tab === "loan" ? "var(--sgs-primary, #1B3A5C)" : "transparent", color: tab === "loan" ? "#fff" : "var(--text-secondary)" }}>{tt(lang, "Vay Ngân Hàng", "Bank Loan")}</button>
        <button onClick={() => setTab("roi")} className="flex-1 py-3.5 text-xs font-bold uppercase tracking-wide transition-colors" style={{ background: tab === "roi" ? "var(--sgs-primary, #1B3A5C)" : "transparent", color: tab === "roi" ? "#fff" : "var(--text-secondary)" }}>{tt(lang, "Hiệu Quả Đầu Tư", "Investment Return")}</button>
      </div>
      {tab === "loan" ? (
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}><span>{tt(lang, "TỶ LỆ VAY", "LOAN RATIO")}</span><span>{ratio}%</span></div>
          <input type="range" min={0} max={90} step={5} value={ratio} onChange={(e) => setRatio(+e.target.value)} className="w-full" style={{ accentColor: "var(--sgs-primary, #1B3A5C)" }} />
          <div className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Vốn tự có", "Your equity")}: {vnd(own)}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{tt(lang, "THỜI HẠN (NĂM)", "TERM (YEARS)")}</div>
            <input type="number" min={1} max={35} value={years} onChange={(e) => setYears(Math.max(1, +e.target.value || 1))} className="w-full px-3 py-2 rounded-lg text-sm" style={inp} /></div>
          <div><div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{tt(lang, "LÃI SUẤT (%)", "INTEREST RATE (%)")}</div>
            <input type="number" min={0} max={20} step={0.1} value={rate} onChange={(e) => setRate(Math.max(0, +e.target.value || 0))} className="w-full px-3 py-2 rounded-lg text-sm" style={inp} /></div>
        </div>
        <div className="p-4 rounded-xl" style={{ background: "var(--primary-subtle, rgba(27,58,92,0.06))" }}>
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{tt(lang, "TRẢ HÀNG THÁNG (ƯỚC TÍNH)", "ESTIMATED MONTHLY PAYMENT")}</div>
          <div className="text-2xl font-extrabold" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>{vnd(monthly)}</div>
          <div className="flex justify-between text-sm mt-3 pt-3" style={{ borderTop: "1px solid var(--border-default)" }}><span style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Tổng gốc vay", "Total loan principal")}</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{vnd(principal)}</span></div>
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "* Ước tính theo dư nợ giảm dần, chỉ mang tính tham khảo.", "* Estimated on a reducing-balance basis, for reference only.")}</p>
      </div>
      ) : (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="text-[12px] uppercase font-semibold" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Lợi suất thuê", "Rental yield")}</div>
            <div className="text-lg font-extrabold" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>{tt(lang, "~4,8%/năm", "~4.8%/year")}</div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="text-[12px] uppercase font-semibold" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Giá thuê ước tính", "Estimated rent")}</div>
            <div className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>{vnd(monthlyRent)}</div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}><span>{tt(lang, "THỜI GIAN NẮM GIỮ", "HOLDING PERIOD")}</span><span>{hold} {tt(lang, "năm", "years")}</span></div>
          <input type="range" min={1} max={15} value={hold} onChange={(e) => setHold(+e.target.value)} className="w-full" style={{ accentColor: "var(--sgs-primary, #1B3A5C)" }} />
        </div>
        <div className="p-4 rounded-xl" style={{ background: "var(--primary-subtle, rgba(27,58,92,0.06))" }}>
          <div className="flex justify-between text-sm py-1"><span style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Thu nhập cho thuê", "Rental income")} ({hold} {tt(lang, "năm", "yrs")})</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{vnd(rentIncome)}</span></div>
          <div className="flex justify-between text-sm py-1"><span style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Tăng giá vốn (~7%/năm)", "Capital growth (~7%/yr)")}</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{vnd(appreciation)}</span></div>
          <div className="flex justify-between items-end mt-2 pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>{tt(lang, "Tổng lợi nhuận", "Total return")}</span>
            <div className="text-right"><div className="text-xl font-extrabold" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>{vnd(totalProfit)}</div><div className="text-xs font-bold" style={{ color: "var(--color-success, #0B6B54)" }}>ROI {roi.toFixed(1)}%</div></div>
          </div>
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "* Giả định thuê ~4,8%/năm & tăng giá ~7%/năm (trung bình thị trường). Chỉ tham khảo.", "* Assumes ~4.8%/yr rental yield and ~7%/yr appreciation (market average). Reference only.")}</p>
      </div>
      )}
    </div>
  );
}

export function ListingDetailPage({ listing, similarListings }: Props) {
  const lang = useLang();
  const [currentImg, setCurrentImg] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bk, setBk] = useState({ name: "", phone: "", date: "", time: "09:00", notes: "" });
  const [bkState, setBkState] = useState({ loading: false, ok: "", err: "" });

  // Favourites persist locally so the heart survives a reload (no public API).
  useEffect(() => {
    try {
      const fav = JSON.parse(localStorage.getItem("sgs_favorites") || "[]");
      setIsFav(Array.isArray(fav) && fav.indexOf(listing.id) >= 0);
    } catch {}
  }, [listing.id]);
  const toggleFav = () => {
    try {
      const fav = JSON.parse(localStorage.getItem("sgs_favorites") || "[]");
      const arr = Array.isArray(fav) ? fav : [];
      const next = arr.indexOf(listing.id) >= 0 ? arr.filter((x) => x !== listing.id) : arr.concat([listing.id]);
      localStorage.setItem("sgs_favorites", JSON.stringify(next));
      setIsFav(next.indexOf(listing.id) >= 0);
    } catch { setIsFav((v) => !v); }
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!bk.name.trim() || !bk.phone.trim() || !bk.date) {
      setBkState({ loading: false, ok: "", err: tt(lang, "Vui lòng nhập họ tên, số điện thoại và chọn ngày.", "Please enter your name, phone number and pick a date.") });
      return;
    }
    setBkState({ loading: true, ok: "", err: "" });
    const dateText = bk.date + " " + bk.time;
    try {
      const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      const H = { "Content-Type": "application/json" };
      if (m) H["X-CSRF-Token"] = decodeURIComponent(m[1]);
      const leadRes = await fetch("/api/public/leads", {
        method: "POST", headers: H, credentials: "include",
        body: JSON.stringify({
          name: bk.name, phone: bk.phone, source: "WEBSITE",
          notes: "Đặt lịch xem nhà: " + dateText + " — " + (listing.title || "") + " (" + (listing.code || listing.id) + ")" + (bk.notes ? " — " + bk.notes : ""),
        }),
      });
      const lead = await leadRes.json().catch(() => ({}));
      if (!leadRes.ok || !lead.id) throw new Error(lead.error || tt(lang, "Không gửi được yêu cầu.", "Could not send your request."));
      const bres = await fetch("/api/public/livechat/book-viewing", {
        method: "POST", headers: H, credentials: "include",
        body: JSON.stringify({ leadId: lead.id, dateText, listingId: listing.id, notes: bk.notes || undefined }),
      });
      const bj = await bres.json().catch(() => ({}));
      setBkState({
        loading: false,
        ok: bres.ok && bj.scheduledAtFormatted
          ? tt(lang, "Đã đặt lịch: ", "Booked: ") + bj.scheduledAtFormatted
          : tt(lang, "Đã gửi yêu cầu đặt lịch. SGS LAND sẽ gọi xác nhận trong ít phút.", "Request sent. SGS LAND will call to confirm shortly."),
        err: "",
      });
    } catch (err) {
      setBkState({ loading: false, ok: "", err: (err && err.message) || tt(lang, "Có lỗi, vui lòng thử lại.", "Something went wrong, please try again.") });
    }
  };

  useEffect(() => {
    trackPropertyView(listing.code || listing.id, listing.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: listing.title, text: listing.title, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const images = listing.images?.length ? listing.images : ["/images/placeholder.jpg"];
  const attr = listing.attributes ?? {};
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>
        <Link href={lang === "en" ? "/en" : "/"} className="hover:opacity-80">{tt(lang, "Trang chủ", "Home")}</Link>
        <span>/</span>
        <Link href={lang === "en" ? "/en/marketplace" : "/marketplace"} className="hover:opacity-80">{tt(lang, "Tìm kiếm", "Search")}</Link>
        <span>/</span>
        <span className="truncate max-w-xs" style={{ color: "var(--text-primary)" }}>{listing.title}</span>
      </nav>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Images + Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
            <div className="relative aspect-video">
              <img
                src={images[currentImg]}
                alt={listing.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "/images/placeholder.jpg"; }}
              />
              <button onClick={handleShare}
                className="absolute top-4 right-4 p-2 rounded-xl glass-card transition-all hover:scale-105"
                title={copied ? tt(lang, "Đã copy!", "Copied!") : tt(lang, "Chia sẻ", "Share")}>
                {copied ? <CheckCircle className="w-5 h-5 text-sgs-verified" /> : <Share2 className="w-5 h-5" style={{ color: "var(--text-primary)" }} />}
              </button>
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto thin-scrollbar">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setCurrentImg(i)}
                    className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === currentImg ? "border-indigo-500" : "border-transparent opacity-60"}`}>
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Title & Meta */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {listing.type && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                      {listing.type}
                    </span>
                  )}
                  {listing.code && (
                    <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                      #{listing.code}
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold leading-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
                  {listing.title}
                </h1>
              </div>
              <button onClick={toggleFav} aria-label={tt(lang, "Yêu thích", "Favourite")}
                className="p-2 rounded-xl transition-all hover:scale-110"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <Heart className={`w-5 h-5 ${isFav ? "fill-red-500 text-red-500" : ""}`}
                  style={{ color: isFav ? undefined : "var(--text-tertiary)" }} />
              </button>
            </div>
            {listing.location && (
              <p className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                <MapPin className="w-4 h-4 shrink-0" style={{ color: "var(--primary-600)" }} />
                {listing.location}
              </p>
            )}
            {/* Thông số kỹ thuật */}
            {(() => {
              const DIR: Record<string, string> = lang === "en"
                ? { North: "North", South: "South", East: "East", West: "West", NorthEast: "North-East", NorthWest: "North-West", SouthEast: "South-East", SouthWest: "South-West" }
                : { North: "Bắc", South: "Nam", East: "Đông", West: "Tây", NorthEast: "Đông Bắc", NorthWest: "Tây Bắc", SouthEast: "Đông Nam", SouthWest: "Tây Nam" };
              const LEGAL: Record<string, string> = lang === "en"
                ? { Contract: "Sale contract", PinkBook: "Pink book", RedBook: "Red book", Handover: "Handed over", Waiting: "Title pending", Available: "Updating" }
                : { Contract: "HĐMB", PinkBook: "Sổ Hồng", RedBook: "Sổ Đỏ", Handover: "Bàn giao", Waiting: "Chờ sổ", Available: "Đang cập nhật" };
               const items = [
                 { label: tt(lang, "Diện tích", "Land area"), value: listing.area ? listing.area + " m²" : "" },
                 { label: tt(lang, "DT xây dựng", "Built-up area"), value: listing.builtArea ? listing.builtArea + " m²" : "" },
                 { label: tt(lang, "Mặt tiền", "Frontage"), value: attr.frontage ? attr.frontage + "m" : "" },
                 { label: tt(lang, "Lộ giới", "Road width"), value: attr.roadWidth ? attr.roadWidth + "m" : "" },
                 { label: tt(lang, "Hướng", "Direction"), value: attr.direction ? (DIR[attr.direction] || attr.direction) : "" },
                 { label: tt(lang, "Pháp lý", "Legal status"), value: attr.legalStatus ? (LEGAL[attr.legalStatus] || attr.legalStatus) : "" },
               ].filter((item) => item.value);
               return items.length > 0 ? (
                 <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3">
                   {items.map((a) => (
                     <div key={a.label} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                       <div className="text-[12px] uppercase font-semibold mb-1" style={{ color: "var(--text-tertiary)" }}>{a.label}</div>
                       <div className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>{a.value}</div>
                     </div>
                   ))}
                 </div>
               ) : null;
            })()}
            {/* Description */}
            {(listing.description || attr.description) && (
              <div className="p-4 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tt(lang, "Thông Tin Chi Tiết", "Property Details")}</h3>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                  {listing.description || attr.description}
                </p>
              </div>
            )}
            {(listing.coordinates?.lat || listing.location) && (
              <div>
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)", height: "340px" }}>
                  <ListingMap lat={listing.coordinates?.lat} lng={listing.coordinates?.lng} title={listing.title} location={listing.location} projectCode={listing.projectCode} />
                </div>
                {listing.location && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}><MapPin className="w-3 h-3" />{listing.location}</p>}
              </div>
            )}
          </div>
        </div>
        {/* Right: Price + Contact */}
        <div className="space-y-4">
          {/* Price card */}
          <div className="p-6 rounded-2xl sticky top-20" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Giá niêm yết", "Listed price")}</div>
            <p className="text-3xl font-extrabold leading-none mb-1" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>
              {formatPrice(listing.price, lang)}
            </p>
            {listing.area && (
              <p className="text-sm mb-4" style={{ color: "var(--text-tertiary)" }}>
                ~ {formatUnitPrice(listing.price, listing.area, lang)}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setBkState({ loading: false, ok: "", err: "" }); setBookOpen(true); }}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 sm:text-sm"
                style={{ background: "var(--sgs-primary, #1B3A5C)" }}>
                <Calendar className="h-4 w-4 shrink-0" /> <span className="truncate">{tt(lang, "Đặt lịch", "Book viewing")}</span>
              </button>
              <a href="tel:+84971132378"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-bold transition-transform hover:-translate-y-0.5 sm:text-sm"
                style={{ borderColor: "var(--sgs-primary, #1B3A5C)", color: "var(--sgs-primary, #1B3A5C)", background: "transparent" }}>
                <Phone className="h-4 w-4 shrink-0" /> <span className="truncate">{tt(lang, "Gọi điện", "Call")}</span>
              </a>
            </div>
            <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
              {tt(lang, "SGS LAND — Đại lý uỷ quyền chính thức", "SGS LAND — Officially authorised agent")}
            </p>
          </div>
          <LoanCalculator price={listing.price} />
        </div>
      </div>
      {bookOpen && (
        <div onClick={() => setBookOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,30,51,.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl"
            style={{ background: "var(--bg-surface, #fff)", border: "1px solid var(--border-default)", maxHeight: "92vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
              <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{tt(lang, "Đặt Lịch Xem Nhà", "Book a Viewing")}</h3>
              <button type="button" onClick={() => setBookOpen(false)} aria-label={tt(lang, "Đóng", "Close")}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>✕</button>
            </div>
            <div className="px-5 pt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>{listing.title}</div>
            {bkState.ok ? (
              <div className="px-5 py-8 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-bold mb-1" style={{ color: "var(--text-primary)" }}>{bkState.ok}</p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Chúng tôi sẽ gọi số", "We will call")} {bk.phone} {tt(lang, "để xác nhận.", "to confirm.")}</p>
                <button type="button" onClick={() => setBookOpen(false)} className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "var(--sgs-primary, #1B3A5C)" }}>{tt(lang, "Đóng", "Close")}</button>
              </div>
            ) : (
              <form onSubmit={submitBooking} className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Ngày xem *", "Viewing date *")}</label>
                    <input type="date" required value={bk.date} min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setBk({ ...bk, date: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Giờ", "Time")}</label>
                    <TimePicker value={bk.time} onChange={(time) => setBk({ ...bk, time })} lang={lang} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Họ và tên *", "Full name *")}</label>
                  <input type="text" required value={bk.name} onChange={(e) => setBk({ ...bk, name: e.target.value })}
                    placeholder={tt(lang, "Nguyễn Văn A", "John Smith")} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Số điện thoại *", "Phone number *")}</label>
                  <input type="tel" required value={bk.phone} onChange={(e) => setBk({ ...bk, phone: e.target.value })}
                    placeholder="09xx xxx xxx" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Ghi chú", "Notes")}</label>
                  <textarea rows={2} value={bk.notes} onChange={(e) => setBk({ ...bk, notes: e.target.value })}
                    placeholder={tt(lang, "Yêu cầu thêm (nếu có)", "Any additional request")} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                </div>
                {bkState.err && <p className="text-xs" style={{ color: "#dc2626" }}>{bkState.err}</p>}
                <button type="submit" disabled={bkState.loading}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "var(--sgs-primary, #1B3A5C)", opacity: bkState.loading ? 0.6 : 1 }}>
                  {bkState.loading ? tt(lang, "Đang gửi...", "Sending...") : tt(lang, "Xác nhận đặt lịch", "Confirm booking")}
                </button>
                <p className="text-[12px] text-center" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "SGS LAND sẽ gọi xác nhận trước khi tới xem.", "SGS LAND will call to confirm before the visit.")}</p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Similar listings */}
      {similarListings.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>{tt(lang, "Bất Động Sản Phù Hợp Khác", "Other Matching Properties")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {similarListings.slice(0, 3).map((l) => {
              const slug = `${(l.title || "bds").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)}-${l.id}`;
              const img = l.images && l.images[0];
              const rent = String(l.transaction).toUpperCase() === "RENT";
              const ppm = l.area ? (l.price / l.area / 1e6).toFixed(1) + tt(lang, " Triệu/m²", "M/m²") : "";
              return (
                <Link key={l.id} href={lang === "en" ? `/en/bds/${slug}` : `/bds/${slug}`}
                  className="group block rounded-3xl overflow-hidden hover:shadow-token-lg transition-all hover:-translate-y-1"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                  <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                    {img ? (
                      <img src={img} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🏢</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                      <div className="flex gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg text-[12px] font-bold text-white shadow-sm backdrop-blur-sm"
                          style={{ background: rent ? "rgba(37,99,235,0.9)" : "rgba(11,107,84,0.92)" }}>{rent ? tt(lang, "CHO THUÊ", "FOR RENT") : tt(lang, "BÁN", "FOR SALE")}</span>
                        {l.isVerified && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] font-bold text-white shadow-sm backdrop-blur-sm"
                            style={{ background: "rgba(5,150,105,0.95)" }}><CheckCircle className="w-3.5 h-3.5" /> {tt(lang, "ĐÃ XÁC THỰC", "VERIFIED")}</span>
                        )}
                      </div>
                      {(l.viewCount || 0) > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] font-bold text-white shadow-sm backdrop-blur-sm"
                          style={{ background: "rgba(0,0,0,0.6)" }}><Eye className="w-3.5 h-3.5" /> {l.viewCount}</span>
                      )}
                    </div>
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-black/25 backdrop-blur-sm">
                      <Heart className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2 leading-snug" style={{ color: "var(--text-primary)" }}>{l.title}</h3>
                    <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{l.location}</span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold text-lg leading-none" style={{ color: "var(--primary-600)" }}>{formatPrice(l.price, lang)}</p>
                        {ppm && <p className="text-[12px] font-medium mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>{ppm}</p>}
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
                        {l.area ? <span>{l.area}m²</span> : null}
                        {l.bedrooms ? <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{l.bedrooms}PN</span> : null}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}