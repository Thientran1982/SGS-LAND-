// @ts-nocheck
"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function ListingMap({ lat, lng, title }: { lat: number; lng: number; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 15);
    mapRef.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap © CARTO",
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    L.circleMarker([lat, lng], {
      radius: 11,
      color: "#C8963E",
      fillColor: "#1B3A5C",
      fillOpacity: 0.95,
      weight: 3,
    })
      .addTo(map)
      .bindPopup(title || "Vị trí bất động sản");
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);
  return <div ref={ref} className="w-full h-full" style={{ minHeight: "320px" }} />;
}
