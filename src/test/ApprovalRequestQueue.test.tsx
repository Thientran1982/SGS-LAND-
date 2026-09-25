import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalRequestArchiveHistory, ApprovalRequestQueue, type PendingApprovalRequest } from '../../components/approval/ApprovalRequestQueue';

describe('ApprovalRequestQueue', () => {
    it('shows non-outreach approvals and only offers actions for supported types', () => {
        const onApprove = vi.fn();
        const onReject = vi.fn();
        const onArchive = vi.fn();
        const requests: PendingApprovalRequest[] = [
            {
                id: 'lead-change',
                actionType: 'CHANGE_LEAD_STAGE',
                status: 'PENDING',
                leadName: 'Nguyễn An',
                reasoning: 'The lead confirmed they are ready for a viewing.',
                payload: { targetStage: 'QUALIFIED' },
            },
            {
                id: 'future-action',
                actionType: 'FUTURE_ACTION',
                status: 'PENDING',
                reasoning: 'Needs administrator review.',
                payload: { secret: 'must not be rendered' },
            },
            {
                id: 'outreach',
                actionType: 'DRAFT_OUTREACH',
                status: 'PENDING',
                reasoning: 'Rendered by the specialized outreach section.',
            },
        ];

        render(
            <ApprovalRequestQueue
                items={requests}
                language="vn"
                processingId={null}
                uncertainIds={new Set()}
                onApprove={onApprove}
                onReject={onReject}
                onArchive={onArchive}
            />,
        );

        const supportedCard = screen.getByTestId('approval-request-lead-change');
        expect(within(supportedCard).getByText('Chuyển giai đoạn khách hàng')).toBeInTheDocument();
        expect(within(supportedCard).getByText('Chuyển sang giai đoạn: QUALIFIED')).toBeInTheDocument();
        fireEvent.click(within(supportedCard).getByRole('button', { name: 'Duyệt và thực hiện' }));
        fireEvent.click(within(supportedCard).getByRole('button', { name: 'Từ chối' }));
        fireEvent.click(within(supportedCard).getByRole('button', { name: 'Từ chối + lưu trữ' }));
        expect(onApprove).toHaveBeenCalledWith('lead-change');
        expect(onReject).toHaveBeenCalledWith('lead-change');
        expect(onArchive).toHaveBeenCalledWith('lead-change');

        const unsupportedCard = screen.getByTestId('approval-request-future-action');
        expect(within(unsupportedCard).getByText('Loại yêu cầu này chưa được hỗ trợ trong màn hình phê duyệt.')).toBeInTheDocument();
        expect(within(unsupportedCard).queryByRole('button', { name: 'Duyệt và thực hiện' })).not.toBeInTheDocument();
        expect(within(unsupportedCard).queryByRole('button', { name: 'Từ chối' })).not.toBeInTheDocument();
        fireEvent.click(within(unsupportedCard).getByRole('button', { name: 'Từ chối + lưu trữ' }));
        expect(onArchive).toHaveBeenCalledWith('future-action');
        expect(screen.queryByText('must not be rendered')).not.toBeInTheDocument();
        expect(screen.queryByTestId('approval-request-outreach')).not.toBeInTheDocument();
    });

    it('does not offer actions for expired or outcome-uncertain requests', () => {
        render(
            <ApprovalRequestQueue
                items={[
                    {
                        id: 'expired',
                        actionType: 'SEND_DOCS',
                        status: 'PENDING',
                        expiresAt: '2000-01-01T00:00:00.000Z',
                        payload: { recipientEmail: 'client@example.com', documentIds: ['doc-1'] },
                    },
                    {
                        id: 'uncertain',
                        actionType: 'BOOK_VIEWING',
                        status: 'PENDING',
                        payload: { dateText: 'Thứ Sáu' },
                    },
                ]}
                language="vn"
                processingId={null}
                uncertainIds={new Set(['uncertain'])}
                onApprove={vi.fn()}
                onReject={vi.fn()}
                onArchive={vi.fn()}
            />,
        );

        expect(within(screen.getByTestId('approval-request-expired')).queryByRole('button', { name: 'Duyệt và thực hiện' })).not.toBeInTheDocument();
        expect(within(screen.getByTestId('approval-request-expired')).getByRole('button', { name: 'Từ chối + lưu trữ' })).toBeInTheDocument();
        expect(within(screen.getByTestId('approval-request-expired')).getByText('Đã hết hạn — không thể phê duyệt')).toBeInTheDocument();
        expect(within(screen.getByTestId('approval-request-uncertain')).queryByRole('button')).not.toBeInTheDocument();
        expect(within(screen.getByTestId('approval-request-uncertain')).getByRole('alert')).toBeInTheDocument();
    });

    it('shows archived rejection evidence in a separate read-only history', () => {
        const onLoadMore = vi.fn();
        render(
            <ApprovalRequestArchiveHistory
                items={[{
                    id: 'archived-one',
                    actionType: 'CHANGE_LEAD_STAGE',
                    status: 'REJECTED',
                    archiveReason: 'Yêu cầu không còn phù hợp.',
                    archivedBy: 'operator-id',
                    archivedByName: 'Nguyễn Quản lý',
                    archivedAt: '2026-09-26T10:00:00.000Z',
                }]}
                total={2}
                language="vn"
                loading={false}
                unavailable={false}
                loadingMore={false}
                onRetry={vi.fn()}
                onLoadMore={onLoadMore}
            />,
        );

        const history = screen.getByTestId('approval-archive-history');
        const entry = within(history).getByTestId('archived-approval-request-archived-one');
        expect(within(entry).getByText('Đã từ chối')).toBeInTheDocument();
        expect(within(entry).getByText('Yêu cầu không còn phù hợp.')).toBeInTheDocument();
        expect(within(entry).getByText('Nguyễn Quản lý')).toBeInTheDocument();
        expect(within(entry).getByText(/26\/9\/2026/)).toBeInTheDocument();
        expect(within(entry).queryByRole('button')).not.toBeInTheDocument();
        fireEvent.click(within(history).getByRole('button', { name: 'Tải thêm' }));
        expect(onLoadMore).toHaveBeenCalledOnce();
    });
});