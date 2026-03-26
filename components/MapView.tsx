
import React, { useEffect, useRef, useState, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing, PropertyType } from '../types';
import { NO_IMAGE_URL } from '../utils/constants';
import { buildVNGeoQueries, getDistrictFallback } from '../utils/vnAddress';

const HCMC_CENTER: [number, number] = [10.7769, 106.7009];

const hasRealCoords = (listing: any): boolean =>
    listing.coordinates?.lat != null && listing.coordinates?.lng != null &&
    (listing.coordinates.lat !== 0 || listing.coordinates.lng !== 0);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';

async function geocodeLocation(
    location: string,
    cache: Map<string, [number, number] | null>
): Promise<[number, number] | null> {
    if (cache.has(location)) return cache.get(location)!;

    const queries = buildVNGeoQueries(location);
    console.log(`[SGS Geocode] Trying ${queries.length} queries for: "${location}"`);
    for (let i = 0; i < queries.length; i++) {
        if (i > 0) await sleep(1100);
        try {
            const q = encodeURIComponent(queries[i]);
            const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn&viewbox=${HCMC_VIEWBOX}&bounded=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'vi,en', 'User-Agent': 'SGSLand/1.0' } });
            const data = await res.json();
            console.log(`[SGS Geocode] Q${i + 1}: "${queries[i]}" → ${data.length > 0 ? `${data[0].lat},${data[0].lon} (${data[0].display_name?.substring(0, 60)})` : 'no result'}`);
            if (data.length > 0) {
                const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                cache.set(location, coords);
                return coords;
            }
        } catch (e) {
            console.warn(`[SGS Geocode] Q${i + 1} error:`, e);
        }
    }
    console.warn(`[SGS Geocode] All queries failed for: "${location}"`);
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

    // Selected listing panel state — Leaflet callbacks update this via ref
    const [selectedListing, setSelectedListing] = useState<{ listing: any; approximate: boolean } | null>(null);
    const selectedListingRef = useRef<((v: { listing: any; approximate: boolean } | null) => void)>(setSelectedListing);
    useEffect(() => { selectedListingRef.current = setSelectedListing; }, []);

    // ── Initial Map Setup ────────────────────────────────────────────────────
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

            // Click on map background → close panel
            map.on('click', () => selectedListingRef.current(null));

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

    // ── Markers Update ───────────────────────────────────────────────────────
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        let cancelled = false;

        const run = async () => {
            try {
                map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
                if (listings.length === 0) return;

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

                    const pinHtml = `
                        <div class="sgs-price-pin" style="display:inline-flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);transform-origin:bottom center;cursor:pointer;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.30));">
                            <div style="background:#0f172a;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:8px;border:2px solid #fff;white-space:nowrap;letter-spacing:0.3px;line-height:1.4;transition:background 0.15s,transform 0.15s;">
                                ${approximate ? '~&thinsp;' : ''}${priceLabel}
                            </div>
                            <div style="position:relative;width:20px;height:10px;margin-top:-1px;flex-shrink:0;">
                                <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:11px solid #fff;"></div>
                                <div style="position:absolute;top:2px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid #0f172a;"></div>
                            </div>
                        </div>
                    `;

                    const icon = L.divIcon({ className: '', html: pinHtml, iconSize: [0, 0], iconAnchor: [0, 0] });
                    const marker = L.marker(point, { icon, zIndexOffset: approximate ? 50 : 100 }).addTo(map);

                    // Click → open fixed side-panel (no auto-pan, no position issues)
                    marker.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        selectedListingRef.current({ listing, approximate });
                    });
                };

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

                for (const listing of pendingGeocode) {
                    if (cancelled) break;
                    let point: [number, number] | null = null;
                    let approximate = true;

                    if (listing.location) {
                        const geocoded = await geocodeLocation(listing.location, geocodeCacheRef.current);
                        if (geocoded) { point = geocoded; approximate = false; }
                        else {
                            const distFallback = getDistrictFallback(listing.location);
                            if (distFallback) {
                                console.log(`[SGS Geocode] District fallback for "${listing.location}" → ${distFallback.district} ${distFallback.coords}`);
                                point = distFallback.coords;
                            }
                        }
                        await sleep(1100);
                    }

                    if (!point) {
                        console.warn(`[SGS Geocode] No district found for "${listing.location}" — using HCMC centre`);
                        point = HCMC_CENTER;
                    }
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

    // ── Detail panel data ────────────────────────────────────────────────────
    const sel = selectedListing;
    const imgUrl     = sel?.listing.images?.[0] || NO_IMAGE_URL;
    const areaDisplay = sel?.listing.area ? `${sel.listing.area} m²` : '';
    const bedDisplay  = sel?.listing.bedrooms ? `${sel.listing.bedrooms} PN` : '';
    const unitPrice   = sel && sel.listing.area > 0 && sel.listing.type !== PropertyType.PROJECT && formatUnitPrice
        ? formatUnitPrice(sel.listing.price, sel.listing.area, t) : '';

    let priceLabel = '';
    if (sel) {
        if (formatCompactNumber) {
            priceLabel = formatCompactNumber(sel.listing.price);
        } else if (sel.listing.price >= 1_000_000_000) {
            priceLabel = `${(sel.listing.price / 1_000_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })} ${t('format.billion') || 'Tỷ'}`;
        } else if (sel.listing.price >= 1_000_000) {
            priceLabel = `${(sel.listing.price / 1_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 })} ${t('format.million') || 'Tr'}`;
        } else {
            priceLabel = formatCurrency(sel.listing.price);
        }
    }

    return (
        <>
            <style>{`
                .leaflet-control-zoom { display: flex !important; flex-direction: column; }
                .sgs-price-pin { transition: filter 0.15s ease; }
                .sgs-price-pin:hover { filter: drop-shadow(0 6px 14px rgba(0,0,0,0.40)) !important; }
                .sgs-price-pin:hover > div:first-child { transform: scale(1.08); }
                @keyframes sgs-panel-in {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                .sgs-detail-panel { animation: sgs-panel-in 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
            `}</style>

            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#e2e8f0' }} />

                {/* ── Fixed detail panel — bottom-left, always in-view ── */}
                {sel && (
                    <div
                        className="sgs-detail-panel"
                        style={{
                            position: 'absolute',
                            bottom: 24,
                            left: 16,
                            width: 272,
                            background: '#fff',
                            borderRadius: 20,
                            overflow: 'hidden',
                            boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
                            zIndex: 1000,
                            fontFamily: 'sans-serif',
                        }}
                    >
                        {/* Image */}
                        <div style={{ position: 'relative', height: 148, overflow: 'hidden', cursor: 'pointer' }}
                            onClick={() => onNavigate(sel.listing.id)}>
                            <img
                                src={imgUrl}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                alt=""
                                referrerPolicy="no-referrer"
                            />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)' }} />

                            {/* Transaction badge */}
                            <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {t(`transaction.${sel.listing.transaction}`) || sel.listing.transaction}
                            </div>

                            {/* Close button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setSelectedListing(null); }}
                                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, lineHeight: 1 }}
                                aria-label="Đóng"
                            >×</button>

                            {/* Price overlay */}
                            <div style={{ position: 'absolute', bottom: 12, left: 12, color: '#fff' }}>
                                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, marginBottom: 3 }}>{priceLabel}</div>
                                <div style={{ fontSize: 10, opacity: 0.88 }}>
                                    {[areaDisplay, bedDisplay, unitPrice].filter(Boolean).join(' · ')}
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '12px 14px 14px' }}>
                            {sel.approximate && (
                                <div style={{ background: '#f1f5f9', color: '#64748b', fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 8, marginBottom: 8, display: 'inline-block' }}>
                                    📍 {t('map.approx_location') || 'Vị trí ước tính'}
                                </div>
                            )}
                            <h3 style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, margin: '0 0 3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {sel.listing.title}
                            </h3>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {sel.listing.location}
                            </div>
                            <button
                                onClick={() => onNavigate(sel.listing.id)}
                                style={{ width: '100%', background: '#0f172a', color: '#fff', fontSize: 12, fontWeight: 700, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', letterSpacing: '0.2px' }}
                            >
                                {t('common.learn_more') || 'Xem Chi Tiết'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
});

export default MapView;
