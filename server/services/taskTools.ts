import { v4 as uuidv4 } from 'uuid';
import { withTenantContext } from '../db';
import { agentAuditRepository } from '../repositories/agentAuditRepository';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';

/**
 * P0 agentic tasks: Task tools cho agent (task_create / task_list /
 * task_update_status / task_assign / task_comment).
 *
 * Nguyen tac (Chien luoc Agentic 2026 - Phan A.4):
 *  - Ranh gioi quyen han ro rang: tool ghi luon qua guardrails,
 *    operation roi ro cao (assign) khong tu choi bang chinh sach giay.
 *  - Moi thao tac GHI dau audit trail (TOOL_EXECUTION) + task_activity_logs.
 *  - Event hoa task.* vao agent_operating_events de daemon lang nghe (Pha 1).
 */

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

type TaskRow = Record<string, any>;

async function auditTaskTool(
    tenantId: string,
    toolName: string,
    input: Record<string, any>,
    output: Record<string, any> | any[],
    ok: boolean,
): Promise<void> {
    try {
        await agentAuditRepository.record(tenantId, {
            eventKey: `task-tool:${toolName}:${uuidv4()}`,
            eventType: 'TOOL_EXECUTION',
            direction: 'OUTBOUND',
            toolName,
            entityType: 'task',
            entityId: String((output as any)?.id || (input as any)?.id || ''),
            status: ok ? 'SUCCESS' : 'FAILED',
            input,
            output,
            metadata: { surface: 'agent_task_tools' },
        });
    } catch (err) {
        console.warn('[taskTools] audit failed:', (err as Error).message);
    }
}

async function emitTaskEvent(
    tenantId: string,
    eventType: 'task.created' | 'task.status_changed' | 'task.assigned' | 'task.commented',
    payload: Record<string, unknown>,
    idempotencyKey: string,
): Promise<void> {
    try {
        await agentOperatingRepository.enqueueEvent(tenantId, {
            eventId: uuidv4(),
            eventType,
            actor: 'AGENT',
            idempotencyKey,
            payload,
        });
    } catch (err) {
        console.warn('[taskTools] emit event failed:', (err as Error).message);
    }
}

function scrubTask(row: TaskRow): TaskRow {
    return { ...row };
}
/** task_create - tao cong viec moi theo luong Lead -> Hop dong */
export async function handle_task_create(args: Record<string, any>): Promise<any> {
    const tenantId = String(args.tenantId || DEFAULT_TENANT_ID);
    const title = String(args.title || '').trim();
    const description = args.description ? String(args.description) : null;
    const category = args.category ? String(args.category) : null;
    const priority = ['low', 'medium', 'high', 'urgent'].includes(String(args.priority || '').toLowerCase()) ? String(args.priority).toLowerCase() : 'medium';
    const dueInDays = Number(args.dueInDays) > 0 ? Math.floor(Number(args.dueInDays)) : 3;

    if (!title) throw new Error('task_create: title la bat buoc');

    const row = await withTenantContext(tenantId, async (client: any) => {
        const r = await client.query(
            `INSERT INTO wf_tasks (tenant_id, title, description, category, status, priority, deadline, estimated_hours)
             VALUES ($1, $2, $3, $4, 'todo', $5, CURRENT_DATE + $6::int, 1.5)
             RETURNING *`,
            [tenantId, title, description, category, priority, dueInDays],
        );
        await client.query(
            `INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
             VALUES ($1, $2, NULL, 'created', 'Agent tao cong viec')`,
            [tenantId, r.rows[0].id],
        );
        return r.rows[0];
    });

    await emitTaskEvent(tenantId, 'task.created',
        { taskId: row.id, title, category, priority }, `task-created:${row.id}`);
    await auditTaskTool(tenantId, 'task_create', args, scrubTask(row), true);
    return scrubTask(row);
}

/** task_list - danh sach cong viec theo filter */
export async function handle_task_list(args: Record<string, any>): Promise<any> {
    const tenantId = String(args.tenantId || DEFAULT_TENANT_ID);
    const status = args.status ? String(args.status) : null;
    const category = args.category ? String(args.category) : null;
    const limit = Math.min(Number(args.limit) || 20, 100);

    const rows = await withTenantContext(tenantId, async (client: any) => {
        const r = await client.query(
            `SELECT id, title, description, category, status, priority, deadline, estimated_hours, actual_hours, created_at, updated_at
             FROM wf_tasks
             WHERE tenant_id = $1
               AND ($2::varchar IS NULL OR status = $2)
               AND ($3::varchar IS NULL OR category = $3)
             ORDER BY CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, deadline ASC
             LIMIT $4`,
            [tenantId, status, category, limit],
        );
        return r.rows;
    });

    await auditTaskTool(tenantId, 'task_list', args, { count: rows.length }, true);
    return { count: rows.length, tasks: rows.map(scrubTask) };
}

/** task_update_status - cap nhat trang thai (todo/in_progress/done/cancelled) */
export async function handle_task_update_status(args: Record<string, any>): Promise<any> {
    const tenantId = String(args.tenantId || DEFAULT_TENANT_ID);
    const id = String(args.id || '');
    const newStatus = String(args.status || '');
    const note = args.note ? String(args.note) : null;
    const VALID = new Set(['todo', 'in_progress', 'review', 'done', 'cancelled']);
    if (!id) throw new Error('task_update_status: id la bat buoc');
    if (!VALID.has(newStatus)) throw new Error(`task_update_status: status khong hop le (${[...VALID].join('|')})`);

    const row = await withTenantContext(tenantId, async (client: any) => {
        const cur = await client.query('SELECT status FROM wf_tasks WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (cur.rows.length === 0) throw new Error('Khong tim thay cong viec');
        const oldStatus = cur.rows[0].status;
        const r = await client.query(
            `UPDATE wf_tasks SET status = $1, completion_note = COALESCE($2, completion_note),
                    actual_hours = CASE WHEN $1::varchar = 'done' AND actual_hours IS NULL THEN estimated_hours ELSE actual_hours END,
                    updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND tenant_id = $4 RETURNING *`,
            [newStatus, note, id, tenantId],
        );
        await client.query(
            `INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
             VALUES ($1, $2, NULL, 'status_changed', $3)`,
            [tenantId, id, `Agent chuyen ${oldStatus} -> ${newStatus}${note ? ` (${note})` : ''}`],
        );
        return { ...r.rows[0], oldStatus };
    });

    await emitTaskEvent(tenantId, 'task.status_changed',
        { taskId: id, from: row.oldStatus, to: newStatus, note }, `task-status:${id}:${newStatus}`);
    await auditTaskTool(tenantId, 'task_update_status', args, scrubTask(row), true);
    return scrubTask(row);
}
/** task_assign - gan nguoi phu trach (hanh dong roi ro cao -> audit + event du) */
export async function handle_task_assign(args: Record<string, any>): Promise<any> {
    const tenantId = String(args.tenantId || DEFAULT_TENANT_ID);
    const taskId = String(args.taskId || '');
    const userId = String(args.userId || '');
    if (!taskId || !userId) throw new Error('task_assign: taskId va userId la bat buoc');

    const row = await withTenantContext(tenantId, async (client: any) => {
        const task = await client.query('SELECT id, title FROM wf_tasks WHERE id = $1 AND tenant_id = $2', [taskId, tenantId]);
        if (task.rows.length === 0) throw new Error('Khong tim thay cong viec');
        const user = await client.query('SELECT id, email FROM users WHERE id = $1 AND tenant_id = $2', [userId, tenantId]);
        if (user.rows.length === 0) throw new Error('Khong tim thay nguoi dung');
        const r = await client.query(
            `INSERT INTO task_assignments (tenant_id, task_id, user_id, assigned_by, is_primary)
             SELECT $1, $2, $3, NULL, true
             WHERE NOT EXISTS (SELECT 1 FROM task_assignments WHERE task_id = $2 AND user_id = $3)
             RETURNING *`,
            [tenantId, taskId, userId],
        );
        if (r.rows.length === 0) {
            r.rows.push({ task_id: taskId, user_id: userId, is_primary: true });
        }
        await client.query(
            `INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
             VALUES ($1, $2, $3, 'assigned', 'Agent gan phu trach')`,
            [tenantId, taskId, userId],
        );
        return { assignment: r.rows[0], taskTitle: task.rows[0].title, userEmail: user.rows[0].email };
    });

    await emitTaskEvent(tenantId, 'task.assigned',
        { taskId, userId }, `task-assigned:${taskId}:${userId}`);
    await auditTaskTool(tenantId, 'task_assign', args, row, true);
    return row;
}

/** task_comment - ghi chu nghiep vu vao task */
export async function handle_task_comment(args: Record<string, any>): Promise<any> {
    const tenantId = String(args.tenantId || DEFAULT_TENANT_ID);
    const taskId = String(args.taskId || '');
    const content = String(args.content || '').trim();
    if (!taskId || !content) throw new Error('task_comment: taskId va content la bat buoc');

    const row = await withTenantContext(tenantId, async (client: any) => {
        const task = await client.query('SELECT id FROM wf_tasks WHERE id = $1 AND tenant_id = $2', [taskId, tenantId]);
        if (task.rows.length === 0) throw new Error('Khong tim thay cong viec');
        const adminRes = await client.query(
            `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('SUPER_ADMIN','ADMIN') ORDER BY created_at LIMIT 1`,
            [tenantId],
        );
        const userId = adminRes.rows[0]?.id || null;
        const r = await client.query(
            `INSERT INTO task_comments (tenant_id, task_id, user_id, content)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [tenantId, taskId, userId, content],
        );
        return r.rows[0];
    });

    await emitTaskEvent(tenantId, 'task.commented',
        { taskId, commentId: row.id }, `task-comment:${row.id}`);
    await auditTaskTool(tenantId, 'task_comment', args, row, true);
    return row;
}
