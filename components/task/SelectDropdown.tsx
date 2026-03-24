import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  dot?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  height?: number;
  error?: boolean;
}

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  className = '',
  height = 38,
  error = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const openMenu = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const GAP = 4;
    const MENU_MAX = 280;
    const menuW = Math.max(rect.width, 140);
    const safeLeft = Math.min(rect.left, window.innerWidth - menuW - 8);
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = spaceBelow < MENU_MAX && spaceAbove > spaceBelow;
    if (openUp) {
      setCoords({ bottom: window.innerHeight - rect.top + GAP, left: safeLeft, width: menuW });
    } else {
      setCoords({ top: rect.bottom + GAP, left: safeLeft, width: menuW });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleOut = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleOut);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleOut);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => open ? setOpen(false) : openMenu()}
        style={{ height }}
        className={`w-full flex items-center justify-between gap-2 px-3 text-sm bg-[var(--glass-surface-hover)] border rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors ${error ? 'border-rose-400' : open ? 'border-indigo-400 ring-2 ring-indigo-500/20' : 'border-[var(--glass-border)] hover:border-indigo-300'} ${className}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {selected?.dot && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selected.dot}`} />
          )}
          <span className={`truncate ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', zIndex: 9999, ...coords, maxHeight: 280 }}
          className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        >
          <div className="overflow-y-auto no-scrollbar py-1">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)]'}`}
              >
                {opt.dot && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />}
                <span className="flex-1 truncate">{opt.label}</span>
                {value === opt.value && <Check size={13} className="flex-shrink-0 text-indigo-500" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
