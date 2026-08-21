// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation } from "lucide-react";

type Coordinates = { lat: number; lng: number };

interface ListingMapProps {
  lat?: number;
  lng?: number;
  title?: string;
  location?: string;
}

const HCMC_CENTER: Coordinates = { lat: 10.7769, lng: 106.7009 };

function validCoordinates(lat?: number, lng?: number): lat is number {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) > 1 && Math.abs(lng) > 1 &&
    lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110;
}

function mapsUrl(coords?: Coordinates, location?: string) {
  const destination = coords
    ? `${coords.lat},${coords.lng}`
    : (location || "");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char] || char));
}

export default function ListingMap({ lat, lng, title, location }: ListingMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [resolved, setResolved] = useState<Coordinates | null>(
    validCoordinates(lat, lng) ? { lat, lng } : null,
  );
  const [geocoding, setGeocoding] = useState(!validCoordinates(lat, lng) && Boolean(location));
  const exact = validCoordinates(lat, lng);

  useEffect(() => {
    let cancelled = false;
    if (exact || !location) {
      setResolved(exact ? { lat: lat!, lng: lng! } : null);
      setGeocoding(false);
      return;
    }

    setGeocoding(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(location)}`, {
      headers: { "Accept-Language": "vi,en" },
    })
      .then((response) => response.ok ? response.json() : [])
      .then((results) => {
        if (cancelled) return;
        const first = results?.[0];
        setResolved(first ? { lat: Number(first.lat), lng: Number(first.lon) } : null);
      })
      .catch(() => { if (!cancelled) setResolved(null); })
      .finally(() => { if (!cancelled) setGeocoding(false); });

    return () => { cancelled = true; };
  }, [lat, lng, location, exact]);

  useEffect(() => {
    if (!ref.current || mapRef.current || !resolved) return;

    const map = L.map(ref.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([resolved.lat, resolved.lng], exact ? 16 : 14);
    mapRef.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap © CARTO",
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    const marker = L.marker([resolved.lat, resolved.lng], {
      icon: L.divIcon({
        className: "sgs-listing-detail-marker",
        html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1B3A5C;border:3px solid #fff;box-shadow:0 4px 14px rgba(15,39,64,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-size:16px">⌂</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      }),
    }).addTo(map);

    const popupTitle = escapeHtml(title || "Vị trí bất động sản");
    const popupLocation = escapeHtml(location || "");
    marker.bindPopup(
      `<strong>${popupTitle}</strong>${popupLocation ? `<br><span style="font-size:12px;color:#5C6B7A">${popupLocation}</span>` : ""}`,
      { closeButton: true, autoPan: true },
    ).openPopup();

    const timer = window.setTimeout(() => map.invalidateSize(), 250);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, [resolved?.lat, resolved?.lng, title, location, exact]);

  if (geocoding) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
        <MapPin className="h-4 w-4 animate-pulse" />
        Đang xác định vị trí trên bản đồ…
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center" style={{ color: "var(--text-tertiary)" }}>
        <MapPin className="h-7 w-7" />
        <p className="text-sm">Chưa có tọa độ chính xác cho sản phẩm này.</p>
        {location && (
          <a href={mapsUrl(undefined, location)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: "var(--sgs-primary, #1B3A5C)" }}>
            <Navigation className="h-3.5 w-3.5" /> Mở chỉ đường theo địa chỉ
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[320px] w-full">
      <div ref={ref} className="h-full w-full" />
      <div className="absolute left-3 top-3 z-[500] max-w-[min(calc(100%-24px),360px)] rounded-xl px-3 py-2 shadow-md backdrop-blur-sm" style={{ background: "rgba(255,255,255,.94)", border: "1px solid var(--border-default, rgba(21,49,70,.14))" }}>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sgs-primary, #1B3A5C)" }} />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold" style={{ color: "var(--text-primary, #16202B)" }}>{title || "Vị trí sản phẩm"}</div>
            {location && <div className="truncate text-[11px]" style={{ color: "var(--text-secondary, #4C6471)" }}>{location}</div>}
            {!exact && <div className="text-[10px]" style={{ color: "var(--text-tertiary, #5C6B7A)" }}>Vị trí tham khảo theo địa chỉ</div>}
          </div>
        </div>
      </div>
      <a href={mapsUrl(resolved, location)} target="_blank" rel="noreferrer" className="absolute bottom-3 left-3 z-[500] inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5" style={{ background: "var(--sgs-primary, #1B3A5C)" }}>
        <Navigation className="h-3.5 w-3.5" />
        Chỉ đường đến sản phẩm
      </a>
    </div>
  );
}