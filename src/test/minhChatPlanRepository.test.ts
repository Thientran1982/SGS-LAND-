import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, withTenantContext } = vi.hoisted(() => ({
    query: vi.fn(),
    withTenantContext: vi.fn(),
}));

vi.mock('../../server/db', () => ({ withTenantContext }));

import { minhChatPlanRepository } from '../../server/repositories/minhChatPlanRepository';

const row = {
    id: 'plan-1',
    title: 'Tạo lead mới',
    steps: [{ id: 'create-lead.open', title: 'Mở mục Leads.', status: 'IN_PROGRESS' }],
    updated_at: new Date('2026-09-25T12:00:00.000Z'),
};

describe('Minh chat plan ownership and progress', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        withTenantContext.mockImplementation((_tenantId: string, run: (client: any) => Promise<unknown>) => run({ query }));
    });

    it('loads a plan only for the authenticated tenant, user, and conversation', async () => {
        query.mockResolvedValueOnce({ rows: [row] });

        const result = await minhChatPlanRepository.findForSession('tenant-a', 'user-a', 'session-a');

        expect(result?.id).toBe('plan-1');
        expect(withTenantContext).toHaveBeenCalledWith('tenant-a', expect.any(Function));
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE tenant_id = $1 AND user_id = $2 AND session_id = $3'),
            ['tenant-a', 'user-a', 'session-a'],
        );
    });

    it('updates only a step in the matching user conversation', async () => {
        query
            .mockResolvedValueOnce({ rows: [row] })
            .mockResolvedValueOnce({
                rows: [{
                    ...row,
                    steps: [{ ...row.steps[0], status: 'COMPLETED' }],
                    updated_at: new Date('2026-09-25T12:01:00.000Z'),
                }],
            });

        const result = await minhChatPlanRepository.updateStep(
            'tenant-a',
            'user-a',
            'session-a',
            'create-lead.open',
            'COMPLETED',
        );

        expect(result?.steps[0].status).toBe('COMPLETED');
        expect(query.mock.calls[0][1]).toEqual(['tenant-a', 'user-a', 'session-a']);
        expect(query.mock.calls[1][1]).toEqual([
            'tenant-a',
            'user-a',
            'session-a',
            JSON.stringify([{ ...row.steps[0], status: 'COMPLETED' }]),
        ]);
    });

    it('does not update when the requested step is not part of that plan', async () => {
        query.mockResolvedValueOnce({ rows: [row] });

        const result = await minhChatPlanRepository.updateStep(
            'tenant-a',
            'user-a',
            'session-a',
            'another-conversation-step',
            'COMPLETED',
        );

        expect(result).toBeNull();
        expect(query).toHaveBeenCalledTimes(1);
    });
});