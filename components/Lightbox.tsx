
import React, { useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';

interface LightboxProps {
    images: string[];
    initialIndex: number;
    onClose: () => void;
}

const ICONS = {
    CLOSE: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    PREV: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
    NEXT: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
};

export const Lightbox: React.FC<LightboxProps> = memo(({ images, initialIndex, onClose }) => {
    const [index, setIndex] = React.useState(initialIndex);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
            if (e.key === 'ArrowRight') setIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
        };
        document.addEventListener('keydown', handleKeyDown);
        // Prevent body scroll when lightbox is open
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
                {/* Image */}
                <img 
                    src={images[index]} 
                    alt={`Gallery ${index + 1}`} 
                    className="max-h-full max-w-full object-contain shadow-2xl rounded-sm transition-transform duration-300"
                    onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
                    referrerPolicy="no-referrer"
                />

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

            {/* Thumbnail Strip (Optional, simplified as dots for now) */}
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
