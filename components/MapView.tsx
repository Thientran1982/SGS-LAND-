
import React, { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing, PropertyType } from '../types';
import { NO_IMAGE_URL } from '../utils/constants';

// HCMC bounding box: lat 10.65–10.90, lng 106.55–106.85
const HCMC_CENTER: [number, number] = [10.7769, 106.7009];
const HCMC_SPREAD_LAT = 0.10;
const HCMC_SPREAD_LNG = 0.12;

// Deterministic pseudo-random from string (simple djb2)
const hashStr = (s: string): number => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return Math.abs(h);
};

// Returns real coordinates or generates a plausible HCMC position from the ID
const getCoords = (listing: any): [number, number] => {
    if (listing.coordinates?.lat && listing.coordinates?.lng) {
        return [listing.coordinates.lat, listing.coordinates.lng];
    }
    const seed = hashStr(listing.id || listing.title || 'x');
    const lat = HCMC_CENTER[0] + ((seed % 10000) / 10000 - 0.5) * HCMC_SPREAD_LAT;
    const lng = HCMC_CENTER[1] + (((seed >> 8) % 10000) / 10000 - 0.5) * HCMC_SPREAD_LNG;
    return [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))];
};

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

    // Initial Map Setup
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        let timeoutId: ReturnType<typeof setTimeout>;

        try {
            const map = L.map(mapContainerRef.current, {
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

            // Force resize after init to handle tabs/hidden containers
            timeoutId = setTimeout(() => {
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.invalidateSize();
                }
            }, 250);
        } catch (e) {
            console.error('Map initialization failed', e);
        }

        return () => {
            clearTimeout(timeoutId);
            if (mapInstanceRef.current) {
                try { mapInstanceRef.current.stop(); } catch (_) {}
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Markers Update
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        try {
            // Clear existing markers
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker) map.removeLayer(layer);
            });

            if (listings.length === 0) return;

            const bounds = L.latLngBounds([]);

            listings.forEach(listing => {
                const point = getCoords(listing);
                bounds.extend(point);

                // Smart price label (Vietnamese abbreviations)
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

                // Modern pill-shaped price pin marker
                const pinHtml = `
                    <div style="position:absolute;transform:translate(-50%,-100%);transform-origin:bottom center;cursor:pointer;white-space:nowrap;">
                        <div style="display:inline-flex;align-items:center;background:#0f172a;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,0.35);border:2px solid #fff;white-space:nowrap;">
                            ${priceLabel}
                        </div>
                        <div style="position:absolute;bottom:-6px;left:50%;width:12px;height:12px;transform:translateX(-50%) rotate(45deg);border-right:2px solid #fff;border-bottom:2px solid #fff;border-radius:0 0 3px 0;background:#0f172a;"></div>
                    </div>
                `;

                const icon = L.divIcon({
                    className: '',
                    html: pinHtml,
                    iconSize: [1, 1],
                    iconAnchor: [0, 0],
                });

                const marker = L.marker(point, { icon, zIndexOffset: 100 }).addTo(map);

                // Premium card popup
                const imgUrl = listing.images?.[0] || NO_IMAGE_URL;
                const areaDisplay = listing.area ? `${listing.area}m²` : '';
                const bedDisplay = listing.bedrooms ? ` • ${listing.bedrooms} PN` : '';
                const unitPriceDisplay = (listing.area > 0 && listing.type !== PropertyType.PROJECT && formatUnitPrice)
                    ? ` • ${formatUnitPrice(listing.price, listing.area, t)}`
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
            });

            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });

            // Ensure tiles render after markers added
            setTimeout(() => {
                if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
            }, 100);
        } catch (e) {
            console.error('Error updating map markers', e);
        }
    }, [listings, formatCurrency, onNavigate]);

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
            `}</style>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#e2e8f0' }} />
        </>
    );
});

export default MapView;
