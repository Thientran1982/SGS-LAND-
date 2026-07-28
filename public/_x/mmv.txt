// @ts-nocheck
"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

function formatPrice(price: number): string {
  return price >= 1e9 ? `${(price / 1e9).toFixed(2)} tỷ` : `${Math.round(price / 1e6)} triệu`;
}

export function MarketplaceMap({ listings }: { listings: any[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default || (await import("leaflet"));
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, { scrollWheelZoom: false }).setView([10.85, 106.75], 10);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">📍</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      const bounds: any[] = [];
      (listings || []).forEach((l) => {
        const c = l.coordinates;
        if (c && c.lat && c.lng && !(c.lat === 0 && c.lng === 0)) {
          const m = L.marker([c.lat, c.lng], { icon }).addTo(map);
          m.bindPopup(
            `<b>${l.title || ""}</b><br/><span style="color:#0B6B54;font-weight:700">${formatPrice(l.price)}</span><br/><span style="color:#64748b">${l.location || ""}</span>`
          );
          bounds.push([c.lat, c.lng]);
        }
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      setTimeout(() => map.invalidateSize(), 200);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [listings]);

  return (
    <div
      ref={ref}
      className="w-full rounded-2xl overflow-hidden"
      style={{ height: "620px", border: "1px solid var(--border-default)", zIndex: 0 }}
    />
  );
}
