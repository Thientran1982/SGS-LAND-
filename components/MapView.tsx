
import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing, PropertyType } from '../types';
import { NO_IMAGE_URL } from '../utils/constants';
import { buildVNGeoQueries, getDistrictFallback } from '../utils/vnAddress';

const HCMC_CENTER: [number, number] = [10.7769, 106.7009];
const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';
const MAX_GEOCODE_REQUESTS = 20;
const CLUSTER_RADIUS_PX = 60;

// ── Transaction → design tokens ──────────────────────────────────────────────
// 2026: color-coded by transaction type, each with its own glow palette
function pinTokens(transaction?: string) {
    if (transaction === 'RENT')
        return { bg: '#6d28d9', glow: 'rgba(109,40,217,0.40)', label: 'CHO THUÊ' };
    if (transaction === 'PROJECT')
        return { bg: '#0369a1', glow: 'rgba(3,105,161,0.38)', label: 'DỰ ÁN' };
    return { bg: '#0f172a', glow: 'rgba(15,23,42,0.38)', label: 'BÁN' };
}

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
        } catch (_) { /* rate-limited or network blocked */ }
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

function clusterCenter(cluster: PointEntry[]): [number, number] {
    const lat = cluster.reduce((s, e) => s + e.point[0], 0) / cluster.length;
    const lng = cluster.reduce((s, e) => s + e.point[1], 0) / cluster.length;
    return [lat, lng];
}

// ── Price formatting ──────────────────────────────────────────────────────────

function formatPrice(price: number, language: string, formatCompactNumber?: (v: number) => string, t?: any): string {
    if (formatCompactNumber) return formatCompactNumber(price);
    if (price >= 1_000_000_000)
        return `${(price / 1_000_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })} ${t?.('format.billion') || 'Tỷ'}`;
    if (price >= 1_000_000)
        return `${(price / 1_000_000).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 })} ${t?.('format.million') || 'Tr'}`;
    return price.toLocaleString();
}

// ── Pin HTML builders (2026 design) ──────────────────────────────────────────

function priceIcon(label: string, approximate: boolean, transaction?: string, active = false): L.DivIcon {
    const { bg, glow } = pinTokens(transaction);
    const scale = active ? 'scale(1.12)' : 'scale(1)';
    const shadow = active
        ? `drop-shadow(0 0 0 2.5px #fff) drop-shadow(0 6px 18px ${glow})`
        : `drop-shadow(0 2px 8px ${glow})`;

    return L.divIcon({
        className: '',
        html: `
          <div style="
            display:inline-flex;flex-direction:column;align-items:center;
            transform:translate(-50%,-100%) ${scale};
            transform-origin:bottom center;
            transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1),filter 0.18s ease;
            filter:${shadow};
            will-change:transform,filter;
          ">
            <div style="
              background:${bg};
              color:#fff;
              font-size:11.5px;font-weight:750;
              padding:5px 12px;
              border-radius:10px;
              border:2px solid rgba(255,255,255,${active ? 1 : 0.92});
              white-space:nowrap;letter-spacing:0.25px;line-height:1.45;
              font-family:system-ui,-apple-system,sans-serif;
              cursor:pointer;
              background-image:linear-gradient(160deg,rgba(255,255,255,0.13) 0%,transparent 60%);
            ">
              ${approximate ? '<span style="opacity:0.72;font-size:10px;margin-right:2px;">~</span>' : ''}${label}
            </div>
            <div style="
              width:0;height:0;
              border-left:7px solid transparent;
              border-right:7px solid transparent;
              border-top:8px solid ${bg};
              margin-top:-1px;
              filter:drop-shadow(0 2px 0 rgba(0,0,0,0.08));
            "></div>
          </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });
}

function clusterIcon(count: number, dominantTx?: string): L.DivIcon {
    const { bg, glow } = pinTokens(dominantTx);
    const label = count >= 1000 ? `${Math.floor(count / 1000)}k+` : `${count}`;
    return L.divIcon({
        className: '',
        html: `
          <div style="
            display:inline-flex;flex-direction:column;align-items:center;
            transform:translate(-50%,-100%);transform-origin:bottom center;
            filter:drop-shadow(0 4px 14px ${glow});
          ">
            <div class="sgs-cluster-pulse" style="
              background:${bg};
              background-image:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 55%);
              color:#fff;
              font-size:12.5px;font-weight:800;
              padding:7px 16px;
              border-radius:12px;
              border:2.5px solid rgba(255,255,255,0.95);
              white-space:nowrap;letter-spacing:0.3px;line-height:1.4;
              font-family:system-ui,-apple-system,sans-serif;
              cursor:pointer;
              display:flex;align-items:center;gap:6px;
              position:relative;
            ">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              ${label} tin
            </div>
            <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid ${bg};margin-top:-1px;"></div>
          </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MapViewProps {
    listings: Listing[];
    onNavigate: (id: string) => void;
    formatCurrency: (val: number) => string;
    formatUnitPrice?: (price: number, area: number, t: any) => string;
    formatCompactNumber?: (val: number) => string;
    t: any;
    language?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const MapView: React.FC<MapViewProps> = memo(({
    listings, onNavigate, formatCurrency, formatUnitPrice, formatCompactNumber, t, language = 'vn'
}) => {
    const mapRef       = useRef<HTMLDivElement>(null);
    const mapInst      = useRef<L.Map | null>(null);
    const geoCache     = useRef<Map<string, [number, number] | null>>(new Map());
    const layerGroup   = useRef<L.LayerGroup | null>(null);
    const allEntries   = useRef<PointEntry[]>([]);
    const cancelFlag   = useRef(false);
    const activeMarker = useRef<{ marker: L.Marker; entry: PointEntry } | null>(null);

    const [selected, setSelected]       = useState<{ listing: any; approximate: boolean } | null>(null);
    const [clusterGroup, setClusterGroup] = useState<PointEntry[] | null>(null);
    const selectedIdRef = useRef<string | null>(null);

    // ── Map init ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || mapInst.current) return;
        let ro: ResizeObserver | null = null;

        try {
            const map = L.map(mapRef.current, {
                center: HCMC_CENTER, zoom: 13,
                zoomControl: false, attributionControl: true,
            });
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // 2026: Clean minimal tile — CartoDB Voyager has warmer roads
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd', maxZoom: 20,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            }).addTo(map);

            const lg = L.layerGroup().addTo(map);
            layerGroup.current = lg;
            mapInst.current    = map;

            map.on('zoomend', () => renderClusters());
            map.on('click',   () => {
                deselectPin();
                setSelected(null);
                setClusterGroup(null);
            });

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

    // Deselect the currently active pin (restore normal icon)
    const deselectPin = useCallback(() => {
        if (activeMarker.current) {
            const { marker, entry } = activeMarker.current;
            const label = formatPrice(entry.listing.price, language, formatCompactNumber, t);
            marker.setIcon(priceIcon(label, entry.approximate, entry.listing.transaction as string, false));
            activeMarker.current = null;
        }
        selectedIdRef.current = null;
    }, [language, formatCompactNumber, t]);

    // ── Render clusters from allEntries ───────────────────────────────────────
    const renderClusters = useCallback(() => {
        const map = mapInst.current;
        const lg  = layerGroup.current;
        if (!map || !lg) return;

        lg.clearLayers();
        activeMarker.current = null;

        const entries = allEntries.current;
        if (!entries.length) return;

        const clusters = buildClusters(entries, map);

        clusters.forEach(cluster => {
            if (cluster.length === 1) {
                const { listing, point, approximate } = cluster[0];
                const label  = formatPrice(listing.price, language, formatCompactNumber, t);
                const isActive = selectedIdRef.current === listing.id;
                const icon   = priceIcon(label, approximate, listing.transaction as string, isActive);
                const marker = L.marker(point, { icon, zIndexOffset: approximate ? 50 : 100 });

                if (isActive) activeMarker.current = { marker, entry: cluster[0] };

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    // Deselect previous
                    deselectPin();
                    // Activate this pin
                    const activeIcon = priceIcon(label, approximate, listing.transaction as string, true);
                    marker.setIcon(activeIcon);
                    marker.setZIndexOffset(500);
                    activeMarker.current = { marker, entry: cluster[0] };
                    selectedIdRef.current = listing.id;
                    setClusterGroup(null);
                    setSelected({ listing, approximate });
                });
                lg.addLayer(marker);
            } else {
                // Dominant transaction type in cluster
                const txCounts: Record<string, number> = {};
                cluster.forEach(e => { const tx = (e.listing.transaction as string) || 'SALE'; txCounts[tx] = (txCounts[tx] || 0) + 1; });
                const dominantTx = Object.entries(txCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

                const center = clusterCenter(cluster);
                const icon   = clusterIcon(cluster.length, dominantTx);
                const marker = L.marker(center, { icon, zIndexOffset: 200 });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    deselectPin();
                    setSelected(null);
                    if (map.getZoom() < 16) {
                        map.flyTo(center, map.getZoom() + 2, { animate: true, duration: 0.45 });
                    } else {
                        setClusterGroup(cluster);
                    }
                });
                lg.addLayer(marker);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, formatCompactNumber, t, deselectPin]);

    // ── Listings → resolve coords → cluster ───────────────────────────────────
    useEffect(() => {
        cancelFlag.current = true;
        allEntries.current = [];
        layerGroup.current?.clearLayers();
        setSelected(null);
        setClusterGroup(null);
        selectedIdRef.current = null;
        activeMarker.current  = null;
        if (!mapInst.current || !listings.length) return;

        cancelFlag.current = false;
        const cancel = () => cancelFlag.current;

        const run = async () => {
            const resolved: PointEntry[] = [];
            const pending: Listing[]     = [];
            const bounds = L.latLngBounds([]);

            for (const listing of listings) {
                if (hasRealCoords(listing)) {
                    const pt: [number, number] = [listing.coordinates!.lat, listing.coordinates!.lng];
                    resolved.push({ listing, point: pt, approximate: false });
                    bounds.extend(pt);
                } else { pending.push(listing); }
            }

            allEntries.current = [...resolved];
            if (bounds.isValid()) mapInst.current!.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
            renderClusters();

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
                    point = r ? (approximate = false, r) : getFallbackPoint(listing);
                } else {
                    point = getFallbackPoint(listing);
                }

                if (cancel()) break;
                resolved.push({ listing, point, approximate });
                bounds.extend(point);

                if (resolved.length % 5 === 0 || geocodeCount >= MAX_GEOCODE_REQUESTS) {
                    allEntries.current = [...resolved];
                    renderClusters();
                }
            }

            if (!cancel()) {
                allEntries.current = resolved;
                if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
                renderClusters();
            }
        };

        run().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listings]);

    useEffect(() => { renderClusters(); }, [renderClusters]);

    // ── Panel data ────────────────────────────────────────────────────────────
    const sel         = selected;
    const tokens      = sel ? pinTokens(sel.listing.transaction) : null;
    const imgUrl      = sel?.listing.images?.[0] || NO_IMAGE_URL;
    const areaDisplay = sel?.listing.area ? `${sel.listing.area} m²` : '';
    const bedDisplay  = sel?.listing.bedrooms ? `${sel.listing.bedrooms} PN` : '';
    const unitPrice   = sel && sel.listing.area > 0 && sel.listing.type !== PropertyType.PROJECT && formatUnitPrice
        ? formatUnitPrice(sel.listing.price, sel.listing.area, t) : '';
    const priceLabel  = sel ? formatPrice(sel.listing.price, language, formatCompactNumber, t) : '';

    return (
        <>
            <style>{`
                .leaflet-control-zoom { display:flex !important; flex-direction:column; }
                .leaflet-control-attribution { font-size:9px !important; opacity:0.6; }

                /* 2026 cluster pulse ring */
                @keyframes sgs-pulse {
                    0%   { box-shadow: 0 0 0 0   rgba(255,255,255,0.55); }
                    70%  { box-shadow: 0 0 0 10px rgba(255,255,255,0);   }
                    100% { box-shadow: 0 0 0 0   rgba(255,255,255,0);    }
                }
                .sgs-cluster-pulse { animation: sgs-pulse 2s ease-out infinite; }

                /* Panel entrance */
                @keyframes sgs-panel-in {
                    from { opacity:0; transform:translateY(16px) scale(0.97); }
                    to   { opacity:1; transform:translateY(0)     scale(1);   }
                }
                .sgs-panel { animation: sgs-panel-in 0.24s cubic-bezier(0.16,1,0.3,1) forwards; }

                /* Pin hover lift */
                .leaflet-marker-icon:hover { z-index: 9999 !important; }
            `}</style>

            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#e8e8e0' }} />

                {/* ── Legend (2026: minimal top-right chip) ── */}
                <div style={{
                    position: 'absolute', top: 12, right: 12,
                    display: 'flex', gap: 6, zIndex: 900,
                    pointerEvents: 'none',
                }}>
                    {[
                        { tx: 'SALE',    label: 'Bán' },
                        { tx: 'RENT',    label: 'Thuê' },
                        { tx: 'PROJECT', label: 'Dự án' },
                    ].map(({ tx, label }) => {
                        const { bg } = pinTokens(tx);
                        return (
                            <div key={tx} style={{
                                background: 'rgba(255,255,255,0.88)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(0,0,0,0.08)',
                                borderRadius: 8,
                                padding: '4px 8px',
                                display: 'flex', alignItems: 'center', gap: 5,
                                fontSize: 10, fontWeight: 700, color: '#374151',
                                fontFamily: 'system-ui,sans-serif',
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: bg }} />
                                {label}
                            </div>
                        );
                    })}
                </div>

                {/* ── Single-listing detail panel (glassmorphism 2026) ── */}
                {sel && tokens && (
                    <div className="sgs-panel" style={{
                        position: 'absolute', bottom: 24, left: 16, width: 276,
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderRadius: 22,
                        border: '1px solid rgba(255,255,255,0.6)',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.8) inset',
                        zIndex: 1000,
                        fontFamily: 'system-ui,-apple-system,sans-serif',
                    }}>
                        {/* Image */}
                        <div style={{ position: 'relative', height: 144, overflow: 'hidden', cursor: 'pointer' }}
                            onClick={() => onNavigate(sel.listing.id)}>
                            <img src={imgUrl}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease' }}
                                alt="" referrerPolicy="no-referrer"
                                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                            />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.12) 60%, transparent 100%)' }} />

                            {/* Transaction badge */}
                            <div style={{
                                position: 'absolute', top: 10, left: 10,
                                background: tokens.bg,
                                backgroundImage: 'linear-gradient(135deg,rgba(255,255,255,0.18),transparent)',
                                color: '#fff', fontSize: 9, fontWeight: 800,
                                padding: '3px 8px', borderRadius: 6,
                                letterSpacing: '0.6px', textTransform: 'uppercase' as const,
                            }}>
                                {t(`transaction.${sel.listing.transaction}`) || tokens.label}
                            </div>

                            {/* Close */}
                            <button onClick={(e) => { e.stopPropagation(); deselectPin(); setSelected(null); }}
                                style={{
                                    position: 'absolute', top: 8, right: 8,
                                    background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '50%', width: 26, height: 26,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 16, lineHeight: '1', fontWeight: 300,
                                }}
                                aria-label="Đóng">×</button>

                            {/* Price */}
                            <div style={{ position: 'absolute', bottom: 11, left: 12, color: '#fff' }}>
                                <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.3px' }}>{priceLabel}</div>
                                <div style={{ fontSize: 10, opacity: 0.82, marginTop: 2 }}>
                                    {[areaDisplay, bedDisplay, unitPrice].filter(Boolean).join(' · ')}
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '11px 13px 13px' }}>
                            {sel.approximate && (
                                <div style={{
                                    background: '#f8fafc', color: '#94a3b8',
                                    fontSize: 9, fontWeight: 600, padding: '2px 7px',
                                    borderRadius: 6, marginBottom: 7, display: 'inline-flex', alignItems: 'center', gap: 3,
                                }}>
                                    <span>📍</span>{t('map.approx_location') || 'Vị trí ước tính'}
                                </div>
                            )}
                            <h3 style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, margin: '0 0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {sel.listing.title}
                            </h3>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 11, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {sel.listing.location}
                            </div>
                            <button onClick={() => onNavigate(sel.listing.id)} style={{
                                width: '100%', background: tokens.bg,
                                backgroundImage: 'linear-gradient(135deg,rgba(255,255,255,0.12),transparent)',
                                color: '#fff', fontSize: 12, fontWeight: 700,
                                padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                                letterSpacing: '0.2px', transition: 'opacity 0.15s',
                            }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                                {t('common.learn_more') || 'Xem Chi Tiết'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Cluster list panel ── */}
                {clusterGroup && !sel && (
                    <div className="sgs-panel" style={{
                        position: 'absolute', bottom: 24, left: 16, width: 284,
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderRadius: 22, overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.6)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                        zIndex: 1000, maxHeight: 390,
                        fontFamily: 'system-ui,-apple-system,sans-serif',
                    }}>
                        <div style={{ padding: '13px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                                {clusterGroup.length} {t('map.listings_here') || 'tin tại đây'}
                            </span>
                            <button onClick={() => setClusterGroup(null)} style={{
                                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                                width: 26, height: 26, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, color: '#64748b', fontWeight: 300,
                            }}>×</button>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 318 }}>
                            {clusterGroup.map(({ listing, approximate }) => {
                                const { bg } = pinTokens(listing.transaction as string);
                                const lp    = formatPrice(listing.price, language, formatCompactNumber, t);
                                const thumb = listing.images?.[0] || NO_IMAGE_URL;
                                return (
                                    <div key={listing.id}
                                        onClick={() => { setClusterGroup(null); onNavigate(listing.id); }}
                                        style={{ display: 'flex', gap: 10, padding: '8px 13px', cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.05)', alignItems: 'center', transition: 'background 0.12s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                        <img src={thumb} style={{ width: 52, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} alt="" referrerPolicy="no-referrer" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{listing.title}</div>
                                            <div style={{ fontSize: 11, color: bg, fontWeight: 700, marginTop: 2 }}>{lp}</div>
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
