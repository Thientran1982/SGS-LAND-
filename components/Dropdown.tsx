
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../services/i18n';

// -----------------------------------------------------------------------------
// 1. TYPES & INTERFACES
// -----------------------------------------------------------------------------

export interface DropdownOption {
    value: string | number;
    label: string;
    icon?: React.ReactNode;
}

interface DropdownProps<T extends string | number> {
    label?: string;
    value: T;
    onChange: (value: T) => void;
    options: DropdownOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    icon?: React.ReactNode; // Leading icon
    error?: boolean; // Visual error state
    placement?: 'top' | 'bottom'; // Force direction
}

// -----------------------------------------------------------------------------
// 2. CONSTANTS & ASSETS
// -----------------------------------------------------------------------------

const ICONS = {
    CHEVRON: <svg className="w-4 h-4 transition-transform duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
    CHECK: <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
};

const STYLES = {
    LABEL: "block text-xs font-bold uppercase mb-1 ml-1 select-none transition-colors",
    BUTTON: "w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 outline-none text-sm group",
    // Menu styles updated for Portal with Dark Mode
    MENU: "fixed z-[9999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-100/50 dark:border-white/10 animate-scale-up overflow-y-auto no-scrollbar overscroll-contain text-sm focus:outline-none min-w-[120px] max-h-[320px]",
    OPTION: "w-full min-h-[44px] text-left px-4 py-2.5 transition-colors flex items-center gap-2 group border-b border-slate-50 dark:border-white/5 last:border-0 outline-none focus:bg-slate-50 dark:focus:bg-slate-800",
    
    // State variants
    DISABLED: "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border-slate-200 dark:border-slate-700",
    ERROR: "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-300 focus:ring-2 focus:ring-rose-500/20",
    DEFAULT: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99] text-slate-700 dark:text-slate-200",
    OPEN: "border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20"
};

// -----------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -----------------------------------------------------------------------------

export const Dropdown = memo(<T extends string | number>({
    label,
    value,
    onChange,
    options,
    placeholder,
    disabled = false,
    className = "",
    icon,
    error = false,
    placement = 'bottom'
}: DropdownProps<T>) => {
    const [isOpen, setIsOpen] = useState(false);
    // Flexible coords state to handle top or bottom positioning
    const [coords, setCoords] = useState<{ top?: number, bottom?: number, left: number, width: number }>({ left: 0, width: 0 });
    
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // Calculate position when opening — auto-flips if not enough space below
    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const GAP = 6;
            const MAX_MENU_HEIGHT = 320;
            const MIN_WIDTH = 160;
            const menuWidth = Math.max(rect.width, MIN_WIDTH);
            // Clamp left so menu never overflows the right edge of the viewport
            const safeLeft = Math.min(rect.left, window.innerWidth - menuWidth - 8);

            const spaceBelow = window.innerHeight - rect.bottom - GAP;
            const spaceAbove = rect.top - GAP;

            // Honour explicit placement prop; for 'bottom' auto-flip when not enough room below
            const shouldOpenUp =
                placement === 'top' ||
                (placement === 'bottom' && spaceBelow < MAX_MENU_HEIGHT && spaceAbove > spaceBelow);

            if (shouldOpenUp) {
                setCoords({
                    bottom: window.innerHeight - rect.top + GAP,
                    left: safeLeft,
                    width: menuWidth
                });
            } else {
                setCoords({
                    top: rect.bottom + GAP,
                    left: safeLeft,
                    width: menuWidth
                });
            }
        }
    }, [placement]);

    // Handle Open
    const handleToggle = () => {
        if (disabled) return;
        if (!isOpen) {
            updatePosition();
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    // Close on click outside (Handling both Portal and Button)
    useEffect(() => {
        if (!isOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isButton = containerRef.current?.contains(target);
            const isMenu = listboxRef.current?.contains(target);

            if (!isButton && !isMenu) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
             if(isOpen) setIsOpen(false); 
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    // Handle Keyboard
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'Escape') {
            setIsOpen(false);
            buttonRef.current?.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
        }
    };

    const handleSelect = useCallback((val: T) => {
        onChange(val);
        setIsOpen(false);
        buttonRef.current?.focus();
    }, [onChange]);

    const selectedOption = options?.find(opt => opt.value === value);
    const displayPlaceholder = placeholder || t('common.select');

    let buttonClass = STYLES.BUTTON;
    if (disabled) buttonClass += ` ${STYLES.DISABLED}`;
    else if (error) buttonClass += ` ${STYLES.ERROR}`;
    else buttonClass += ` ${STYLES.DEFAULT}`;
    
    if (isOpen && !disabled) buttonClass += ` ${STYLES.OPEN}`;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className={`${STYLES.LABEL} ${error ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400'}`}>
                    {label}
                </label>
            )}
            
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={label || displayPlaceholder}
                disabled={disabled}
                onClick={handleToggle}
                onKeyDown={handleKeyDown}
                className={buttonClass}
            >
                <div className="flex items-center gap-2 truncate flex-1 text-left">
                    {icon && <span className={error ? "text-rose-400" : "text-slate-400 dark:text-slate-500"}>{icon}</span>}
                    {selectedOption ? (
                        <span className="font-medium truncate flex items-center gap-2">
                            {selectedOption.icon}
                            {selectedOption.label}
                        </span>
                    ) : (
                        <span className={error ? "text-rose-400" : "text-slate-400 dark:text-slate-500"}>{displayPlaceholder}</span>
                    )}
                </div>
                
                <div className={`text-slate-400 dark:text-slate-500 ${isOpen ? 'rotate-180 text-indigo-500 dark:text-indigo-400' : ''} transition-transform duration-200`}>
                    {ICONS.CHEVRON}
                </div>
            </button>

            {/* Portal Menu */}
            {isOpen && createPortal(
                <div 
                    ref={listboxRef}
                    role="listbox"
                    tabIndex={-1}
                    className={STYLES.MENU}
                    style={{ 
                        // Use coords directly — auto-flip may have changed direction vs placement prop
                        ...(coords.bottom !== undefined ? { bottom: coords.bottom } : { top: coords.top }),
                        left: coords.left, 
                        width: coords.width,
                        transformOrigin: coords.bottom !== undefined ? 'bottom center' : 'top center'
                    }}
                >
                    {options?.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center italic select-none">{t('common.no_options')}</div>
                    ) : (
                        options?.map((opt) => {
                            const isSelected = opt.value === value;
                            return (
                                <button
                                    key={String(opt.value)}
                                    role="option"
                                    aria-selected={isSelected}
                                    type="button"
                                    onClick={() => handleSelect(opt.value as T)}
                                    className={`${STYLES.OPTION} ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {opt.icon && (
                                        <span className={`transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
                                            {opt.icon}
                                        </span>
                                    )}
                                    <span className="truncate flex-1">{opt.label}</span>
                                    {isSelected && ICONS.CHECK}
                                </button>
                            );
                        })
                    )}
                </div>,
                document.body
            )}
        </div>
    );
});

(Dropdown as React.FC).displayName = 'Dropdown';
