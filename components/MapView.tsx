
import React, { useEffect, useRef, memo } from 'react';
import { Listing, PropertyType } from '../types';
import { NO_IMAGE_URL } from '../utils/constants';

declare const L: any; // Use global Leaflet instance from CDN

// HCMC bounding box: lat 10.65–10.90, lng 106.55–106.85
const HCMC_CENTER = { lat: 10.7769, lng: 106.7009 };
const HCMC_SPREAD_LAT = 0.10;
const HCMC_SPREAD_LNG = 0.12;

// Deterministic pseudo-random from string (simple djb2)
const hashStr = (s: string): number => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return Math.abs(h);
};

// Returns real coordinates or generates a plausible HCMC position from the ID
const getCoords = (listing: any): { lat: number; lng: number } => {
    if (listing.coordinates?.lat && listing.coordinates?.lng) return listing.coordinates;
    const seed = hashStr(listing.id || listing.title || 'x');
    const lat = HCMC_CENTER.lat + ((seed % 10000) / 10000 - 0.5) * HCMC_SPREAD_LAT;
    const lng = HCMC_CENTER.lng + (((seed >> 8) % 10000) / 10000 - 0.5) * HCMC_SPREAD_LNG;
    return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
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
    const mapInstanceRef = useRef<any>(null);

    // Initial Map Setup
    useEffect(() => {
        // SAFETY CHECK: Critical fix to prevent White Screen if L is undefined
        if (typeof L === 'undefined') {
            console.warn("Leaflet (L) is not defined. Map module skipped.");
            if (mapContainerRef.current) {
                mapContainerRef.current.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8fafc;color:#64748b;font-size:12px;font-family:sans-serif;flex-direction:column;gap:8px;">
                        <svg style="width:24px;height:24px;opacity:0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                        <span>Map data unavailable</span>
                    </div>`;
            }
            return;
        }

        if (!mapContainerRef.current || mapInstanceRef.current) return;

        let timeoutId: any;

        try {
            // Initialize Map
            const map = L.map(mapContainerRef.current, {
                center: [10.7769, 106.7009], // HCMC Center
                zoom: 13,
                zoomControl: false, 
                attributionControl: false 
            });

            // Add Zoom Control
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // CartoDB Positron
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);

            mapInstanceRef.current = map;

            // Force resize after init to handle tabs/hidden containers
            timeoutId = setTimeout(() => {
                if (mapInstanceRef.current) {
                    map.invalidateSize();
                }
            }, 200);
        } catch (e) {
            console.error("Map initialization failed", e);
        }

        // Cleanup
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.stop();
                } catch (e) {}
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Markers Update
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || typeof L === 'undefined') return;

        try {
            // Clear existing markers
            map.eachLayer((layer: any) => {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });

            const bounds = L.latLngBounds([]);
            let hasMarkers = false;

            listings.forEach(listing => {
                {
                    const { lat, lng } = getCoords(listing);
                    hasMarkers = true;
                    const point = [lat, lng];
                    bounds.extend(point);

                    // --- SMART PRICE PIN LOGIC (VIETNAMESE ABBREVIATIONS) ---
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

                    // Modern Pill Shape Marker — pure inline styles (safe in Leaflet DOM)
                    const pinHtml = `
                        <div style="position:absolute;transform:translate(-50%,-100%);transform-origin:bottom center;cursor:pointer;white-space:nowrap;">
                            <div class="sgs-map-pin" style="display:inline-flex;align-items:center;background:#0f172a;color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,0.35);border:2px solid #fff;transition:background 0.15s,transform 0.15s;white-space:nowrap;transform-origin:bottom center;">
                                ${priceLabel}
                            </div>
                            <div style="position:absolute;bottom:-6px;left:50%;width:12px;height:12px;transform:translateX(-50%) rotate(45deg);border-right:2px solid #fff;border-bottom:2px solid #fff;border-radius:0 0 3px 0;background:#0f172a;"></div>
                        </div>
                    `;

                    const icon = L.divIcon({
                        className: 'custom-map-pin-container',
                        html: pinHtml,
                        iconSize: [1, 1],
                        iconAnchor: [0, 0]
                    });

                    const marker = L.marker(point, { icon, zIndexOffset: 100 }).addTo(map);
                    
                    // --- PREMIUM CARD POPUP ---
                    const imgUrl = listing.images?.[0] || NO_IMAGE_URL;
                    const areaDisplay = listing.area ? `${listing.area}m²` : '';
                    const bedDisplay = listing.bedrooms ? ` • ${listing.bedrooms} PN` : '';
                    const unitPriceDisplay = (listing.area > 0 && listing.type !== PropertyType.PROJECT && formatUnitPrice) 
                        ? ` • ${formatUnitPrice(listing.price, listing.area, t)}` 
                        : '';
                    
                    const popupContent = `
                        <div class="w-[260px] bg-white rounded-[20px] overflow-hidden shadow-2xl font-sans group cursor-pointer" id="card-${listing.id}">
                            <div class="relative h-36 w-full overflow-hidden">
                                <img src="${imgUrl}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" referrerpolicy="no-referrer" />
                                <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-80"></div>
                                <div class="absolute top-3 right-3 bg-white/20 backdrop-blur-md border border-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase">
                                    ${t(`transaction.${listing.transaction}`)}
                                </div>
                                <div class="absolute bottom-3 left-3 text-white">
                                    <div class="text-lg font-extrabold leading-none mb-1">${priceLabel}</div>
                                    <div class="text-[10px] font-medium opacity-90 flex items-center gap-1">
                                        ${areaDisplay}${bedDisplay}${unitPriceDisplay}
                                    </div>
                                </div>
                            </div>
                            <div class="p-4">
                                <h3 class="font-bold text-slate-800 text-sm mb-1 line-clamp-1 leading-snug">${listing.title}</h3>
                                <div class="text-[10px] text-slate-500 mb-4 flex items-center gap-1 truncate">
                                    ${listing.location}
                                </div>
                                <button class="sgs-popup-btn" style="width:100%;background:#0f172a;color:#fff;font-size:12px;font-weight:700;padding:10px;border-radius:12px;border:none;cursor:pointer;transition:background 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;">
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
                        className: 'custom-leaflet-popup-clean'
                    });

                    marker.on('mouseover', function(this: any) {
                        this.setZIndexOffset(1000);
                    });
                    
                    marker.on('mouseout', function(this: any) {
                        this.setZIndexOffset(100);
                    });

                    marker.on('popupopen', () => {
                        const card = document.getElementById(`card-${listing.id}`);
                        if (card) {
                            card.onclick = (e) => {
                                e.preventDefault();
                                onNavigate(listing.id);
                            };
                        }
                    });
                }
            });

            if (hasMarkers) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
            }

            // Force resize after markers update in case container was hidden/shown
            setTimeout(() => {
                if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
            }, 100);
        } catch (e) {
            console.error("Error updating map markers", e);
        }

    }, [listings, formatCurrency, onNavigate]);

    return (
        <>
            <style>{`
                .custom-map-pin-container { background: transparent !important; border: none !important; width: 1px !important; height: 1px !important; overflow: visible !important; }
                .sgs-map-pin:hover { background: #4f46e5 !important; transform: scale(1.12); }
                .custom-leaflet-popup-clean .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
                .custom-leaflet-popup-clean .leaflet-popup-content { margin: 0 !important; width: auto !important; }
                .custom-leaflet-popup-clean .leaflet-popup-tip-container { display: none !important; }
                .custom-leaflet-popup-clean { animation: popup-scale 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: bottom center; }
                @keyframes popup-scale { 0% { opacity: 0; transform: scale(0.9) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                .sgs-popup-btn:hover { background: #4f46e5 !important; }
            `}</style>
            <div ref={mapContainerRef} className="w-full h-full bg-slate-100 z-0" />
        </>
    );
});

export default MapView;
