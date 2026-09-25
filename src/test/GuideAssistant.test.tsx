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
            : path.startsWith('/api/live-chat/plans/')
                ? Promise.resolve({ plan: null })
                : Promise.resolve({ data: [] }));
        apiPost.mockImplementation((path: string) => path === '/api/live-chat/chat'
            ? Promise.resolve({ response: 'Đã tìm thấy hướng dẫn phù hợp.' })
            : Promise.resolve({}));
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

    it('keeps To-dos empty when a prose answer has no structured plan', async () => {
        apiPost.mockResolvedValueOnce({
            response: '1. Mở mục Leads. 2. Chọn Tạo lead mới.',
        });
        render(<GuideAssistant open onClose={vi.fn()} />);

        expect(await screen.findByText('guide.todos_empty')).toBeTruthy();
        fireEvent.change(screen.getByRole('textbox', { name: 'guide.placeholder' }), {
            target: { value: 'Làm thế nào để tạo lead mới?' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'guide.send' }));

        expect(await screen.findByText('1. Mở mục Leads. 2. Chọn Tạo lead mới.')).toBeTruthy();
        expect(screen.getByText('guide.todos_empty')).toBeTruthy();
    });

    it('shows structured guide steps and persists progress by conversation', async () => {
        const plan = {
            id: 'plan-1',
            title: 'Tạo lead mới',
            steps: [
                { id: 'create-lead.open', title: 'Mở mục Leads trên thanh điều hướng.', status: 'PENDING' },
                { id: 'create-lead.start', title: 'Chọn Tạo lead mới.', status: 'PENDING' },
            ],
            updatedAt: '2026-09-25T12:00:00.000Z',
        };
        let savedPlan = plan;
        apiPost.mockImplementation((path: string, body: any) => {
            if (path === '/api/live-chat/chat') return Promise.resolve({ response: 'Hướng dẫn tạo lead.', plan });
            if (path.includes('/steps/')) {
                savedPlan = {
                    ...plan,
                    steps: plan.steps.map(step => step.id === path.split('/').pop()
                        ? { ...step, status: body.status }
                        : step),
                };
                return Promise.resolve({ plan: savedPlan });
            }
            return Promise.resolve({});
        });
        render(<GuideAssistant open onClose={vi.fn()} />);

        fireEvent.change(screen.getByRole('textbox', { name: 'guide.placeholder' }), {
            target: { value: 'Làm thế nào để tạo lead mới?' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'guide.send' }));

        expect(await screen.findByText('Tạo lead mới')).toBeTruthy();
        expect(screen.getByText('0/2')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {
            name: 'guide.plan_mark_in_progress: Mở mục Leads trên thanh điều hướng.',
        }));
        await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/live-chat\/plans\/.+\/steps\/create-lead\.open$/),
            { status: 'IN_PROGRESS' },
        ));

        fireEvent.click(screen.getByRole('button', {
            name: 'guide.plan_mark_completed: Mở mục Leads trên thanh điều hướng.',
        }));
        await waitFor(() => expect(screen.getByText('1/2')).toBeTruthy());
        expect(savedPlan.steps[0].status).toBe('COMPLETED');
    });
});