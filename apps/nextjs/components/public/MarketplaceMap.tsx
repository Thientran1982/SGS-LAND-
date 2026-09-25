// @ts-nocheck
"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { slugifyListingTitle } from "@/lib/listingSlug";
import { useLang } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";
import { formatPriceLang } from "@/utils/priceFormat";

/** Short pin label: 8,5 tỷ / 850 tr (full price lives in the popup). */
function priceLabel(price: number, lang: "vi" | "en"): string {
  if (!price) return "--";
  return price >= 1e9
    ? `${(price / 1e9).toFixed(1).replace(".", lang === "en" ? "." : ",")}${lang === "en" ? "B" : " tỷ"}`
    : `${Math.round(price / 1e6)}${lang === "en" ? "M" : " tr"}`;
}

/** Listing text is user-authored: never interpolate it into popup HTML unescaped. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Approximate coordinates by place name, for listings with no lat/lng.
const GAZ: [string, number, number][] = [
  ["vinhomes grand park", 10.8430, 106.8430],
  ["vinhomes central park", 10.7952, 106.7218],
  ["tòa park", 10.7952, 106.7218],
  ["thạnh mỹ lợi", 10.7710, 106.7560],
  ["trương văn bang", 10.7710, 106.7560],
  ["thủ đức", 10.8500, 106.7700],
  ["đakao", 10.7905, 106.6955],
  ["nguyễn đình chiểu", 10.7905, 106.6955],
  ["bến nghé", 10.7780, 106.7020],
  ["hai bà trưng", 10.7780, 106.7020],
  ["cô giang", 10.7620, 106.6950],
  ["quận 1", 10.7760, 106.7000],
  ["quận 7", 10.7340, 106.7220],
  ["bình thạnh", 10.8100, 106.7100],
  ["phú nhuận", 10.7990, 106.6800],
  ["bình chánh", 10.6870, 106.5950],
  ["cần giờ", 10.4110, 106.9540],
  ["long thành", 10.7930, 106.9460],
  ["nhơn trạch", 10.6960, 106.8930],
  ["biên hòa", 10.9450, 106.8240],
  ["đồng nai", 10.9000, 106.8500],
  ["bình dương", 10.9800, 106.6500],
  ["long an", 10.6000, 106.4000],
  ["tp.hcm", 10.7769, 106.7009],
  ["tphcm", 10.7769, 106.7009],
  ["hcm", 10.7769, 106.7009],
];

// UX audit U9: pins closer than this many screen pixels are merged into one
// cluster bubble; clicking a cluster zooms into its members.
const CLUSTER_CELL_PX = 64;

export function MarketplaceMap({ listings, height = "620px" }: { listings: any[]; height?: string }) {
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      const mod = await import("leaflet");
      const L = mod.default || mod;
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, {
        scrollWheelZoom: true,
        wheelDebounceTime: 80,
        wheelPxPerZoomLevel: 60,
      }).setView([10.85, 106.75], 10);
      mapRef.current = map;
      // Keep tiles same-origin. A direct OSM/CARTO fallback is intentionally
      // avoided because the Replit Preview iframe can receive policy-block
      // placeholder images from third-party tile hosts.
      const tiles = L.tileLayer("/api/map-tiles/{z}/{x}/{y}.png?v=6", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      tiles.once("load", () => { if (!cancelled) setReady(true); });
      // Never leave the skeleton up forever if tiles are slow or blocked.
      setTimeout(() => { if (!cancelled) setReady(true); }, 4000);

      const valid = (c) => c && c.lat && c.lng && !(+c.lat === 0 && +c.lng === 0);
      const projCoord = {};
      (listings || []).forEach((l) => {
        if (valid(l.coordinates) && l.projectCode && !projCoord[l.projectCode]) {
          projCoord[l.projectCode] = { lat: +l.coordinates.lat, lng: +l.coordinates.lng };
        }
      });
      const geoFromText = (txt) => {
        const t = String(txt || "").toLowerCase();
        for (let i = 0; i < GAZ.length; i++) {
          if (t.indexOf(GAZ[i][0]) >= 0) return { lat: GAZ[i][1], lng: GAZ[i][2] };
        }
        return null;
      };

      const points = [];
      (listings || []).forEach((l) => {
        const exact = valid(l.coordinates);
        const c = exact ? l.coordinates : (projCoord[l.projectCode] || geoFromText((l.location || "") + " " + (l.title || "")));
        if (valid(c)) points.push({ ...l, _lat: +c.lat, _lng: +c.lng, _approx: !exact });
      });

      const popupHtml = (l) => {
        const slug = `${slugifyListingTitle(l.title)}-${l.id}`;
        const img = (l.images && l.images[0]) || "";
        return (
          `<a href="${lang === "en" ? "/en" : ""}/bds/${esc(slug)}" style="display:block;text-decoration:none;color:inherit;width:232px">` +
          (img ? `<img src="${esc(img)}" alt="" style="width:100%;height:120px;object-fit:cover;display:block;border-radius:6px"/>` : "") +
          `<div style="padding:8px 2px 2px">` +
          `<div style="font-weight:700;font-size:14px;line-height:1.3;margin-bottom:4px;color:#152232">${esc(l.title)}</div>` +
          `<div style="color:#1B3A5C;font-weight:800;font-size:16px">${esc(formatPriceLang(Number(l.price) || 0, lang))}</div>` +
          `<div style="color:#64748b;font-size:12px;margin-top:2px">${esc(l.location)}</div>` +
          (l._approx ? `<div style="color:#64748b;font-size:12px;margin-top:3px">${esc(tt(lang, "Vị trí tương đối theo khu vực", "Approximate area location"))}</div>` : "") +
          `<div style="margin-top:8px;color:#8C6420;font-weight:700;font-size:12px">${esc(tt(lang, "Xem chi tiết →", "View details →"))}</div>` +
          `</div></a>`
        );
      };

      const layer = L.layerGroup().addTo(map);
      const render = () => {
        layer.clearLayers();
        const cells = new Map();
        points.forEach((p) => {
          const pt = map.latLngToLayerPoint([p._lat, p._lng]);
          const key = Math.floor(pt.x / CLUSTER_CELL_PX) + ":" + Math.floor(pt.y / CLUSTER_CELL_PX);
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(p);
        });
        cells.forEach((group) => {
          if (group.length === 1 || map.getZoom() >= 17) {
            group.forEach((p, idx) => {
              // Same building at max zoom: fan pins out slightly so each stays clickable.
              let lat = p._lat, lng = p._lng;
              if (group.length > 1) {
                const ang = (2 * Math.PI * idx) / group.length;
                lat += 0.00025 * Math.sin(ang);
                lng += 0.00025 * Math.cos(ang);
              }
              const icon = L.divIcon({
                className: "",
                html: '<div style="background:#1B3A5C;color:#fff;font-weight:700;font-size:12px;line-height:1;padding:5px 9px;border-radius:999px;white-space:nowrap;border:2px solid #C8963E;box-shadow:0 2px 6px rgba(0,0,0,.35)">' + esc(priceLabel(p.price, lang)) + "</div>",
                iconSize: [64, 24],
                iconAnchor: [32, 12],
              });
              L.marker([lat, lng], { icon, riseOnHover: true, keyboard: true, title: String(p.title || "") })
                .bindPopup(popupHtml(p), { maxWidth: 252, minWidth: 232 })
                .addTo(layer);
            });
            return;
          }
          const lat = group.reduce((s, p) => s + p._lat, 0) / group.length;
          const lng = group.reduce((s, p) => s + p._lng, 0) / group.length;
          const minPrice = Math.min(...group.map((p) => Number(p.price) || Infinity));
          const label = tt(lang, `${group.length} tin`, `${group.length} listings`) + (Number.isFinite(minPrice) ? ` · ${tt(lang, "từ", "from")} ${priceLabel(minPrice, lang)}` : "");
          const icon = L.divIcon({
            className: "",
            html: '<div style="background:#C8963E;color:#0F2740;font-weight:800;font-size:12px;line-height:1;padding:7px 11px;border-radius:999px;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)">' + esc(label) + "</div>",
            iconSize: [120, 28],
            iconAnchor: [60, 14],
          });
          L.marker([lat, lng], { icon, keyboard: true, title: label })
            .on("click", () => {
              const b = L.latLngBounds(group.map((p) => [p._lat, p._lng]));
              if (b.getNorthEast().equals(b.getSouthWest())) map.setView(b.getCenter(), Math.min(18, map.getZoom() + 3));
              else map.fitBounds(b, { padding: [60, 60], maxZoom: 18 });
            })
            .addTo(layer);
        });
      };

      if (points.length > 0) {
        map.fitBounds(points.map((p) => [p._lat, p._lng]), { padding: [50, 50], maxZoom: 14 });
      }
      render();
      map.on("zoomend", render);
      setTimeout(() => { map.invalidateSize(); render(); }, 200);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [listings, lang]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ height, border: "1px solid var(--border-default)" }}>
      <div ref={ref} className="w-full h-full" style={{ zIndex: 0 }} />
      {!ready && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-pulse"
          style={{ background: "var(--bg-elevated)", color: "var(--text-tertiary)", zIndex: 500 }}
          role="status"
          aria-live="polite"
        >
          <div className="w-10 h-10 rounded-full" style={{ border: "3px solid var(--border-default)", borderTopColor: "var(--primary-600)" }} />
          <span className="text-sm font-medium">{tt(lang, "Đang tải bản đồ…", "Loading map…")}</span>
        </div>
      )}
    </div>
  );
}
