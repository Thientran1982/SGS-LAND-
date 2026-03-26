
import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing, PropertyType } from '../types';
import { NO_IMAGE_URL } from '../utils/constants';
import { buildVNGeoQueries, getDistrictFallback } from '../utils/vnAddress';

const HCMC_CENTER: [number, number] = [10.7769, 106.7009];
const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';
const MAX_GEOCODE_REQUESTS = 20;
// pixels — pins within this distance cluster together
const CLUSTER_RADIUS_PX = 56;

// ── Geo utilities ────────────────────────────────────────────────────────────

const hasRealCoords = (listing: any): boolean =>
    listing.coordinates?.lat != null && listing.coordinates?.lng != null &&
    (listing.coordinates.lat !== 0 || listing.coordinates.lng !== 0);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function geocodeLocation(
    location: string,
    cache: Map<string, [number, number] | null>
): Promise<[number, number] | null> {
    if (cache.has(location)) return cache.get(location)!;
    const queries = buildVNGeoQueries(location);
    for (let i = 0; i < queries.length; i++) {
        if (i > 0) await sleep(1100);
        try {
            const q = encodeURIComponent(queries[i]);
            const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn&viewbox=${HCMC_VIEWBOX}&bounded=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'vi,en', 'User-Agent': 'SGSLand/1.0' } });
            const data = await res.json();
            if (data.length > 0) {
                const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                cache.set(location, coords);
                return coords;
            }
        } catch (_) { /* network blocked or quota → fall through */ }
    }
    cache.set(location, null);
    return null;
}

function getFallbackPoint(listing: any): [number, number] {
    if (listing.location) {
        const d = getDistrictFallback(listing.location);
        if (d) return d.coords;
    }
    return HCMC_CENTER;
}

// ── Custom clustering ────────────────────────────────────────────────────────

interface PointEntry {
    listing: Listing;
    point: [number, number];
    approximate: boolean;
}

// Simple greedy pixel-distance clustering — O(n²) but fine for <5 000 pts
function buildClusters(entries: PointEntry[], map: L.Map): PointEntry[][] {
    if (!entries.length) return [];
    const screen = entries.map(e => map.latLngToContainerPoint(L.latLng(e.point[0], e.point[1])));
    const taken = new Uint8Array(entries.length);
    const clusters: PointEntry[][] = [];

    for (let i = 0; i < entries.length; i++) {
        if (taken[i]) continue;
        taken[i] = 1;
        const cluster: PointEntry[] = [entries[i]];
        for (let j = i + 1; j < entries.length; j++) {
            if (taken[j]) continue;
            const dx = screen[i].x - screen[j].x;
            const dy = screen[i].y - screen[j].y;
            if (dx * dx + dy * dy <= CLUSTER_RADIUS_PX * CLUSTER_RADIUS_PX) {
                cluster.push(entries[j]);
                taken[j] = 1;
            }
        }
        clusters.push(cluster);
    }
    return clusters;
}

// Centroid of a cluster (for marker placement)
function clusterCenter(cluster: PointEntry[]): [number, number] {
    const lat = cluster.reduce((s, e) => s + e.point[0], 0) / cluster.length;
    const lng = cluster.reduce((s, e) => s + e.point[1], 0) / cluster.length;
    return [lat, lng];
}

// ── Price formatting ─────────────────────────────────────────────────────────

function formatPrice(price: number, language: string, formatCompactNumber?: (v: number) => string, t?: any): string {
    if (formatCompactNumber) return formatCompactNumber(price);
    if (price >= 1_000_000_000) {
        return `${(price / 1_000_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })} ${t?.('format.billion') || 'Tỷ'}`;
    }
    if (price >= 1_000_000) {
        return `${(price / 1_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 })} ${t?.('format.million') || 'Tr'}`;
    }
    return price.toLocaleString();
}

// ── Pin HTML builders ────────────────────────────────────────────────────────

const PIN_BODY = `
    border-radius:8px;
    border:2.5px solid #fff;
    white-space:nowrap;
    line-height:1.4;
    cursor:pointer;
    font-family:system-ui,sans-serif;
    letter-spacing:0.2px;
`;

function priceIcon(label: string, approximate: boolean): L.DivIcon {
    const bg = '#0f172a';
    return L.divIcon({
        className: '',
        html: `
            <div style="display:inline-flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);transform-origin:bottom center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.30));">
                <div style="background:${bg};color:#fff;font-size:11.5px;font-weight:700;padding:5px 13px;${PIN_BODY}">
                    ${approximate ? '~&thinsp;' : ''}${label}
                </div>
                <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid ${bg};margin-top:-1px;"></div>
            </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });
}

function clusterIcon(count: number): L.DivIcon {
    const bg = '#1e40af';
    const label = count >= 1000 ? `${Math.floor(count / 1000)}k+ tin` : `${count} tin`;
    return L.divIcon({
        className: '',
        html: `
            <div style="display:inline-flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);transform-origin:bottom center;filter:drop-shadow(0 5px 14px rgba(30,64,175,0.45));">
                <div style="background:${bg};color:#fff;font-size:12px;font-weight:800;padding:6px 15px;${PIN_BODY}gap:5px;display:flex;align-items:center;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${label}
                </div>
                <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:10px solid ${bg};margin-top:-1px;"></div>
            </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface MapViewProps {
    listings: Listing[];
    onNavigate: (id: string) => void;
    formatCurrency: (val: number) => string;
    formatUnitPrice?: (price: number, area: number, t: any) => string;
    formatCompactNumber?: (val: number) => string;
    t: any;
    language?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const MapView: React.FC<MapViewProps> = memo(({
    listings, onNavigate, formatCurrency, formatUnitPrice, formatCompactNumber, t, language = 'vn'
}) => {
    const mapRef       = useRef<HTMLDivElement>(null);
    const mapInst      = useRef<L.Map | null>(null);
    const geoCache     = useRef<Map<string, [number, number] | null>>(new Map());
    const layerGroup   = useRef<L.LayerGroup | null>(null);
    const allEntries   = useRef<PointEntry[]>([]);     // resolved entries for re-clustering on zoom
    const cancelFlag   = useRef(false);

    const [selected, setSelected]       = useState<{ listing: any; approximate: boolean } | null>(null);
    const [clusterGroup, setClusterGroup] = useState<PointEntry[] | null>(null); // listings in a clicked cluster

    // ── Map init ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || mapInst.current) return;
        let ro: ResizeObserver | null = null;

        try {
            const map = L.map(mapRef.current, {
                center: HCMC_CENTER, zoom: 13,
                zoomControl: false, attributionControl: true,
            });
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd', maxZoom: 20,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            }).addTo(map);

            const lg = L.layerGroup().addTo(map);
            layerGroup.current = lg;
            mapInst.current    = map;

            // Re-cluster whenever zoom changes (pixel distances change)
            map.on('zoomend', () => renderClusters());
            map.on('click',   () => { setSelected(null); setClusterGroup(null); });

            ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
            ro.observe(mapRef.current!);
            map.invalidateSize({ animate: false });
        } catch (e) { console.error('Map init failed', e); }

        return () => {
            ro?.disconnect();
            mapInst.current?.remove();
            mapInst.current = null;
            layerGroup.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Render clusters from allEntries ───────────────────────────────────────
    const renderClusters = useCallback(() => {
        const map = mapInst.current;
        const lg  = layerGroup.current;
        if (!map || !lg) return;

        lg.clearLayers();
        const entries = allEntries.current;
        if (!entries.length) return;

        const clusters = buildClusters(entries, map);

        clusters.forEach(cluster => {
            if (cluster.length === 1) {
                // Single price pin
                const { listing, point, approximate } = cluster[0];
                const label = formatPrice(listing.price, language, formatCompactNumber, t);
                const marker = L.marker(point, {
                    icon: priceIcon(label, approximate),
                    zIndexOffset: approximate ? 50 : 100,
                });
                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    setClusterGroup(null);
                    setSelected({ listing, approximate });
                });
                lg.addLayer(marker);
            } else {
                // Cluster pill
                const center = clusterCenter(cluster);
                const marker = L.marker(center, {
                    icon: clusterIcon(cluster.length),
                    zIndexOffset: 200,
                });
                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    setSelected(null);
                    // Zoom in if map zoom < 16, otherwise show list panel
                    if (map.getZoom() < 16) {
                        map.flyTo(center, map.getZoom() + 2, { animate: true, duration: 0.4 });
                    } else {
                        setClusterGroup(cluster);
                    }
                });
                lg.addLayer(marker);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, formatCompactNumber, t]);

    // ── Listings → resolve coords → cluster ──────────────────────────────────
    useEffect(() => {
        const map = mapInst.current;
        cancelFlag.current = true;        // cancel any running geocode loop
        allEntries.current = [];
        layerGroup.current?.clearLayers();
        setSelected(null);
        setClusterGroup(null);
        if (!map || !listings.length) return;

        cancelFlag.current = false;
        const cancel = () => cancelFlag.current;

        const run = async () => {
            const resolved: PointEntry[] = [];
            const pending: Listing[] = [];
            const bounds = L.latLngBounds([]);

            // Phase 1 — stored GPS (instant)
            for (const listing of listings) {
                if (hasRealCoords(listing)) {
                    const pt: [number, number] = [listing.coordinates!.lat, listing.coordinates!.lng];
                    resolved.push({ listing, point: pt, approximate: false });
                    bounds.extend(pt);
                } else {
                    pending.push(listing);
                }
            }

            // Render phase 1 immediately so map is not empty
            allEntries.current = [...resolved];
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
            }
            renderClusters();

            // Phase 2 — geocode up to MAX_GEOCODE_REQUESTS, rest → fallback
            let geocodeCount = 0;

            for (const listing of pending) {
                if (cancel()) break;

                let point: [number, number];
                let approximate = true;

                const cached = listing.location ? geoCache.current.get(listing.location) : undefined;

                if (cached !== undefined) {
                    point = cached ?? getFallbackPoint(listing);
                    approximate = !cached;
                } else if (geocodeCount < MAX_GEOCODE_REQUESTS && listing.location) {
                    if (geocodeCount > 0 && !cancel()) await sleep(1100);
                    if (cancel()) break;
                    const r = await geocodeLocation(listing.location, geoCache.current);
                    geocodeCount++;
                    if (r) { point = r; approximate = false; }
                    else    { point = getFallbackPoint(listing); }
                } else {
                    point = getFallbackPoint(listing);
                }

                if (cancel()) break;
                resolved.push({ listing, point, approximate });
                bounds.extend(point);

                // Progressive render: update every 5 resolved items for responsiveness
                if (resolved.length % 5 === 0 || geocodeCount >= MAX_GEOCODE_REQUESTS) {
                    allEntries.current = [...resolved];
                    renderClusters();
                }
            }

            if (!cancel()) {
                allEntries.current = resolved;
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
                }
                renderClusters();
            }
        };

        run().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listings]);

    // Re-render clusters when formatters change (language switch etc.)
    useEffect(() => { renderClusters(); }, [renderClusters]);

    // ── Panel data ───────────────────────────────────────────────────────────
    const sel = selected;
    const imgUrl     = sel?.listing.images?.[0] || NO_IMAGE_URL;
    const areaDisplay = sel?.listing.area ? `${sel.listing.area} m²` : '';
    const bedDisplay  = sel?.listing.bedrooms ? `${sel.listing.bedrooms} PN` : '';
    const unitPrice   = sel && sel.listing.area > 0 && sel.listing.type !== PropertyType.PROJECT && formatUnitPrice
        ? formatUnitPrice(sel.listing.price, sel.listing.area, t) : '';
    const priceLabel = sel ? formatPrice(sel.listing.price, language, formatCompactNumber, t) : '';

    return (
        <>
            <style>{`
                .leaflet-control-zoom { display:flex !important; flex-direction:column; }
                @keyframes panel-in {
                    from { opacity:0; transform:translateY(14px) scale(0.97); }
                    to   { opacity:1; transform:translateY(0)     scale(1); }
                }
                .sgs-panel { animation: panel-in 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
            `}</style>

            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#e2e8f0' }} />

                {/* ── Single-listing detail panel ── */}
                {sel && (
                    <div className="sgs-panel" style={{
                        position: 'absolute', bottom: 24, left: 16, width: 272,
                        background: '#fff', borderRadius: 20, overflow: 'hidden',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.22)', zIndex: 1000,
                        fontFamily: 'system-ui,sans-serif',
                    }}>
                        <div style={{ position: 'relative', height: 148, overflow: 'hidden', cursor: 'pointer' }}
                            onClick={() => onNavigate(sel.listing.id)}>
                            <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" referrerPolicy="no-referrer" />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)' }} />
                            <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 8, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                                {t(`transaction.${sel.listing.transaction}`) || sel.listing.transaction}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelected(null); }}
                                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}
                                aria-label="Đóng">×</button>
                            <div style={{ position: 'absolute', bottom: 12, left: 12, color: '#fff' }}>
                                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, marginBottom: 3 }}>{priceLabel}</div>
                                <div style={{ fontSize: 10, opacity: 0.88 }}>{[areaDisplay, bedDisplay, unitPrice].filter(Boolean).join(' · ')}</div>
                            </div>
                        </div>
                        <div style={{ padding: '12px 14px 14px' }}>
                            {sel.approximate && (
                                <div style={{ background: '#f1f5f9', color: '#64748b', fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 8, marginBottom: 8, display: 'inline-block' }}>
                                    📍 {t('map.approx_location') || 'Vị trí ước tính'}
                                </div>
                            )}
                            <h3 style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, margin: '0 0 3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sel.listing.title}</h3>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sel.listing.location}</div>
                            <button onClick={() => onNavigate(sel.listing.id)}
                                style={{ width: '100%', background: '#0f172a', color: '#fff', fontSize: 12, fontWeight: 700, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                                {t('common.learn_more') || 'Xem Chi Tiết'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Cluster list panel (shown at max zoom when cluster tapped) ── */}
                {clusterGroup && !sel && (
                    <div className="sgs-panel" style={{
                        position: 'absolute', bottom: 24, left: 16, width: 280,
                        background: '#fff', borderRadius: 20, overflow: 'hidden',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.22)', zIndex: 1000,
                        fontFamily: 'system-ui,sans-serif', maxHeight: 380,
                    }}>
                        <div style={{ padding: '14px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>
                                {clusterGroup.length} {t('map.listings_here') || 'tin tại đây'}
                            </span>
                            <button onClick={() => setClusterGroup(null)}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}>×</button>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 310 }}>
                            {clusterGroup.map(({ listing, approximate }) => {
                                const thumb = listing.images?.[0] || NO_IMAGE_URL;
                                const lp = formatPrice(listing.price, language, formatCompactNumber, t);
                                return (
                                    <div key={listing.id} onClick={() => { setClusterGroup(null); onNavigate(listing.id); }}
                                        style={{ display: 'flex', gap: 10, padding: '8px 14px', cursor: 'pointer', borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
                                        <img src={thumb} style={{ width: 52, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} alt="" referrerPolicy="no-referrer" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{listing.title}</div>
                                            <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700, marginTop: 2 }}>{lp}</div>
                                            {approximate && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>📍 ước tính</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
});

export default MapView;
