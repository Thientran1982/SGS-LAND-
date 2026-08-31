/**
 * agentMcpRoutes.ts — P1.4: MCP client cho admin.
 * CRUD danh sach MCP server ngoai + test ket noi (JSON-RPC initialize).
 * Khi hoat dong, agent Minh co the goi tools cua server qua liveChatEngine
 * (buoc tiep theo: doi tool call -> MCP call theo bang nay).
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { apiRateLimit } from '../middleware/rateLimiter';

export const agentMcpRouter = Router();

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

agentMcpRouter.get('/', apiRateLimit, async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, name, url, transport, custom_instructions, enabled,
              tools_enabled, tools_disabled, last_status, last_checked_at, created_at
         FROM agent_mcp_servers WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [DEFAULT_TENANT],
    );
    res.json({ servers: r.rows });
  } catch (err: any) {
    logger.warn(`[MCP] list failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Khong tai duoc danh sach MCP server' });
  }
});

agentMcpRouter.post('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, url, transport, custom_instructions, enabled } = req.body || {};
    if (!name || !url) return res.status(400).json({ error: 'name va url la bat buoc' });
    if (!/^https?:\/\//.test(String(url))) {
      return res.status(400).json({ error: 'url phai bat dau bang http:// hoac https://' });
    }
    const r = await pool.query(
      `INSERT INTO agent_mcp_servers
         (tenant_id, name, url, transport, custom_instructions, enabled)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, url, transport, enabled, created_at`,
      [DEFAULT_TENANT, name, url, transport === 'sse' ? 'sse' : 'http',
       custom_instructions || null, enabled !== false],
    );
    return res.status(201).json({ server: r.rows[0] });
  } catch (err: any) {
    if (/duplicate key|unique constraint/i.test(err?.message || '')) {
      return res.status(409).json({ error: 'Ten MCP server da ton tai trong tenant' });
    }
    logger.warn(`[MCP] create failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Tao MCP server that bai' });
  }
});

agentMcpRouter.patch('/:id', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { enabled, custom_instructions, tools_disabled } = req.body || {};
    const r = await pool.query(
      `UPDATE agent_mcp_servers SET
         enabled = COALESCE($2, enabled),
         custom_instructions = COALESCE($3, custom_instructions),
         tools_disabled = COALESCE($4, tools_disabled),
         updated_at = NOW()
       WHERE id = $1 AND tenant_id = $5
       RETURNING id, name, url, enabled`,
      [req.params.id,
       typeof enabled === 'boolean' ? enabled : null,
       custom_instructions ?? null,
       Array.isArray(tools_disabled) ? tools_disabled : null,
       DEFAULT_TENANT],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'MCP server khong ton tai' });
    return res.json({ server: r.rows[0] });
  } catch (err: any) {
    logger.warn(`[MCP] patch failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Cap nhat that bai' });
  }
});

agentMcpRouter.delete('/:id', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      'DELETE FROM agent_mcp_servers WHERE id = $1 AND tenant_id = $2',
      [req.params.id, DEFAULT_TENANT],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'MCP server khong ton tai' });
    return res.json({ success: true });
  } catch (err: any) {
    logger.warn(`[MCP] delete failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Xoa that bai' });
  }
});

// POST /:id/test — gui JSON-RPC initialize + tools/list de kiem tra ket noi
agentMcpRouter.post('/:id/test', apiRateLimit, async (req: Request, res: Response) => {
  const startedMs = Date.now();
  try {
    const r = await pool.query(
      'SELECT id, url, transport FROM agent_mcp_servers WHERE id = $1 AND tenant_id = $2',
      [req.params.id, DEFAULT_TENANT],
    );
    const server = r.rows[0];
    if (!server) return res.status(404).json({ error: 'MCP server khong ton tai' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let fetchRes: any;
    try {
      fetchRes = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'sgs-agent', version: '1.0.0' } },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    let tools: any[] = [];
    try {
      const text = await fetchRes.text();
      const jsonStart = text.indexOf('{');
      const parsed = jsonStart >= 0 ? JSON.parse(text.slice(jsonStart)) : null;
      const rawTools = parsed?.result?.tools || parsed?.tools || [];
      tools = Array.isArray(rawTools) ? rawTools.map((t: any) => String(t?.name || '')).filter(Boolean).slice(0, 50) : [];
    } catch {
      tools = [];
    }
    const ok = fetchRes.status >= 200 && fetchRes.status < 300;
    await pool.query(
      `UPDATE agent_mcp_servers
         SET last_status = $2, last_checked_at = NOW(),
             tools_enabled = CASE WHEN $3::text[] = '{}'::text[] THEN tools_enabled ELSE $3 END
       WHERE id = $1`,
      [server.id, `${fetchRes.status}`, tools],
    );
    return res.json({
      reachable: ok,
      httpStatus: fetchRes.status,
      tools,
      durationMs: Date.now() - startedMs,
    });
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'timeout sau 8s' : String(err?.message || err);
    await pool.query(
      'UPDATE agent_mcp_servers SET last_status = $2, last_checked_at = NOW() WHERE id = $1',
      [req.params.id, `error: ${reason.slice(0, 100)}`],
    ).catch(() => undefined);
    logger.warn(`[MCP] test failed: ${reason}`);
    return res.status(502).json({ reachable: false, error: reason.slice(0, 300) });
  }
});

// GET /agent-tools — danh sach MCP tools agent Minh co the goi (mcp_<server>_<tool>)
agentMcpRouter.get('/agent-tools', apiRateLimit, async (_req: Request, res: Response) => {
  try {
    const { listEnabledMcpServers, listServerTools } = await import('../services/mcpClientService');
    const servers = await listEnabledMcpServers(DEFAULT_TENANT);
    const out: Array<{ server: string; tool: string; fullName: string; disabled: boolean }> = [];
    for (const s of servers) {
      const tools = await listServerTools(s as any);
      for (const t of tools) {
        out.push({
          server: s.name,
          tool: t,
          fullName: 'mcp_' + s.name + '_' + t,
          disabled: (s.tools_disabled || []).includes(t),
        });
      }
    }
    res.json({ tools: out });
  } catch (err: any) {
    logger.warn('[MCP] agent-tools failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong tai duoc danh sach MCP tools' });
  }
});
