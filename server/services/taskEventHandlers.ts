import { agentMemoryService } from './agentMemoryService';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { logger } from '../middleware/logger';
import { withTenantContext } from '../db';

type TaskEvent = {
  id: string;
  tenant_id: string;
  event_id: string;
  event_type: string;
  payload_json: Record<string, unknown> | null;
};

const TASK_NS = 'agent:task-events';
const OWNER_NS = 'owner_profile';

async function taskRow(tenantId: string, taskId: string): Promise<any> {
  return withTenantContext(tenantId, async (client: any) =>
    (await client.query('SELECT id,title,status,priority,deadline FROM wf_tasks WHERE tenant_id=$1 AND id=$2', [tenantId, taskId])).rows[0] || null);
}

/** Ghi memory procedural: mỗi event task là 1 kinh nghiệm vận hành của đội agent. */
async function rememberTaskEvent(event: TaskEvent, key: string, importance: number) {
  try {
    const p = event.payload_json || {};
    await agentMemoryService.remember(
      event.tenant_id, TASK_NS, key,
      'Event ' + event.event_type + ' ' + JSON.stringify(p).slice(0, 300),
      'episodic', importance, 90,
    );
  } catch (err: any) {
    logger.warn('[TaskEvents] remember failed: ' + (err?.message || err));
  }
}

/** Ghi signal: mọi event task thành 1 tín hiệu đo được cho KPI/learning. */
async function recordTaskSignal(event: TaskEvent, payloadExtra: Record<string, unknown>) {
  try {
    const p = event.payload_json || {};
    await agentMemoryService.recordSignal(event.tenant_id, {
      signalType: 'task_event:' + event.event_type,
      actorId: 'AGENT',
      subjectType: 'task',
      subjectId: String(p.taskId || event.event_id),
      payload: { ...p, ...payloadExtra },
      provenance: 'task_event_handler',
    });
  } catch (err: any) {
    logger.warn('[TaskEvents] signal failed: ' + (err?.message || err));
  }
}


/** task.created — ghi nhận + nhắc deadline nếu gấp. */
export async function onTaskCreated(event: TaskEvent) {
  const p: any = event.payload_json || {};
  // PHA1: task co the chua commit khi event den (emit cung transaction) — retry nhe
  let t: any = p.taskId ? await taskRow(event.tenant_id, p.taskId) : null;
  if (!t && p.taskId) {
    for (let i = 0; i < 3 && !t; i++) {
      await new Promise(r => setTimeout(r, 1500));
      t = await taskRow(event.tenant_id, p.taskId);
    }
  }
  await rememberTaskEvent(event, 'created:' + (p.taskId || event.event_id), 0.6);
  await recordTaskSignal(event, { title: p.title, priority: p.priority, hasDeadline: !!t?.deadline });
  const deadline = (t as any)?.due_date || (t as any)?.deadline;
  if (deadline) {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (days <= 2) {
      await agentMemoryService.remember(event.tenant_id, TASK_NS, 'urgent:' + t.id,
        'Task ' + String(t.title).slice(0, 100) + ' deadline con ' + days + ' ngay - can uu tien, taskId ' + t.id,
        'fact', 0.8, 7);
    }
  }
}

/** task.status_changed — học quy trình hoàn thành; đếm tốc độ. */
export async function onTaskStatusChanged(event: TaskEvent) {
  const p: any = event.payload_json || {};
  await rememberTaskEvent(event, 'status:' + (p.taskId || event.event_id) + ':' + (p.to || '?'), 0.5);
  await recordTaskSignal(event, { from: p.from, to: p.to });
  if (p.to === 'done') {
    await agentMemoryService.remember(event.tenant_id, TASK_NS, 'done-pattern:' + (p.taskId || event.event_id),
      'Task ' + String(p.taskId || '').slice(0, 40) + ' hoan thanh. Ghi chu: ' + String(p.note || '').slice(0, 200),
      'procedural', 0.5, 180);
  }
}

/** task.assigned — theo dõi ai đang giữ việc (hàm ý tải của người). */
export async function onTaskAssigned(event: TaskEvent) {
  const p: any = event.payload_json || {};
  await rememberTaskEvent(event, 'assigned:' + (p.taskId || event.event_id), 0.4);
  await recordTaskSignal(event, { userId: p.userId });
}

/** task.commented — ghi ngữ cảnh thảo luận để agent nắm mạch việc. */
export async function onTaskCommented(event: TaskEvent) {
  const p: any = event.payload_json || {};
  await rememberTaskEvent(event, 'comment:' + (p.commentId || event.event_id), 0.3);
  await recordTaskSignal(event, {});
}

/** Đăng ký tất cả task handlers vào daemon registry (gọi 1 lần khi boot). */
export function registerTaskEventHandlers(register: (t: string, h: (e: any) => Promise<void>) => void) {
  register('task.created', onTaskCreated);
  register('task.status_changed', onTaskStatusChanged);
  register('task.assigned', onTaskAssigned);
  register('task.commented', onTaskCommented);
}

