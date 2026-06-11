// @ts-nocheck
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MapPin, Bed, Bath, Square, Phone, Share2, Heart, ArrowLeft, CheckCircle } from "lucide-react";

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

export function ListingDetailPage({ listing, similarListings }: Props) {
  const [currentImg, setCurrentImg] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isFav, setIsFav] = useState(false);

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

            {/* Attributes */}
            <div className="flex flex-wrap gap-4 mb-6">
              {listing.area && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <Square className="w-4 h-4" />
                  <span>{listing.area}m²</span>
                </div>
              )}
              {listing.bedrooms && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <Bed className="w-4 h-4" />
                  <span>{listing.bedrooms} phòng ngủ</span>
                </div>
              )}
              {listing.bathrooms && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <Bath className="w-4 h-4" />
                  <span>{listing.bathrooms} phòng tắm</span>
                </div>
              )}
              {attr.floor && (
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Tầng {attr.floor}</span>
              )}
              {attr.view && (
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>View {attr.view}</span>
              )}
            </div>

            {/* Description */}
            {listing.description && (
              <div className="p-4 rounded-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Mô tả</h3>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                  {listing.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Price + Contact */}
        <div className="space-y-4">
          {/* Price card */}
          <div className="p-6 rounded-2xl sticky top-20" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <p className="text-3xl font-bold mb-1" style={{ color: "var(--primary-600)" }}>
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
              <a href="tel:+84971132378"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--primary-600)" }}>
                <Phone className="w-4 h-4" />
                Gọi tư vấn: 0971 132 378
              </a>
              <Link href="/contact"
                className="flex items-center justify-center w-full py-3.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ border: "1.5px solid var(--primary-600)", color: "var(--primary-600)" }}>
                Để lại thông tin
              </Link>
            </div>

            <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
              SGS LAND — Đại lý uỷ quyền chính thức
            </p>
          </div>
        </div>
      </div>

      {/* Similar listings */}
      {similarListings.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>BĐS tương tự</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {similarListings.slice(0, 3).map((l) => {
              const slug = `${l.title.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}-${l.code ?? l.id}`;
              return (
                <Link key={l.id} href={`/bds/${slug}`}
                  className="group p-4 rounded-2xl hover:shadow-token-md transition-all"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                  <p className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-sgs-primary transition-colors"
                    style={{ color: "var(--text-primary)" }}>{l.title}</p>
                  <p className="text-xs mb-2 truncate" style={{ color: "var(--text-secondary)" }}>{l.location}</p>
                  <p className="font-bold text-base" style={{ color: "var(--primary-600)" }}>{formatPrice(l.price)}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
