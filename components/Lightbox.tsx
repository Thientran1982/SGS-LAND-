
import React, { useEffect, useState, memo } from 'react';
import { createPortal } from 'react-dom';

interface LightboxProps {
    images: string[];
    initialIndex: number;
    onClose: () => void;
}

const ICONS = {
    CLOSE: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    PREV: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
    NEXT: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    BROKEN: <svg className="w-16 h-16 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
};

export const Lightbox: React.FC<LightboxProps> = memo(({ images, initialIndex, onClose }) => {
    const [index, setIndex] = useState(initialIndex);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Reset loading/error state when image changes
    useEffect(() => {
        setLoading(true);
        setError(false);
    }, [index]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
            if (e.key === 'ArrowRight') setIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
        };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [onClose, images.length]);

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-enter">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 text-white/80">
                <span className="font-mono text-xs">{index + 1} / {images.length}</span>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    {ICONS.CLOSE}
                </button>
            </div>

            {/* Main Image Area */}
            <div className="flex-1 flex items-center justify-center relative w-full h-full p-4" onClick={onClose}>

                {/* Loading skeleton */}
                {loading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                    </div>
                )}

                {/* Broken image fallback */}
                {error && (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                        {ICONS.BROKEN}
                        <span className="text-sm">Không tải được ảnh</span>
                    </div>
                )}

                {/* Actual image */}
                {!error && (
                    <img
                        key={images[index]}
                        src={images[index]}
                        alt={`Ảnh ${index + 1}`}
                        className={`max-h-full max-w-full object-contain shadow-2xl rounded-sm transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                        loading="eager"
                        decoding="async"
                        onClick={(e) => e.stopPropagation()}
                        onLoad={() => setLoading(false)}
                        onError={() => { setLoading(false); setError(true); }}
                    />
                )}

                {/* Navigation Buttons */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={handlePrev}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
                        >
                            {ICONS.PREV}
                        </button>
                        <button
                            onClick={handleNext}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
                        >
                            {ICONS.NEXT}
                        </button>
                    </>
                )}
            </div>

            {/* Dot indicators */}
            <div className="h-16 flex items-center justify-center gap-2 pb-4">
                {images.map((_, i) => (
                    <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                        className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/60'}`}
                    />
                ))}
            </div>
        </div>,
        document.body
    );
});
