
import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing, PropertyType } from '../types';
import { NO_IMAGE_URL } from '../utils/constants';
import { buildVNGeoQueries, getDistrictFallback, isNonHCMCAddress } from '../utils/vnAddress';

const HCMC_CENTER: [number, number] = [10.7769, 106.7009];
const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';
const MAX_GEOCODE_REQUESTS = 20;
const CLUSTER_RADIUS_PX = 60;

// Module-level circuit breaker — set to false the moment Nominatim is unreachable.
// Resets after 5 minutes to allow recovery without requiring a page reload.
let nominatimReachable = true;
let nominatimTrippedAt = 0;

// ── Transaction → design tokens ──────────────────────────────────────────────
// Priority: PropertyType.PROJECT → blue-600 | TransactionType.RENT → violet-600 | default → indigo-600
// bg values MUST match the CSS classes in critical.css (.sgs-pin-sale/rent/project).
// NOTE: PropertyType.PROJECT = 'Project' (PascalCase enum value stored in DB).
//       Compare case-insensitively so we match 'Project', 'PROJECT', 'project', etc.
function pinTokens(transaction?: string, propertyType?: string) {
    if (propertyType?.toUpperCase() === 'PROJECT')
        return { bg: '#2563eb', glow: 'rgba(37,99,235,0.40)' };       // blue-600 — Dự án
    if (transaction?.toUpperCase() === 'RENT')
        return { bg: '#7c3aed', glow: 'rgba(124,58,237,0.40)' };      // violet-600 — Thuê
    return { bg: '#4f46e5', glow: 'rgba(79,70,229,0.40)' };           // indigo-600 — Bán
}

// ── Geo utilities ────────────────────────────────────────────────────────────

const hasRealCoords = (listing: any): boolean =>
    listing.coordinates?.lat != null && listing.coordinates?.lng != null &&
    (listing.coordinates.lat !== 0 || listing.coordinates.lng !== 0);

// HCMC bounding box: lat 10.60–11.20, lng 106.40–107.00
const HCMC_LAT_MIN = 10.60, HCMC_LAT_MAX = 11.20;
const HCMC_LNG_MIN = 106.40, HCMC_LNG_MAX = 107.00;

const inHCMCBBox = (lat: number, lng: number): boolean =>
    lat >= HCMC_LAT_MIN && lat <= HCMC_LAT_MAX &&
    lng >= HCMC_LNG_MIN && lng <= HCMC_LNG_MAX;

/**
 * Returns true only when stored coordinates are trustworthy.
 * If the listing address says non-HCMC (e.g. Đồng Nai) but stored coords
 * fall inside the HCMC bounding box, the coords were geocoded incorrectly
 * by the old bounded=1 logic and must be re-geocoded.
 */
const hasTrustedCoords = (listing: any): boolean => {
    if (!hasRealCoords(listing)) return false;
    const { lat, lng } = listing.coordinates;
    if (listing.location && isNonHCMCAddress(listing.location) && inHCMCBBox(lat, lng)) {
        return false; // wrong HCMC coords for an out-of-HCMC address → re-geocode
    }
    return true;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const NOMINATIM_UA = 'SGSLand/1.0 (contact@sgsland.vn)';
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 minutes

async function fetchGeo(query: string, bounded: boolean): Promise<[number, number] | null> {
    const q = encodeURIComponent(query);
    const boundedParam = bounded ? `&viewbox=${HCMC_VIEWBOX}&bounded=1` : '';
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn${boundedParam}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url, {
            headers: { 'Accept-Language': 'vi,en', 'User-Agent': NOMINATIM_UA },
            signal: controller.signal,
        });
        const data = await res.json();
        if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        return null;
    } catch (_) {
        // Trip circuit breaker — auto-resets after CIRCUIT_RESET_MS
        nominatimReachable = false;
        nominatimTrippedAt = Date.now();
        return null;
    } finally {
        clearTimeout(tid);
    }
}

async function geocodeLocation(
    location: string,
    cache: Map<string, [number, number] | null>
): Promise<[number, number] | null> {
    if (cache.has(location)) return cache.get(location)!;

    // Auto-reset circuit breaker after 5 minutes
    if (!nominatimReachable && Date.now() - nominatimTrippedAt > CIRCUIT_RESET_MS) {
        nominatimReachable = true;
    }
    if (!nominatimReachable) { cache.set(location, null); return null; }

    const queries = buildVNGeoQueries(location);
    const nonHCMC = isNonHCMCAddress(location);

    // Pass 1: HCMC addresses only — bounded viewbox for precision
    if (!nonHCMC) {
        for (let i = 0; i < queries.length; i++) {
            if (i > 0) await sleep(1100);
            const coords = await fetchGeo(queries[i], true);
            if (coords) { cache.set(location, coords); return coords; }
            if (!nominatimReachable) break;
        }
    }

    // Pass 2 (or only pass for non-HCMC): Vietnam-wide search without bounding box
    if (nominatimReachable) {
        for (let i = 0; i < Math.min(queries.length, 2); i++) {
            if (i > 0) await sleep(1100);
            const coords = await fetchGeo(queries[i], false);
            if (coords) { cache.set(location, coords); return coords; }
            if (!nominatimReachable) break;
        }
    }

    cache.set(location, null);
    return null;
}

// Deterministic micro-jitter so multiple listings that share the same district
// fallback coordinate don't pile exactly on top of each other.
// Offset ≈ ±0–120 m (0.0000–0.0011°) — invisible at city zoom, visible at zoom ≥ 16.
function hashId(id: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0; // unsigned 32-bit
}

function getFallbackPoint(listing: any): [number, number] {
    if (listing.location) {
        const d = getDistrictFallback(listing.location);
        if (d) {
            const [baseLat, baseLng] = d.coords;
            const h = hashId(String(listing.id ?? listing.location));
            // Two independent sub-hashes mapped to [-0.0005, +0.0005] ≈ ±55 m
            const dLat = ((h & 0xFFFF)       / 0xFFFF - 0.5) * 0.001;
            const dLng = (((h >>> 16) & 0xFFFF) / 0xFFFF - 0.5) * 0.001;
            return [baseLat + dLat, baseLng + dLng];
        }
    }
    return HCMC_CENTER;
}

// Apply a tiny deterministic offset to real GPS coordinates so that multiple
// listings at the exact same address (e.g. two units in the same building entered
// with identical lat/lng) render as visually distinct pins instead of stacking.
// Offset ≈ ±0.00005° ≈ ±5 m — invisible at city zoom, starts separating at zoom 17+.
function getDisplayPoint(listing: any, point: [number, number]): [number, number] {
    const h = hashId(String(listing.id ?? ''));
    const dLat = ((h & 0xFFFF)         / 0xFFFF - 0.5) * 0.0001; // ±0.00005°
    const dLng = (((h >>> 16) & 0xFFFF) / 0xFFFF - 0.5) * 0.0001;
    return [point[0] + dLat, point[1] + dLng];
}

// ── Custom clustering ────────────────────────────────────────────────────────

// At zoom ≤ CLUSTER_MAX_ZOOM → group nearby listings into cluster badges (e.g. "12 BĐS").
// At zoom > CLUSTER_MAX_ZOOM → every listing renders as its own individual price pin.
// Airbnb/Zillow typically cluster at zoom ≤ 14 and show individual pins at 15+.
const CLUSTER_MAX_ZOOM = 14;

interface PointEntry {
    listing: Listing;
    point: [number, number];
    approximate: boolean;
}

function buildClusters(entries: PointEntry[], map: L.Map): PointEntry[][] {
    if (!entries.length) return [];

    // At close zoom: every listing is its own pin — no clustering.
    // This also prevents listings at the same fallback district centroid from
    // staying merged even when the user has zoomed all the way in.
    if (map.getZoom() > CLUSTER_MAX_ZOOM) return entries.map(e => [e]);

    let screen: L.Point[];
    try {
        screen = entries.map(e => map.latLngToContainerPoint(L.latLng(e.point[0], e.point[1])));
    } catch (_) {
        // Map pane not ready yet — return one cluster per entry (no grouping)
        return entries.map(e => [e]);
    }
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

/**
 * Format a price value for use as a map-pin label.
 *
 * We intentionally do NOT delegate to `formatCompactNumber` (the i18n
 * formatter) here, because that function:
 *   1. Uses `toLocaleString('vi-VN', …)` which produces a COMMA as the
 *      decimal separator ("6,5 Tỷ"), which looks like broken text inside
 *      the small pin bubble.
 *   2. Returns the full word "Triệu" (5 chars) for millions, making the
 *      label too long for the pin.
 *
 * Instead we build a compact, consistent label:
 *   - Decimal separator is always "." (universally readable)
 *   - Trailing ".0" is removed (e.g. 12.0 Tỷ → "12 Tỷ")
 *   - Millions use the short suffix "Tr" (not "Triệu")
 *   - English mode shows "B" / "M" suffixes
 */
function formatPrice(price: number, language: string, _ignored?: (v: number) => string, t?: any): string {
    if (!price || isNaN(price)) return '—';
    const isVn = language === 'vn';
    if (price >= 1_000_000_000) {
        const val  = Math.round(price / 100_000_000) / 10;
        const disp = Number.isInteger(val) ? String(val) : val.toFixed(1);
        const unit = isVn ? (t?.('format.billion') || 'Tỷ') : 'B';
        return `${disp} ${unit}`;
    }
    if (price >= 1_000_000) {
        const val  = Math.round(price / 1_000_000);
        const unit = isVn ? 'Tr' : 'M';
        return `${val} ${unit}`;
    }
    return price.toLocaleString();
}

// ── Pin HTML builders (2026 design) ──────────────────────────────────────────

function pinColorClass(transaction?: string, propertyType?: string): string {
    if (propertyType?.toUpperCase() === 'PROJECT') return 'sgs-pin-project';
    if (transaction?.toUpperCase() === 'RENT')      return 'sgs-pin-rent';
    return 'sgs-pin-sale';
}

function priceIcon(label: string, approximate: boolean, transaction?: string, active = false, propertyType?: string): L.DivIcon {
    const { bg, glow } = pinTokens(transaction, propertyType);
    const shadow = active
        ? `drop-shadow(0 0 0 2.5px #fff) drop-shadow(0 6px 18px ${glow})`
        : `drop-shadow(0 2px 8px ${glow})`;
    const colorClass  = pinColorClass(transaction, propertyType);
    const activeClass = active ? ' sgs-pin-active' : '';
    const approx = approximate ? '<span style="opacity:0.72;font-size:10px;margin-right:2px">~</span>' : '';

    // SVG triangle instead of CSS border-trick: the border trick is unreliable inside
    // Leaflet because .leaflet-container* sets box-sizing:border-box globally, which
    // collapses width:0/height:0 elements' borders to nothing regardless of !important.
    // An inline SVG is 100% reliable — it is not affected by any CSS box-model rules.
    return L.divIcon({
        className: 'custom-map-pin-container',
        html: `<div class="sgs-pin-outer${activeClass}" style="filter:${shadow};">` +
              `<div class="sgs-pin-bubble ${colorClass}${activeClass}">${approx}${label}</div>` +
              `<svg width="20" height="11" viewBox="0 0 20 11" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-top:-1px;flex-shrink:0;">` +
              `<polygon points="0,0 20,0 10,11" fill="${bg}"/>` +
              `</svg>` +
              `</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });
}

function clusterIcon(count: number, dominantTx?: string, language = 'vn'): L.DivIcon {
    // 'PROJECT_TYPE' is a sentinel: means majority are PROJECT property type
    const { glow } = dominantTx === 'PROJECT_TYPE'
        ? pinTokens(undefined, 'PROJECT')
        : pinTokens(dominantTx, undefined);
    const colorClass = dominantTx === 'PROJECT_TYPE'
        ? pinColorClass(undefined, 'PROJECT')
        : pinColorClass(dominantTx, undefined);
    const num  = count >= 1000 ? `${Math.floor(count / 1000)}k+` : `${count}`;
    const unit = language === 'vn' ? 'BĐS' : 'listings';
    // Uses .sgs-cluster-outer (inline-flex, translate -50%/-50%) and
    // .sgs-cluster-pill (inline-flex pill, self-sizes to content).
    // inline-flex prevents the 0×0 Leaflet marker width-collapse that made
    // the old display:flex bubble invisible (only raw text was visible).
    return L.divIcon({
        className: 'custom-map-pin-container',
        html: `<div class="sgs-cluster-outer" style="filter:drop-shadow(0 4px 16px ${glow});">` +
              `<div class="sgs-cluster-pill ${colorClass}">` +
              `<span style="font-size:15px;font-weight:800;">${num}</span>` +
              `<span style="font-size:10px;font-weight:700;opacity:0.9;">${unit}</span>` +
              `</div>` +
              `</div>`,
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
    const cancelFlag      = useRef(false);
    const activeMarker    = useRef<{ marker: L.Marker; entry: PointEntry } | null>(null);
    // Tracks the sorted listing-ID string from the last geocoding run.
    // Used to skip a full reset when the parent passes the same listings
    // with a new array reference (common React pattern — causes spurious re-renders).
    const prevListingKey  = useRef<string>('');

    const [selected, setSelected]       = useState<{ listing: any; approximate: boolean } | null>(null);
    const [clusterGroup, setClusterGroup] = useState<PointEntry[] | null>(null);
    const selectedIdRef       = useRef<string | null>(null);
    // Stable ref so event listeners always call the latest renderClusters/deselectPin
    const renderClustersRef   = useRef<() => void>(() => {});
    const deselectPinRef      = useRef<() => void>(() => {});

    // ── Map init ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || mapInst.current) return;
        let ro: ResizeObserver | null = null;

        try {
            const map = L.map(mapRef.current, {
                center: HCMC_CENTER, zoom: 13,
                zoomControl: false, attributionControl: true,
                // Keep smooth CSS zoom animation (zoomAnimation defaults to true).
                // The _leaflet_pos crash on unmount is handled in the cleanup below
                // by zeroing _animatingZoom before removal.
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

            // Use stable refs so listeners always call the current callback version.
            // Both zoomend and moveend can change which listings cluster together
            // (pixel distances shift when the viewport moves).
            map.on('zoomend', () => renderClustersRef.current());
            map.on('moveend', () => renderClustersRef.current());
            map.on('click',   () => {
                deselectPinRef.current();
                setSelected(null);
                setClusterGroup(null);
            });

            ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
            ro.observe(mapRef.current!);
            map.invalidateSize({ animate: false });
        } catch (e) { console.error('Map init failed', e); }

        return () => {
            ro?.disconnect();
            if (mapInst.current) {
                // Prevent "Cannot read properties of undefined (reading '_leaflet_pos')":
                // Leaflet's _onZoomTransitionEnd guard checks this._animatingZoom and
                // returns early when false, so zeroing it stops the crash without
                // having to disable smooth zoom animation entirely.
                try {
                    (mapInst.current as any)._animatingZoom = false;
                    mapInst.current.stop();
                } catch (_) { /* already cleaned up */ }
                mapInst.current.remove();
                mapInst.current = null;
            }
            layerGroup.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Deselect the currently active pin (restore normal icon)
    const deselectPin = useCallback(() => {
        if (activeMarker.current) {
            const { marker, entry } = activeMarker.current;
            const label = formatPrice(entry.listing.price, language, formatCompactNumber, t);
            marker.setIcon(priceIcon(label, entry.approximate, entry.listing.transaction as string, false, entry.listing.type as string));
            activeMarker.current = null;
        }
        selectedIdRef.current = null;
    }, [language, formatCompactNumber, t]);

    // ── Render clusters from allEntries ───────────────────────────────────────
    const renderClusters = useCallback(() => {
        const map = mapInst.current;
        const lg  = layerGroup.current;
        if (!map || !lg) return;
        // Guard: bail if the map's container has already been removed from DOM
        // (can happen when the component unmounts during a zoom/pan animation)
        try {
            const container = map.getContainer();
            if (!container || !document.body.contains(container)) return;
        } catch (_) { return; }

        lg.clearLayers();
        activeMarker.current = null;

        const entries = allEntries.current;
        if (!entries.length) return;

        const clusters = buildClusters(entries, map);

        // ── Pixel-based collision detection ──────────────────────────────────────
        // Price pin labels are ≈60 px wide × 32 px tall (including tail).
        // When two markers land inside the same pixel cell their labels fully overlap,
        // hiding one of them. We detect collisions and spread overlapping pins
        // vertically so every pin is accessible regardless of zoom level.
        const PIN_CELL_W = 64; // px — horizontal cell (label width)
        const PIN_CELL_H = 36; // px — vertical cell (label height + tail)
        const PIN_SLOT_PX = 34; // px — vertical spacing per slot (label height + 2 px gap)

        const overridePoint = new Map<string, [number, number]>(); // listing id → adjusted coord
        try {
            // Map pixelCell → cluster indices whose single entry falls in that cell
            const pixelCells = new Map<string, number[]>();
            clusters.forEach((cluster, ci) => {
                if (cluster.length !== 1) return;
                const { point } = cluster[0];
                const px = map.latLngToContainerPoint(L.latLng(point[0], point[1]));
                const key = `${Math.floor(px.x / PIN_CELL_W)},${Math.floor(px.y / PIN_CELL_H)}`;
                if (!pixelCells.has(key)) pixelCells.set(key, []);
                pixelCells.get(key)!.push(ci);
            });

            // For every crowded cell, vertically fan out the markers so all are visible
            pixelCells.forEach((indices) => {
                if (indices.length <= 1) return;
                const total = indices.length;
                indices.forEach((ci, idx) => {
                    const { listing, point } = clusters[ci][0];
                    const px = map.latLngToContainerPoint(L.latLng(point[0], point[1]));
                    const offsetY = (idx - (total - 1) / 2) * PIN_SLOT_PX;
                    const newLL = map.containerPointToLatLng(L.point(px.x, px.y + offsetY));
                    overridePoint.set(String(listing.id), [newLL.lat, newLL.lng]);
                });
            });
        } catch {
            // Map may be in teardown — latLngToContainerPoint unavailable; skip offsets
        }
        // ── End collision detection ───────────────────────────────────────────────

        clusters.forEach(cluster => {
            if (cluster.length === 1) {
                const { listing, point, approximate } = cluster[0];
                const label  = formatPrice(listing.price, language, formatCompactNumber, t);
                const isActive = selectedIdRef.current === listing.id;
                const pType  = listing.type as string;
                const icon   = priceIcon(label, approximate, listing.transaction as string, isActive, pType);
                // Use collision-adjusted display point when markers would otherwise overlap,
                // otherwise fall back to micro-jitter for real GPS or the raw fallback point.
                const displayPoint: [number, number] = overridePoint.get(String(listing.id))
                    ?? (approximate ? point : getDisplayPoint(listing, point));
                const marker = L.marker(displayPoint, { icon, zIndexOffset: approximate ? 50 : 100 });

                if (isActive) activeMarker.current = { marker, entry: cluster[0] };

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    // Deselect previous
                    deselectPin();
                    // Activate this pin
                    const activeIcon = priceIcon(label, approximate, listing.transaction as string, true, pType);
                    marker.setIcon(activeIcon);
                    marker.setZIndexOffset(500);
                    activeMarker.current = { marker, entry: cluster[0] };
                    selectedIdRef.current = listing.id;
                    setClusterGroup(null);
                    setSelected({ listing, approximate });
                });
                lg.addLayer(marker);
            } else {
                // Dominant colour: PROJECT (propertyType) wins, then RENT, then SALE
                const hasProject = cluster.some(e => (e.listing.type as string)?.toUpperCase() === 'PROJECT');
                const txCounts: Record<string, number> = {};
                cluster.forEach(e => { const tx = (e.listing.transaction as string) || 'SALE'; txCounts[tx] = (txCounts[tx] || 0) + 1; });
                const dominantTx  = hasProject ? 'PROJECT_TYPE' : Object.entries(txCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

                const center = clusterCenter(cluster);
                const icon   = clusterIcon(cluster.length, dominantTx, language);
                const marker = L.marker(center, { icon, zIndexOffset: 200 });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    deselectPin();
                    setSelected(null);
                    if (map.getZoom() <= CLUSTER_MAX_ZOOM) {
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

    // Keep stable refs in sync so event listeners (zoomend, click) always
    // call the most recent version of these callbacks.
    useEffect(() => { renderClustersRef.current = renderClusters; }, [renderClusters]);
    useEffect(() => { deselectPinRef.current    = deselectPin; },    [deselectPin]);

    // ── Listings → resolve coords → cluster ───────────────────────────────────
    useEffect(() => {
        // Build a stable identity key from listing IDs so we don't restart the
        // expensive geocoding pipeline when the parent passes a new array reference
        // containing the same listings (common in React — causes spurious re-renders).
        const newKey = listings.map(l => l.id).sort().join(',');
        if (newKey === prevListingKey.current && allEntries.current.length > 0) {
            // Same listings already resolved — just re-cluster at current zoom.
            // Use the ref so we always call the latest version (not a stale closure).
            renderClustersRef.current();
            return;
        }
        prevListingKey.current = newKey;

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
                if (hasTrustedCoords(listing)) {
                    const pt: [number, number] = [listing.coordinates!.lat, listing.coordinates!.lng];
                    resolved.push({ listing, point: pt, approximate: false });
                    bounds.extend(pt);
                } else { pending.push(listing); }
            }

            allEntries.current = [...resolved];
            // Only auto-zoom on initial paint when ALL listings already have real
            // coordinates (e.g. single-listing detail view).  When there are pending
            // listings to geocode we skip this early fitBounds so the map stays at
            // the HCMC default centre instead of jumping to a lone outlier (e.g. a
            // project in Nhơn Trạch / Đồng Nai that happens to be the only entry with
            // stored coordinates while hundreds of HCMC listings are still being
            // resolved).  The final fitBounds at the end of the geocoding loop will
            // show the full distribution once all points are known.
            if (bounds.isValid() && pending.length === 0) {
                mapInst.current!.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
                // Never auto-zoom below 13 — below that, district centroids cluster
                // together and the user sees only one big cluster bubble instead of pins.
                if (mapInst.current!.getZoom() < 13) mapInst.current!.setZoom(13, { animate: false });
            }
            renderClustersRef.current();

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
                    // Only sleep if Nominatim is reachable — no point rate-limiting a blocked endpoint
                    if (geocodeCount > 0 && !cancel() && nominatimReachable) await sleep(1100);
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

                // Progressive render: update after every listing so the map shows
                // pins as they resolve instead of waiting for the full batch.
                allEntries.current = [...resolved];
                renderClustersRef.current();
            }

            if (!cancel()) {
                allEntries.current = resolved;
                if (bounds.isValid()) {
                    mapInst.current?.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
                    if (mapInst.current && mapInst.current.getZoom() < 13) mapInst.current.setZoom(13, { animate: false });
                }
                renderClustersRef.current();
            }
        };

        run().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listings]);

    useEffect(() => { renderClusters(); }, [renderClusters]);

    // ── Panel data ────────────────────────────────────────────────────────────
    const sel         = selected;
    const tokens      = sel ? pinTokens(sel.listing.transaction, sel.listing.type as string) : null;
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
                        { bg: pinTokens('SALE').bg,             label: language === 'vn' ? 'Bán'    : 'Sale'    },
                        { bg: pinTokens('RENT').bg,             label: language === 'vn' ? 'Thuê'   : 'Rent'    },
                        { bg: pinTokens(undefined, 'PROJECT').bg, label: language === 'vn' ? 'Dự án' : 'Project' },
                    ].map(({ bg, label }) => {
                        return (
                            <div key={label} style={{
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
                                {t(`transaction.${sel.listing.transaction}`) || (sel.listing.transaction === 'RENT' ? 'Cho thuê' : 'Bán')}
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
                                {clusterGroup.length} {t('map.listings_here') || 'BĐS tại đây'}
                            </span>
                            <button onClick={() => setClusterGroup(null)} style={{
                                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                                width: 26, height: 26, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, color: '#64748b', fontWeight: 300,
                            }}>×</button>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 318 }}>
                            {clusterGroup.map(({ listing }) => {
                                const { bg } = pinTokens(listing.transaction as string, listing.type as string);
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
