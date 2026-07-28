// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo } from "react";
import { trackPropertyView } from "@/lib/tracking";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MapPin, Bed, Bath, Square, Phone, Share2, Heart, ArrowLeft, CheckCircle, Calendar, Landmark } from "lucide-react";
interface Listing {
  id: string;
  code?: string;
  title: string;
  price: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  location?: string;
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
    <div className="w-full h-full flex items-center justify-center text-sm" style={{ minHeight: "320px", color: "var(--text-tertiary)" }}>Đang tải bản đồ…</div>
  ),
});

function formatPrice(price: number): string {
  return price >= 1e9
    ? `${(price / 1e9).toFixed(2)} tỷ VNĐ`
    : `${Math.round(price / 1e6).toLocaleString()} triệu VNĐ`;
}
function formatUnitPrice(price: number, area?: number): string {
  if (!area) return "";
  const unitPrice = price / area / 1e6;
  return `${unitPrice.toFixed(1)} triệu/m²`;
}
function LoanCalculator({ price }: { price: number }) {
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
  const vnd = (x: number) => Math.round(x).toLocaleString("vi-VN") + " đ";
  const inp = { background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
  return (
    <div className="p-6 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
      <div className="flex mb-5 -mx-6 -mt-6" style={{ borderBottom: "1px solid var(--border-default)" }}>
        <button onClick={() => setTab("loan")} className="flex-1 py-3.5 text-xs font-bold uppercase tracking-wide transition-colors" style={{ background: tab === "loan" ? "var(--sgs-primary, #1B3A5C)" : "transparent", color: tab === "loan" ? "#fff" : "var(--text-secondary)" }}>Vay Ngân Hàng</button>
        <button onClick={() => setTab("roi")} className="flex-1 py-3.5 text-xs font-bold uppercase tracking-wide transition-colors" style={{ background: tab === "roi" ? "var(--sgs-primary, #1B3A5C)" : "transparent", color: tab === "roi" ? "#fff" : "var(--text-secondary)" }}>Hiệu Quả Đầu Tư</button>
      </div>
      {tab === "loan" ? (
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}><span>TỶ LỆ VAY</span><span>{ratio}%</span></div>
          <input type="range" min={0} max={90} step={5} value={ratio} onChange={(e) => setRatio(+e.target.value)} className="w-full" style={{ accentColor: "var(--sgs-primary, #1B3A5C)" }} />
          <div className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>Vốn tự có: {vnd(own)}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>THỜI HẠN (NĂM)</div>
            <input type="number" min={1} max={35} value={years} onChange={(e) => setYears(Math.max(1, +e.target.value || 1))} className="w-full px-3 py-2 rounded-lg text-sm" style={inp} /></div>
          <div><div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>LÃI SUẤT (%)</div>
            <input type="number" min={0} max={20} step={0.1} value={rate} onChange={(e) => setRate(Math.max(0, +e.target.value || 0))} className="w-full px-3 py-2 rounded-lg text-sm" style={inp} /></div>
        </div>
        <div className="p-4 rounded-xl" style={{ background: "var(--primary-subtle, rgba(27,58,92,0.06))" }}>
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>TRẢ HÀNG THÁNG (ƯỚC TÍNH)</div>
          <div className="text-2xl font-extrabold" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>{vnd(monthly)}</div>
          <div className="flex justify-between text-sm mt-3 pt-3" style={{ borderTop: "1px solid var(--border-default)" }}><span style={{ color: "var(--text-tertiary)" }}>Tổng gốc vay</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{vnd(principal)}</span></div>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>* Ước tính theo dư nợ giảm dần, chỉ mang tính tham khảo.</p>
      </div>
      ) : (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="text-[11px] uppercase font-semibold" style={{ color: "var(--text-tertiary)" }}>Lợi suất thuê</div>
            <div className="text-lg font-extrabold" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>~4,8%/năm</div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="text-[11px] uppercase font-semibold" style={{ color: "var(--text-tertiary)" }}>Giá thuê ước tính</div>
            <div className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>{vnd(monthlyRent)}</div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}><span>THỜI GIAN NẮM GIỮ</span><span>{hold} năm</span></div>
          <input type="range" min={1} max={15} value={hold} onChange={(e) => setHold(+e.target.value)} className="w-full" style={{ accentColor: "var(--sgs-primary, #1B3A5C)" }} />
        </div>
        <div className="p-4 rounded-xl" style={{ background: "var(--primary-subtle, rgba(27,58,92,0.06))" }}>
          <div className="flex justify-between text-sm py-1"><span style={{ color: "var(--text-tertiary)" }}>Thu nhập cho thuê ({hold} năm)</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{vnd(rentIncome)}</span></div>
          <div className="flex justify-between text-sm py-1"><span style={{ color: "var(--text-tertiary)" }}>Tăng giá vốn (~7%/năm)</span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{vnd(appreciation)}</span></div>
          <div className="flex justify-between items-end mt-2 pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>Tổng lợi nhuận</span>
            <div className="text-right"><div className="text-xl font-extrabold" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>{vnd(totalProfit)}</div><div className="text-xs font-bold" style={{ color: "var(--color-success, #0B6B54)" }}>ROI {roi.toFixed(1)}%</div></div>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>* Giả định thuê ~4,8%/năm & tăng giá ~7%/năm (trung bình thị trường). Chỉ tham khảo.</p>
      </div>
      )}
    </div>
  );
}

export function ListingDetailPage({ listing, similarListings }: Props) {
  const [currentImg, setCurrentImg] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    trackPropertyView(listing.code || listing.id, listing.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const images = listing.images?.length ? listing.images : ["/images/placeholder.jpg"];
  const attr = listing.attributes ?? {};
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/" className="hover:opacity-80">Trang chủ</Link>
        <span>/</span>
        <Link href="/marketplace" className="hover:opacity-80">Tìm kiếm</Link>
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
                title={copied ? "Đã copy!" : "Chia sẻ"}>
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
                <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                  {listing.title}
                </h1>
              </div>
              <button onClick={() => setIsFav((v) => !v)}
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
              const DIR = { North: "Bắc", South: "Nam", East: "Đông", West: "Tây", NorthEast: "Đông Bắc", NorthWest: "Tây Bắc", SouthEast: "Đông Nam", SouthWest: "Tây Nam" };
              const LEGAL = { Contract: "HĐMB", PinkBook: "Sổ Hồng", RedBook: "Sổ Đỏ", Handover: "Bàn giao", Waiting: "Chờ sổ", Available: "Đang cập nhật" };
              const items = [
                { label: "Diện tích", value: listing.area ? listing.area + " m²" : "--" },
                { label: "DT xây dựng", value: listing.builtArea ? listing.builtArea + " m²" : "--" },
                { label: "Mặt tiền", value: attr.frontage ? attr.frontage + "m" : "--" },
                { label: "Lộ giới", value: attr.roadWidth ? attr.roadWidth + "m" : "--" },
                { label: "Hướng", value: attr.direction ? (DIR[attr.direction] || attr.direction) : "--" },
                { label: "Pháp lý", value: attr.legalStatus ? (LEGAL[attr.legalStatus] || attr.legalStatus) : "--" },
              ];
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {items.map((a, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                      <div className="text-[11px] uppercase font-semibold mb-1" style={{ color: "var(--text-tertiary)" }}>{a.label}</div>
                      <div className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>{a.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* Description */}
            {listing.description && (
              <div className="p-4 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Thông Tin Chi Tiết</h3>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                  {listing.description}
                </p>
              </div>
            )}
            {listing.coordinates?.lat && (
              <div>
                <h3 className="font-semibold mb-3 mt-2" style={{ color: "var(--text-primary)" }}>Vị trí trên bản đồ</h3>
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-default)", height: "340px" }}>
                  <ListingMap lat={listing.coordinates.lat} lng={listing.coordinates.lng} title={listing.title} />
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
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-tertiary)" }}>Giá niêm yết</div>
            <p className="text-3xl font-extrabold leading-none mb-1" style={{ color: "var(--sgs-primary, #1B3A5C)" }}>
              {formatPrice(listing.price)}
            </p>
            {listing.area && (
              <p className="text-sm mb-4" style={{ color: "var(--text-tertiary)" }}>
                ~ {formatUnitPrice(listing.price, listing.area)}
              </p>
            )}
            {/* Legal status */}
            {(listing.legalStatus || attr.legalStatus) && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-xl"
                style={{ background: "var(--primary-subtle)" }}>
                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {listing.legalStatus || attr.legalStatus}
                </span>
              </div>
            )}
            <div className="space-y-3">
              <Link href="/contact"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--sgs-primary, #1B3A5C)" }}>
                <Calendar className="w-4 h-4" /> Đặt Lịch Xem Nhà
              </Link>
              <a href="tel:+84971132378"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--sgs-accent, #C8963E)", color: "var(--sgs-primary-deep, #0A1E33)" }}>
                <Phone className="w-4 h-4" /> Gọi Điện Ngay
              </a>
            </div>
            <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
              SGS LAND — Đại lý uỷ quyền chính thức
            </p>
          </div>
          <LoanCalculator price={listing.price} />
        </div>
      </div>
      {/* Similar listings */}
      {similarListings.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Bất Động Sản Phù Hợp Khác</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {similarListings.slice(0, 3).map((l) => {
              const slug = `${(l.title || "bds").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)}-${l.id}`;
              const img = l.images?.[0];
              const rent = String(l.transaction).toUpperCase() === "RENT";
              return (
                <Link key={l.id} href={`/bds/${slug}`}
                  className="group block rounded-2xl overflow-hidden hover:shadow-token-md transition-all hover:-translate-y-1"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                  <div className="relative aspect-[4/3]" style={{ background: "var(--bg-elevated)" }}>
                    {img ? <img src={img} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🏢</div>}
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white backdrop-blur-sm"
                      style={{ background: rent ? "rgba(37,99,235,0.9)" : "rgba(11,107,84,0.92)" }}>{rent ? "CHO THUÊ" : "BÁN"}</span>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-sgs-primary transition-colors" style={{ color: "var(--text-primary)" }}>{l.title}</p>
                    <p className="text-xs mb-2 truncate flex items-center gap-1" style={{ color: "var(--text-secondary)" }}><MapPin className="w-3 h-3" />{l.location}</p>
                    <div className="flex items-end justify-between">
                      <p className="font-extrabold text-base" style={{ color: "var(--primary-600)" }}>{formatPrice(l.price)}</p>
                      {l.area ? <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{l.area}m²</span> : null}
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