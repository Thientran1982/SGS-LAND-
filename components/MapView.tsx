
import React, { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing, PropertyType } from '../types';
import { NO_IMAGE_URL } from '../utils/constants';

const HCMC_CENTER: [number, number] = [10.7769, 106.7009];
const HCMC_SPREAD_LAT = 0.10;
const HCMC_SPREAD_LNG = 0.12;

const hashStr = (s: string): number => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return Math.abs(h);
};

// Hash-based fallback — random but deterministic within HCMC bounding box
const getHashCoords = (listing: any): [number, number] => {
    const seed = hashStr(listing.id || listing.title || 'x');
    const lat = HCMC_CENTER[0] + ((seed % 10000) / 10000 - 0.5) * HCMC_SPREAD_LAT;
    const lng = HCMC_CENTER[1] + (((seed >> 8) % 10000) / 10000 - 0.5) * HCMC_SPREAD_LNG;
    return [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))];
};

// Resolve coordinates with three tiers:
//   1. listing.coordinates (real GPS from DB) — note: check != null to handle lat/lng = 0
//   2. Nominatim geocoded from location string (cached in geocodeCacheRef)
//   3. Hash-based HCMC fallback (marked as approximate)
const hasRealCoords = (listing: any): boolean =>
    listing.coordinates?.lat != null && listing.coordinates?.lng != null &&
    (listing.coordinates.lat !== 0 || listing.coordinates.lng !== 0);

// Nominatim rate-limit: 1 request / 1.1 s per OSM policy
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// HCMC geographic bounding box: lng_min, lat_min, lng_max, lat_max
const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';

// Build geocode queries from most-specific to least-specific so Nominatim
// has the best chance of finding the right location within HCMC.
function buildGeoQueries(location: string): string[] {
    const loc = location.trim();
    return [
        `${loc}, Thành phố Hồ Chí Minh, Việt Nam`,
        `${loc}, Ho Chi Minh City, Vietnam`,
        `${loc}, TP. HCM, Việt Nam`,
        `${loc}, Vietnam`,
    ];
}

async function geocodeLocation(
    location: string,
    cache: Map<string, [number, number] | null>
): Promise<[number, number] | null> {
    if (cache.has(location)) return cache.get(location)!;

    const queries = buildGeoQueries(location);
    for (let i = 0; i < queries.length; i++) {
        if (i > 0) await sleep(1100); // Nominatim: 1 req/s
        try {
            const q = encodeURIComponent(queries[i]);
            // bounded=1 forces results inside the viewbox (HCMC area only)
            const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn&viewbox=${HCMC_VIEWBOX}&bounded=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'vi,en', 'User-Agent': 'SGSLand/1.0' } });
            const data = await res.json();
            if (data.length > 0) {
                const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                cache.set(location, coords);
                return coords;
            }
        } catch { /* network error — try next query */ }
    }
    cache.set(location, null);
    return null;
}

interface MapViewProps {
    listings: Listing[];
    onNavigate: (id: string) => void;
    formatCurrency: (val: number) => string;
    formatUnitPrice?: (price: number, area: number, t: any) => string;
    formatCompactNumber?: (val: number) => string;
    t: any;
    language?: string;
}

const MapView: React.FC<MapViewProps> = memo(({ listings, onNavigate, formatCurrency, formatUnitPrice, formatCompactNumber, t, language = 'vn' }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const geocodeCacheRef = useRef<Map<string, [number, number] | null>>(new Map());

    // Initial Map Setup
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        const container = mapContainerRef.current;
        let ro: ResizeObserver | null = null;

        try {
            const map = L.map(container, {
                center: HCMC_CENTER,
                zoom: 13,
                zoomControl: false,
                attributionControl: true,
            });

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 20,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            }).addTo(map);

            mapInstanceRef.current = map;

            ro = new ResizeObserver(() => {
                mapInstanceRef.current?.invalidateSize({ animate: false });
            });
            ro.observe(container);
            map.invalidateSize({ animate: false });
        } catch (e) {
            console.error('Map initialization failed', e);
        }

        return () => {
            ro?.disconnect();
            if (mapInstanceRef.current) {
                try { mapInstanceRef.current.stop(); } catch (_) {}
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Markers Update — async to support Nominatim geocoding for listings without coordinates
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        let cancelled = false;

        const run = async () => {
            try {
                // Clear existing markers
                map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
                if (listings.length === 0) return;

                // --- Phase 1: plot all listings with known coordinates immediately ---
                const bounds = L.latLngBounds([]);
                const pendingGeocode: Listing[] = [];

                const addMarker = (listing: any, point: [number, number], approximate: boolean) => {
                    if (cancelled) return;
                    bounds.extend(point);

                    let priceLabel = '';
                    if (formatCompactNumber) {
                        priceLabel = formatCompactNumber(listing.price);
                    } else if (listing.price >= 1_000_000_000) {
                        priceLabel = `${(listing.price / 1_000_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })} ${t('format.billion') || 'Tỷ'}`;
                    } else if (listing.price >= 1_000_000) {
                        priceLabel = `${(listing.price / 1_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 })} ${t('format.million') || 'Tr'}`;
                    } else {
                        priceLabel = formatCurrency(listing.price);
                    }

                    // Approximate pins use a muted palette to signal "not exact"
                    const pillBg = approximate ? '#64748b' : '#0f172a';
                    const outerTriBorder = approximate ? '#64748b' : '#0f172a';

                    const pinHtml = `
                        <div class="sgs-price-pin" style="display:inline-flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);transform-origin:bottom center;cursor:pointer;filter:drop-shadow(0 4px 10px rgba(0,0,0,${approximate ? '0.18' : '0.30'}));">
                            <div style="background:${pillBg};color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:8px;border:2px solid #fff;white-space:nowrap;letter-spacing:0.3px;line-height:1.4;transition:background 0.15s,transform 0.15s;${approximate ? 'opacity:0.85;' : ''}">
                                ${approximate ? '~&thinsp;' : ''}${priceLabel}
                            </div>
                            <div style="position:relative;width:20px;height:10px;margin-top:-1px;flex-shrink:0;">
                                <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:11px solid #fff;"></div>
                                <div style="position:absolute;top:2px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid ${outerTriBorder};"></div>
                            </div>
                        </div>
                    `;

                    const icon = L.divIcon({ className: '', html: pinHtml, iconSize: [0, 0], iconAnchor: [0, 0] });
                    const marker = L.marker(point, { icon, zIndexOffset: approximate ? 50 : 100 }).addTo(map);

                    const imgUrl = listing.images?.[0] || NO_IMAGE_URL;
                    const areaDisplay = listing.area ? `${listing.area}m²` : '';
                    const bedDisplay = listing.bedrooms ? ` • ${listing.bedrooms} PN` : '';
                    const unitPriceDisplay = (listing.area > 0 && listing.type !== PropertyType.PROJECT && formatUnitPrice)
                        ? ` • ${formatUnitPrice(listing.price, listing.area, t)}` : '';

                    const approxBadge = approximate
                        ? `<div style="background:#f1f5f9;color:#64748b;font-size:9px;font-weight:600;padding:2px 8px;border-radius:8px;margin-bottom:6px;text-align:center;">📍 Vị trí ước tính</div>`
                        : '';

                    const popupContent = `
                        <div style="width:260px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:sans-serif;cursor:pointer;" id="card-${listing.id}">
                            <div style="position:relative;height:140px;overflow:hidden;">
                                <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;" alt="" referrerpolicy="no-referrer" />
                                <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.7),transparent);"></div>
                                <div style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.2);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px;text-transform:uppercase;">
                                    ${t(`transaction.${listing.transaction}`) || listing.transaction}
                                </div>
                                <div style="position:absolute;bottom:12px;left:12px;color:#fff;">
                                    <div style="font-size:18px;font-weight:800;line-height:1;margin-bottom:4px;">${priceLabel}</div>
                                    <div style="font-size:10px;opacity:0.9;">${areaDisplay}${bedDisplay}${unitPriceDisplay}</div>
                                </div>
                            </div>
                            <div style="padding:14px;">
                                ${approxBadge}
                                <h3 style="font-weight:700;color:#1e293b;font-size:13px;margin:0 0 4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${listing.title}</h3>
                                <div style="font-size:10px;color:#94a3b8;margin-bottom:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${listing.location}</div>
                                <button id="btn-${listing.id}" style="width:100%;background:#0f172a;color:#fff;font-size:12px;font-weight:700;padding:10px;border-radius:12px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                                    ${t('common.learn_more') || 'Xem Chi Tiết'}
                                </button>
                            </div>
                        </div>
                    `;

                    marker.bindPopup(popupContent, {
                        closeButton: false,
                        offset: [0, -50],
                        minWidth: 260,
                        maxWidth: 260,
                        autoPanPadding: [50, 50],
                        className: 'sgs-map-popup',
                    });

                    marker.on('popupopen', () => {
                        const btn = document.getElementById(`btn-${listing.id}`);
                        const card = document.getElementById(`card-${listing.id}`);
                        if (btn) btn.onclick = () => onNavigate(listing.id);
                        if (card) card.onclick = () => onNavigate(listing.id);
                    });
                };

                // Phase 1: render listings with real GPS immediately
                for (const listing of listings) {
                    if (hasRealCoords(listing)) {
                        addMarker(listing, [listing.coordinates!.lat, listing.coordinates!.lng], false);
                    } else {
                        pendingGeocode.push(listing);
                    }
                }

                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
                }

                // Phase 2: geocode listings without coordinates (Nominatim, 1 req/s)
                for (const listing of pendingGeocode) {
                    if (cancelled) break;
                    let point: [number, number] | null = null;
                    let approximate = true;

                    if (listing.location) {
                        const geocoded = await geocodeLocation(listing.location, geocodeCacheRef.current);
                        if (geocoded) { point = geocoded; approximate = false; }
                        await sleep(1100); // Nominatim rate limit
                    }

                    if (!point) point = getHashCoords(listing);
                    if (!cancelled) addMarker(listing, point, approximate);
                }

                if (!cancelled && bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
                }
            } catch (e) {
                console.error('Error updating map markers', e);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [listings, formatCurrency, onNavigate, t, formatUnitPrice, formatCompactNumber, language]);

    return (
        <>
            <style>{`
                .sgs-map-popup .leaflet-popup-content-wrapper {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    border-radius: 0 !important;
                }
                .sgs-map-popup .leaflet-popup-content {
                    margin: 0 !important;
                    width: auto !important;
                }
                .sgs-map-popup .leaflet-popup-tip-container {
                    display: none !important;
                }
                .sgs-map-popup {
                    animation: sgs-popup-in 0.2s cubic-bezier(0.16,1,0.3,1) forwards;
                    transform-origin: bottom center;
                }
                @keyframes sgs-popup-in {
                    from { opacity: 0; transform: scale(0.9) translateY(8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                .leaflet-control-zoom { display: flex !important; flex-direction: column; }
                .sgs-price-pin { transition: filter 0.15s ease; }
                .sgs-price-pin:hover { filter: drop-shadow(0 6px 14px rgba(0,0,0,0.40)) !important; }
                .sgs-price-pin:hover > div:first-child { transform: scale(1.08); }
            `}</style>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#e2e8f0' }} />
        </>
    );
});

export default MapView;
