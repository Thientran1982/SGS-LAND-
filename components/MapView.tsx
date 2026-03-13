
import React, { useEffect, useRef, memo } from 'react';
import { Listing, PropertyType } from '../types';

declare const L: any; // Use global Leaflet instance from CDN

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
                if (listing.coordinates) {
                    const { lat, lng } = listing.coordinates;
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

                    // Modern Pill Shape Marker
                    const pinHtml = `
                        <div style="position:absolute; transform:translate(-50%,-100%); transform-origin:bottom center; cursor:pointer; white-space:nowrap;" class="group">
                            <div style="transition:background-color 0.15s,border-color 0.15s,transform 0.15s; transform-origin:bottom center;" class="bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-2xl shadow-xl border-2 border-white hover:border-indigo-200 hover:scale-110 flex items-center gap-1 whitespace-nowrap origin-bottom">
                                <span>${priceLabel}</span>
                            </div>
                            <div style="position:absolute; bottom:-6px; left:50%; width:12px; height:12px; transform:translateX(-50%) rotate(45deg); border-right:2px solid white; border-bottom:2px solid white; border-radius:0 0 3px 0; background:#0f172a; transition:background-color 0.15s;"></div>
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
                    const imgUrl = listing.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image';
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
                                <button class="w-full bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-slate-200 active:scale-95 flex items-center justify-center gap-2">
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
        } catch (e) {
            console.error("Error updating map markers", e);
        }

    }, [listings, formatCurrency, onNavigate]);

    return (
        <>
            <style>{`
                .custom-map-pin-container { background: transparent !important; border: none !important; width: 1px !important; height: 1px !important; overflow: visible !important; }
                .custom-leaflet-popup-clean .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
                .custom-leaflet-popup-clean .leaflet-popup-content { margin: 0 !important; width: auto !important; }
                .custom-leaflet-popup-clean .leaflet-popup-tip-container { display: none !important; }
                .custom-leaflet-popup-clean { animation: popup-scale 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: bottom center; }
                @keyframes popup-scale { 0% { opacity: 0; transform: scale(0.9) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>
            <div ref={mapContainerRef} className="w-full h-full bg-slate-100 z-0" />
        </>
    );
});

export default MapView;
