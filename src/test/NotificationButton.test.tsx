import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationButton } from '../../components/Navigation';

vi.mock('../../services/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('NotificationButton rail layout', () => {
    it('aligns the bell, label, and unread badge with expanded sidebar actions', () => {
        render(
            <NotificationButton
                placement="rail"
                expanded
                unreadCount={75}
                notifications={[]}
                onNavigate={() => {}}
            />,
        );

        const button = screen.getByRole('button', { name: 'nav.notifications' });
        expect(button).toHaveClass('justify-start', 'gap-3', 'px-3');
        expect(button.firstElementChild).toHaveClass('h-5', 'w-5');
        expect(screen.getByText('nav.notifications')).toBeInTheDocument();
        expect(screen.getByText('75')).toHaveClass('right-2');
    });
});