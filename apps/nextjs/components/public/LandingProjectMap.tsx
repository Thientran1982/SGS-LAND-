// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const PROJECTS = [
  { slug: "aqua-city", name: "Aqua City", price: "Từ 6 tỷ", priceVnd: 6_000_000_000, position: [10.846, 106.883] },
  { slug: "the-global-city", name: "The Global City", price: "Từ 7,8 tỷ", priceVnd: 7_800_000_000, position: [10.840, 106.748] },
  { slug: "vinhomes-can-gio", name: "Vinhomes Cần Giờ", price: "Từ 8 tỷ", priceVnd: 8_000_000_000, position: [10.410, 106.955] },
  { slug: "izumi-city", name: "Izumi City", price: "Từ 7,6 tỷ", priceVnd: 7_600_000_000, position: [10.835, 106.915] },
  { slug: "masterise-homes", name: "Grand Marina · Masteri", price: "Từ 25 tỷ", priceVnd: 25_000_000_000, position: [10.777, 106.706] },
];

export function LandingProjectMap({ active, onSelect, lang }: { active: number; onSelect: (index: number) => void; lang: "vi" | "en" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const onSelectRef = useRef(onSelect);
  const activeRef = useRef(active);
  const langRef = useRef(lang);
  onSelectRef.current = onSelect;
  activeRef.current = active;
  langRef.current = lang;

  useEffect(() => {
    let cancelled = false;
    let map: any;
    try {
      if (typeof MapLibreMap.isSupported === "function" && !MapLibreMap.isSupported()) {
        setMapUnavailable(true);
        return () => { cancelled = true; };
      }
      map = new MapLibreMap({
        container: rootRef.current!,
        style: {
          version: 8,
          sources: {
            sgsRaster: {
              type: "raster",
              tiles: [`${window.location.origin}/api/map-tiles/{z}/{x}/{y}.png?v=6`],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "sgs-raster", type: "raster", source: "sgsRaster" }],
        },
        center: [106.81, 10.77],
        zoom: 8.5,
        minZoom: 7,
        maxZoom: 18,
        maxPitch: 0,
        scrollZoom: false,
        cooperativeGestures: true,
        attributionControl: true,
      });
      map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    } catch {
      map?.remove();
      setMapUnavailable(true);
      return () => { cancelled = true; };
    }
    mapRef.current = map;
    map.on("error", (event: any) => {
      if (/webgl|context/i.test(String(event?.error?.message || ""))) {
        map.remove();
        mapRef.current = null;
        setMapUnavailable(true);
      }
    });

    map.once("load", () => {
      if (cancelled) return;
      markersRef.current = PROJECTS.map((project, index) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `lp-map-price${index === activeRef.current ? " active" : ""}`;
        element.textContent = priceText(project, langRef.current);
        element.setAttribute(
          "aria-label",
          `${project.name} — ${priceText(project, langRef.current)}. ${langRef.current === "vi" ? "Chọn dự án" : "Select project"}`,
        );
        element.addEventListener("click", () => onSelectRef.current(index));
        const marker = new Marker({ element, anchor: "center", offset: [0, -5] })
          .setLngLat([project.position[1], project.position[0]])
          .addTo(map);
        return { marker, element };
      });
      window.setTimeout(() => map.resize(), 80);
    });

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(({ element }, index) => {
      const project = PROJECTS[index];
      element.classList.toggle("active", index === active);
      element.textContent = priceText(project, lang);
      element.setAttribute(
        "aria-label",
        `${project.name} — ${priceText(project, lang)}. ${lang === "vi" ? "Chọn dự án" : "Select project"}`,
      );
    });
    const project = PROJECTS[active] || PROJECTS[0];
    map.easeTo({ center: [project.position[1], project.position[0]], duration: 450 });
  }, [active, lang]);

  return (
    <div className="lp-map-shell">
      <div className="lp-map-legend">
        <b>{lang === "vi" ? "Đông Nam Bộ" : "Southeast Vietnam"}</b>
        <span>{lang === "vi" ? "Giá tham khảo" : "Indicative prices"}</span>
        <small>{lang === "vi" ? "Vị trí pin chỉ mang tính tham khảo." : "Pin locations are approximate."}</small>
      </div>
      {mapUnavailable ? (
        <div className="lp-map-fallback" role="region" aria-label={lang === "vi" ? "Sơ đồ dự án tương tác" : "Interactive project map diagram"}>
          <svg className="lp-map-fallback-art" viewBox="0 0 600 450" aria-hidden="true">
            <path d="M434-15C383 55 473 103 420 173S453 277 392 332 432 420 383 470" fill="none" stroke="#a9c9bd" strokeWidth="54" />
            <path d="M434-15C383 55 473 103 420 173S453 277 392 332 432 420 383 470" fill="none" stroke="#d3e4d9" strokeWidth="36" />
            <path d="M-20 330C120 274 185 356 286 292S450 226 624 260M65-20C130 80 106 150 186 204S245 322 223 470M-20 120C102 154 178 117 284 160S466 119 624 82" fill="none" stroke="#fffdf7" strokeWidth="11" />
            <path d="M-20 330C120 274 185 356 286 292S450 226 624 260M65-20C130 80 106 150 186 204S245 322 223 470M-20 120C102 154 178 117 284 160S466 119 624 82" fill="none" stroke="#d0d8ca" strokeWidth="2" />
            <text x="34" y="56" fill="#607b70" fontSize="14" letterSpacing="2">TP. HỒ CHÍ MINH</text>
            <text x="419" y="405" fill="#607b70" fontSize="13" letterSpacing="2">ĐỒNG NAI</text>
          </svg>
          {PROJECTS.map((project, index) => {
            const [lat, lon] = project.position;
            const left = Math.max(10, Math.min(90, ((lon - 106.6) / 0.42) * 100));
            const top = Math.max(10, Math.min(90, ((10.95 - lat) / 0.65) * 100));
            return (
              <button
                key={project.slug}
                type="button"
                className={`lp-map-price lp-map-fallback-pin${index === active ? " active" : ""}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                aria-pressed={index === active}
                aria-label={`${project.name} — ${priceText(project, lang)}. ${lang === "vi" ? "Chọn dự án" : "Select project"}`}
                onClick={() => onSelect(index)}
              >
                {priceText(project, lang)}
              </button>
            );
          })}
          <p className="lp-map-fallback-note">{lang === "vi" ? "Sơ đồ tương tác · Chọn một mức giá để xem dự án" : "Interactive diagram · Select a price to view its project"}</p>
        </div>
      ) : (
        <div ref={rootRef} className="lp-map-surface" role="region" aria-label={lang === "vi" ? "Bản đồ dự án tương tác. Kéo để di chuyển, dùng nút cộng trừ để phóng to." : "Interactive project map. Drag to pan and use plus or minus to zoom."} />
      )}
    </div>
  );
}

function priceText(project: (typeof PROJECTS)[number], lang: "vi" | "en") {
  if (lang === "vi") return project.price;
  const billions = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(project.priceVnd / 1_000_000_000);
  return `From VND ${billions}B`;
}