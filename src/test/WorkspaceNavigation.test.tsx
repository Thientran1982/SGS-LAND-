import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { buildWorkspaceHubs, WorkspaceNavigation } from '../../components/WorkspaceNavigation';
import { ROUTES } from '../../config/routes';
import type { NavGroup } from '../../types';

vi.mock('../../services/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        formatDateTime: (value: string) => value,
    }),
}));

vi.mock('../../components/Navigation', () => ({
    NotificationButton: () => null,
    UserAvatar: () => null,
}));

vi.mock('../../services/websocket', () => ({
    socket: { on: vi.fn(), off: vi.fn() },
}));

vi.mock('../../services/dbApi', () => ({
    db: { getInboxThreads: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../components/Logo', () => ({
    Logo: () => null,
}));

const roleMenu = (routes: string[]): NavGroup[] => [{
    id: 'role-menu',
    labelKey: 'menu',
    items: routes.map(route => ({
        id: route,
        labelKey: `menu.${route}`,
        route,
        iconKey: route,
    })),
}] as unknown as NavGroup[];

describe('buildWorkspaceHubs', () => {
    it('keeps every role-authorized route once and groups the added pages intentionally', () => {
        const routes = [
            ROUTES.DASHBOARD,
            ROUTES.LEADS,
            ROUTES.INVENTORY,
            ROUTES.CHECKOUT,
            ROUTES.COMMISSIONS,
            ROUTES.AI_EVALUATION,
            ROUTES.MARKETPLACE,
            ROUTES.CHECKOUT,
        ];
        const hubs = buildWorkspaceHubs(roleMenu(routes));
        const visibleRoutes = hubs.flatMap(hub => hub.items.map(item => item.route));

        expect(new Set(visibleRoutes).size).toBe(visibleRoutes.length);
        expect(visibleRoutes).toEqual(expect.arrayContaining([...new Set(routes), ROUTES.PROFILE]));
        expect(hubs.find(hub => hub.id === 'deals')?.items.map(item => item.route))
            .toEqual(expect.arrayContaining([ROUTES.CHECKOUT, ROUTES.COMMISSIONS]));
        expect(hubs.find(hub => hub.id === 'ai')?.items.map(item => item.route))
            .toContain(ROUTES.AI_EVALUATION);
        expect(hubs.find(hub => hub.id === 'settings')?.items.map(item => item.route))
            .toContain(ROUTES.MARKETPLACE);
    });

    it('does not expose routes outside the supplied role menu, except the signed-in profile link', () => {
        const hubs = buildWorkspaceHubs(roleMenu([ROUTES.DASHBOARD]));
        const visibleRoutes = hubs.flatMap(hub => hub.items.map(item => item.route));

        expect(visibleRoutes).toEqual([ROUTES.DASHBOARD, ROUTES.PROFILE]);
    });

    it('keeps existing page content inside the redesigned shell', () => {
        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <WorkspaceNavigation
                {...({
                    activePage: ROUTES.DASHBOARD,
                    menuGroups: roleMenu([ROUTES.DASHBOARD, ROUTES.LEADS]),
                    user: { name: 'Test user', role: 'ADMIN' },
                    assistantOpen: false,
                    onNavigate: vi.fn(),
                    onLogout: vi.fn(),
                    onOpenAssistant: vi.fn(),
                    unreadCount: 0,
                    notifications: [],
                    onMarkRead: vi.fn(),
                    onMarkAllRead: vi.fn(),
                    onDeleteNotification: vi.fn(),
                    onDeleteAllRead: vi.fn(),
                    onSearch: vi.fn(),
                    onToggleTheme: vi.fn(),
                    onToggleLanguage: vi.fn(),
                    themeMode: 'light',
                    language: 'vn',
                } as any)}
            >
                <div>Existing dashboard content</div>
            </WorkspaceNavigation>
            </QueryClientProvider>,
        );

        expect(screen.getByText('Existing dashboard content')).toBeTruthy();
        expect(screen.getByRole('navigation', { name: 'shell.primary_navigation' })).toBeTruthy();
        expect(screen.getByRole('navigation', { name: 'shell.mobile_navigation' })).toBeTruthy();
    });
});