// Sign out on mobile ("Thêm" sheet had no account/logout) + close desktop profile menu on outside click.
import fs from 'node:fs';
const DRY = !!process.env.DRY;
const report = [];
function patch(file, steps) {
  let src = fs.readFileSync(file, 'utf8');
  for (const [name, fn] of steps) {
    const next = fn(src);
    if (next === null || next === src) { report.push(`FAIL ${file}: ${name}`); return; }
    src = next;
  }
  if (!DRY) fs.writeFileSync(file, src);
  report.push(`OK   ${file} (${steps.length} steps)`);
}
const lit = (a, b) => (s) => (s.includes(a) ? s.replace(a, () => b) : null);

const ACCOUNT = `<div className="space-y-5">
                            {/* Account: profile + sign out (mobile had no way to log out) */}
                            <section aria-label={t('menu.profile')} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-2">
                                <div className="flex items-center gap-3 px-2 py-2">
                                    <UserAvatar user={user} isActive={activePage === ROUTES.PROFILE} />
                                    <div className="min-w-0 leading-tight">
                                        <div className="truncate text-sm font-bold text-[var(--text-primary)]">{user.name}</div>
                                        <div className="truncate text-xs text-[var(--text-tertiary)]">{t(\`role.\${user.role?.toUpperCase()}\`) || user.role}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setMoreOpen(false); onNavigate(ROUTES.PROFILE); }}
                                        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                                    >
                                        {t('menu.profile')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setMoreOpen(false); onLogout(); }}
                                        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--ui-danger)] hover:bg-[var(--glass-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                                    >
                                        <LogOut size={15} aria-hidden="true" />
                                        {t('menu.logout')}
                                    </button>
                                </div>
                            </section>`;

patch('components/WorkspaceNavigation.tsx', [
  ['mobile props type', lit('    onOpenAssistant: () => void;\n    inboxUnread?: number;\n}\n\nconst MobileNavigation',
    '    onOpenAssistant: () => void;\n    inboxUnread?: number;\n    user: WorkspaceNavigationProps[\'user\'];\n    onLogout: () => void;\n}\n\nconst MobileNavigation')],
  ['mobile props destructure', lit('    onOpenAssistant: _onOpenAssistant,\n    inboxUnread = 0,\n}) => {',
    '    onOpenAssistant: _onOpenAssistant,\n    inboxUnread = 0,\n    user,\n    onLogout,\n}) => {')],
  ['account section', lit('<div className="space-y-5">\n                            {hubs.map(hub => {', ACCOUNT + '\n                            {hubs.map(hub => {')],
  ['pass props', lit('                onOpenAssistant={onOpenAssistant}\n            />\n        </>\n    );\n};',
    '                onOpenAssistant={onOpenAssistant}\n                user={user}\n                onLogout={onLogout}\n            />\n        </>\n    );\n};')],
  // Desktop: the profile popover never closed on outside click / Escape.
  ['profile ref', lit('    const [profileOpen, setProfileOpen] = useState(false);\n',
    `    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!profileOpen) return;
        const onDown = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
        };
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [profileOpen]);
`)],
  ['profile wrapper ref', lit('<div className="relative flex w-full justify-center">\n                    {profileOpen && (',
    '<div ref={profileRef} className="relative flex w-full justify-center">\n                    {profileOpen && (')],
  ['useRef import', (s) => {
    const m = s.match(/import React,\s*\{([^}]*)\}\s*from 'react';/);
    if (!m) return null;
    if (/\buseRef\b/.test(m[1]) && /\buseEffect\b/.test(m[1])) return s + '\n';
    let names = m[1].split(',').map(x => x.trim()).filter(Boolean);
    for (const n of ['useRef', 'useEffect']) if (!names.includes(n)) names.push(n);
    return s.replace(m[0], `import React, { ${names.join(', ')} } from 'react';`);
  }],
]);
const s = fs.readFileSync('components/WorkspaceNavigation.tsx', 'utf8');
report.push('INFO interface WorkspaceNavigationProps: ' + /interface WorkspaceNavigationProps/.test(s) + '; UserAvatar: ' + /const UserAvatar/.test(s) + '; react import: ' + (s.match(/import React[^\n]*/) || [''])[0]);
console.log(report.join('\n'));
