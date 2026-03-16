
import React, { useState, memo, useMemo } from 'react';
import { User } from '../types';
import { useTranslation } from '../services/i18n';
import { ROUTES } from '../config/routes';
// import { TenantSwitcher } from './TenantSwitcher';

interface CommandCenterProps {
    title: string;
    user: User;
    onSearch: () => void;
    onMenuClick?: () => void;
    onNavigate: (path: string) => void;
    isProfileActive?: boolean;
}

// -----------------------------------------------------------------------------
// 1. ASSETS
// -----------------------------------------------------------------------------

const ICONS = {
    MENU: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
    SEARCH: <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    SEARCH_MOBILE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
};

// -----------------------------------------------------------------------------
// 2. SUB-COMPONENTS
// -----------------------------------------------------------------------------

const UserAvatar = memo(({ user, isActive }: { user: User, isActive?: boolean }) => {
    const [imgError, setImgError] = useState(false);

    // Reset error state whenever the avatar URL changes (e.g., after profile save)
    React.useEffect(() => {
        setImgError(false);
    }, [user.avatar]);

    return (
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full p-0.5 border-2 shadow-lg transition-all duration-300 relative overflow-hidden flex items-center justify-center bg-[var(--glass-surface-hover)] dark:bg-slate-800
            ${isActive 
                ? 'border-indigo-500 shadow-indigo-500/20' 
                : 'border-white dark:border-white/10 group-hover:border-indigo-500 group-hover:shadow-indigo-500/20'}`
        }>
            {!imgError ? (
                <img 
                    src={user.avatar} 
                    className="w-full h-full rounded-full object-cover" 
                    alt={user.name}
                    onError={() => setImgError(true)} 
                />
            ) : (
                <span className="text-sm font-bold text-[var(--text-tertiary)]">
                    {user.name.charAt(0).toUpperCase()}
                </span>
            )}
        </div>
    );
});

// -----------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -----------------------------------------------------------------------------

export const CommandCenter: React.FC<CommandCenterProps> = memo(({ 
    title, 
    user, 
    onSearch, 
    onMenuClick, 
    onNavigate, 
    isProfileActive 
}) => {
    const { t } = useTranslation();
    
    return (
        <div className="h-16 sm:h-20 px-4 sm:px-6 md:px-8 flex items-center justify-between relative z-30 transition-all duration-300 group/header rounded-none sm:rounded-t-[24px] -mx-[1px] -mt-[1px]">
            {/* Background Blur Layer */}
            <div className="absolute inset-0 bg-[var(--bg-surface)]/80 backdrop-blur-xl border-b border-[var(--glass-border)] shadow-sm z-0 rounded-none sm:rounded-t-[24px]"></div>

            {/* LEFT: Context Breadcrumbs & Mobile Menu */}
            <div className="flex items-center gap-3 sm:gap-4 relative z-10 min-w-0 flex-1 sm:flex-none mr-2">
                <button 
                    onClick={onMenuClick}
                    className="md:hidden p-2 -ml-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] dark:hover:bg-[var(--bg-surface)]/10 rounded-xl transition-colors active:scale-95 shrink-0"
                    aria-label={t('common.menu')}
                >
                    {ICONS.MENU}
                </button>

                <div className="flex flex-col justify-center animate-enter min-w-0">
                    <h1 className="text-sm sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight leading-none truncate w-full">
                        {title}
                    </h1>
                </div>
            </div>

            {/* MIDDLE: Global Search Trigger (Desktop) */}
            <div className="hidden md:flex flex-1 max-w-lg mx-4 lg:mx-12 relative z-10">
                <button 
                    onClick={onSearch}
                    aria-label={t('common.search')}
                    className="w-full group relative flex items-center justify-between bg-[var(--glass-surface-hover)]/50 dark:bg-[var(--bg-surface)]/5 border border-[var(--glass-border)] dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-surface)] dark:hover:bg-[var(--bg-surface)]/10 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98]"
                >
                    <div className="flex items-center gap-3">
                        {ICONS.SEARCH}
                        <span className="font-medium">{t('common.search')}</span>
                    </div>
                    {/* <div className="hidden lg:flex items-center gap-1">
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-[var(--bg-surface)]/10 rounded border border-slate-300 dark:border-white/20">⌘</kbd>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-[var(--bg-surface)]/10 rounded border border-slate-300 dark:border-white/20">K</kbd>
                    </div> */}
                </button>
            </div>

            {/* RIGHT: Actions & Profile */}
            <div className="flex items-center gap-2 sm:gap-3 relative z-10 shrink-0">
                {/* <div className="hidden lg:block mr-2">
                    <TenantSwitcher />
                </div> */}

                {/* Mobile Search Icon */}
                <button onClick={onSearch} className="md:hidden p-2 text-[var(--text-tertiary)] hover:bg-[var(--glass-surface-hover)] rounded-xl active:scale-95 transition-transform">
                    {ICONS.SEARCH_MOBILE}
                </button>

                <button 
                    onClick={() => onNavigate(ROUTES.PROFILE)}
                    className="flex items-center gap-2 sm:gap-3 pl-1 group cursor-pointer outline-none"
                    title={t('menu.profile')}
                    aria-label={t('menu.profile')}
                >
                    <div className="text-right hidden sm:block leading-tight">
                        <div className={`text-sm font-bold transition-colors ${isProfileActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-primary)] group-hover:text-indigo-600'}`}>
                            {user.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)] font-medium">
                            {t(`role.${user.role}`) || user.role}
                        </div>
                    </div>
                    
                    <UserAvatar user={user} isActive={isProfileActive} />
                </button>
            </div>
        </div>
    );
});

CommandCenter.displayName = 'CommandCenter';
