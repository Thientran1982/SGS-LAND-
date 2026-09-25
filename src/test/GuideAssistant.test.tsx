import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuideAssistant } from '../../components/GuideAssistant';

const { apiGet, apiPost } = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
}));

vi.mock('../../services/api/apiClient', () => ({
    api: { get: apiGet, post: apiPost },
}));

vi.mock('../../services/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        formatDateTime: (value: string) => value,
    }),
}));

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
});

const pendingApproval = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'PENDING',
    actionType: 'SEND_EMAIL',
    leadName: 'Test lead',
};

describe('GuideAssistant approval actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockImplementation((path: string) => path === '/api/approval-requests'
            ? Promise.resolve({ items: [pendingApproval], pendingCount: 1 })
            : Promise.resolve({ data: [] }));
        apiPost.mockResolvedValue({});
    });

    it('loads real pending approvals and executes through the governed approval route', async () => {
        render(
            <GuideAssistant
                open
                canApprove
                onClose={vi.fn()}
                onOpenApprovals={vi.fn()}
            />,
        );

        expect(await screen.findByText('Test lead')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'guide.approve_send' }));

        await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
            `/api/approval-requests/${pendingApproval.id}/approve`,
            {},
        ));
        await waitFor(() => expect(screen.queryByText('Test lead')).toBeNull());
    });

    it('marks ambiguous approval results unknown and prevents a blind retry', async () => {
        apiPost.mockRejectedValueOnce(new Error('response lost'));
        render(
            <GuideAssistant
                open
                canApprove
                onClose={vi.fn()}
                onOpenApprovals={vi.fn()}
            />,
        );

        expect(await screen.findByText('Test lead')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'guide.approve_send' }));

        expect((await screen.findAllByText('guide.approval_uncertain')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: 'guide.approve_send' })).toBeNull();
        expect(apiPost).toHaveBeenCalledTimes(1);
    });
});