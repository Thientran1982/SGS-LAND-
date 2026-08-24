// @ts-nocheck
"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { slugifyListingTitle } from "@/lib/listingSlug";

function formatPrice(price: number): string {
  return price >= 1e9 ? `${(price / 1e9).toFixed(2)} tỷ` : `${Math.round(price / 1e6)} triệu`;
}
function priceLabel(price: number): string {
  if (!price) return "--";
  return price >= 1e9 ? `${(price / 1e9).toFixed(1).replace(".", ",")} tỷ` : `${Math.round(price / 1e6)} tr`;
}

export function MarketplaceMap({ listings, height = "620px" }: { listings: any[]; height?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default || (await import("leaflet"));
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, {
        scrollWheelZoom: true,
        wheelDebounceTime: 80,
        wheelPxPerZoomLevel: 60,
      }).setView([10.85, 106.75], 10);
      mapRef.current = map;
      L.tileLayer("/api/map-tiles/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const valid = (c) => c && c.lat && c.lng && !(+c.lat === 0 && +c.lng === 0);
      // Derive a coordinate per project from the listings that do have one,
      // so listings missing coordinates still land on the map.
      const projCoord = {};
      (listings || []).forEach((l) => {
        if (valid(l.coordinates) && l.projectCode && !projCoord[l.projectCode]) {
          projCoord[l.projectCode] = { lat: +l.coordinates.lat, lng: +l.coordinates.lng };
        }
      });
      // Approximate coordinates by place name, for listings with no lat/lng.
      const GAZ = [
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
      const geoFromText = (txt) => {
        const t = String(txt || "").toLowerCase();
        for (let i = 0; i < GAZ.length; i++) {
          if (t.indexOf(GAZ[i][0]) >= 0) return { lat: GAZ[i][1], lng: GAZ[i][2] };
        }
        return null;
      };
      const groups = {};
      (listings || []).forEach((l) => {
        const exact = valid(l.coordinates);
        const c = exact ? l.coordinates : (projCoord[l.projectCode] || geoFromText((l.location || "") + " " + (l.title || "")));
        if (valid(c)) {
          const k = (+c.lat).toFixed(5) + "," + (+c.lng).toFixed(5);
          (groups[k] = groups[k] || []).push({ ...l, coordinates: { lat: +c.lat, lng: +c.lng }, _approx: !exact });
        }
      });

      const bounds = [];
      Object.keys(groups).forEach((k) => {
        const arr = groups[k];
        arr.forEach((l, idx) => {
          let lat = +l.coordinates.lat;
          let lng = +l.coordinates.lng;
          if (arr.length > 1) {
            const ring = Math.floor(idx / 8);
            const ang = (2 * Math.PI * (idx % 8)) / Math.min(arr.length, 8);
            const R = 0.0019 + ring * 0.0015;
            lat += R * Math.sin(ang);
            lng += (R * Math.cos(ang)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
          }
          const icon = L.divIcon({
            className: "",
            html:
              '<div style="background:#1B3A5C;color:#fff;font-weight:700;font-size:12px;line-height:1;padding:5px 9px;border-radius:999px;white-space:nowrap;border:2px solid #C8963E;box-shadow:0 2px 6px rgba(0,0,0,.35)">' +
              priceLabel(l.price) +
              "</div>",
            iconSize: [64, 24],
            iconAnchor: [32, 12],
          });
          const m = L.marker([lat, lng], { icon, riseOnHover: true }).addTo(map);
          const slug = `${slugifyListingTitle(l.title)}-${l.id}`;
          const img = (l.images && l.images[0]) || "";
          m.bindPopup(
            `<a href="/bds/${slug}" style="display:block;text-decoration:none;color:inherit;width:232px">` +
              (img ? `<img src="${img}" alt="" style="width:100%;height:120px;object-fit:cover;display:block;border-radius:6px"/>` : "") +
              `<div style="padding:8px 2px 2px">` +
              `<div style="font-weight:700;font-size: 14px;line-height:1.3;margin-bottom:4px;color:#152232">${l.title || ""}</div>` +
              `<div style="color:#1B3A5C;font-weight:800;font-size: 16px">${formatPrice(l.price)}</div>` +
              `<div style="color:#64748b;font-size: 12px;margin-top:2px">${l.location || ""}</div>` +
              (l._approx ? `<div style="color:#94a3b8;font-size: 12px;margin-top:3px">Vị trí tương đối theo khu vực</div>` : "") +
              `<div style="margin-top:8px;color:#C8963E;font-weight:700;font-size:12px">Xem chi tiết →</div>` +
              `</div></a>`,
            { maxWidth: 252, minWidth: 232 }
          );
          bounds.push([lat, lng]);
        });
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
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
      style={{ height, border: "1px solid var(--border-default)", zIndex: 0 }}
    />
  );
}
