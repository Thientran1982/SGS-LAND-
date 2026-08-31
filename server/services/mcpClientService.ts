/**
 * mcpClientService.ts — (a) MCP bridge cho liveChatEngine.
 * Agent Minh goi tool ngoai theo cong uoc ten: mcp_<server_name>_<tool_name>.
 * Service tra bang agent_mcp_servers (tenant-scoped, enabled) roi thuc thi
 * JSON-RPC tools/call voi timeout + cache danh sach tools 60s.
 */
import { pool } from '../db';
import { logger } from '../middleware/logger';

export interface McpServerRow {
  id: string;
  name: string;
  url: string;
  transport: 'http' | 'sse';
  custom_instructions: string | null;
  enabled: boolean;
  tools_disabled: string[];
}

export interface McpToolCallResult {
  ok: boolean;
  server: string;
  tool: string;
  content?: any;
  error?: string;
}

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const CALL_TIMEOUT_MS = 15_000;
const toolsCache = new Map<string, { names: string[]; expiresAt: number }>();
const TOOLS_CACHE_MS = 60_000;

export async function listEnabledMcpServers(tenantId: string = DEFAULT_TENANT): Promise<McpServerRow[]> {
  const r = await pool.query(
    `SELECT id, name, url, transport, custom_instructions, enabled, tools_disabled
       FROM agent_mcp_servers
       WHERE tenant_id = $1 AND enabled = TRUE`,
    [tenantId],
  );
  return r.rows as McpServerRow[];
}

async function rpc(url: string, body: Record<string, any>, timeoutMs = CALL_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    const jsonStart = text.indexOf('{');
    if (jsonStart < 0) throw new Error(`MCP server tra phan hoi khong hop le (HTTP ${res.status})`);
    const parsed = JSON.parse(text.slice(jsonStart));
    if (parsed?.error) throw new Error(String(parsed.error?.message || parsed.error));
    return parsed?.result ?? parsed;
  } finally {
    clearTimeout(timer);
  }
}

export async function listServerTools(server: McpServerRow): Promise<string[]> {
  const cached = toolsCache.get(server.id);
  if (cached && Date.now() < cached.expiresAt) return cached.names;
  try {
    const result = await rpc(server.url, {
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {},
    }, 8_000);
    const raw = result?.tools || [];
    const names: string[] = Array.isArray(raw)
      ? raw.map((t: any) => String(t?.name || '')).filter(Boolean)
      : [];
    toolsCache.set(server.id, { names, expiresAt: Date.now() + TOOLS_CACHE_MS });
    return names;
  } catch (err: any) {
    logger.warn(`[McpClient] tools/list failed ${server.name}: ${err?.message || err}`);
    return [];
  }
}

export async function callMcpTool(
  tenantId: string,
  serverName: string,
  toolName: string,
  args: Record<string, any>,
): Promise<McpToolCallResult> {
  try {
    const r = await pool.query(
      `SELECT id, name, url, transport, custom_instructions, enabled, tools_disabled
         FROM agent_mcp_servers
         WHERE tenant_id = $1 AND name = $2 AND enabled = TRUE`,
      [tenantId, serverName],
    );
    const server = r.rows[0] as McpServerRow | undefined;
    if (!server) return { ok: false, server: serverName, tool: toolName, error: 'MCP server khong ton tai hoac dang tat' };
    if ((server.tools_disabled || []).includes(toolName)) {
      return { ok: false, server: serverName, tool: toolName, error: 'Tool da bi tat quyen admin' };
    }
    const result = await rpc(server.url, {
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: toolName, arguments: args },
    });
    return { ok: true, server: serverName, tool: toolName, content: result?.content ?? result };
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'timeout 15s' : String(err?.message || err);
    logger.warn(`[McpClient] call ${serverName}.${toolName} failed: ${reason}`);
    return { ok: false, server: serverName, tool: toolName, error: reason.slice(0, 300) };
  }
}

export function resolveMcpToolName(fullName: string, servers: McpServerRow[]): { serverName: string; toolName: string } | null {
  if (!fullName.startsWith('mcp_')) return null;
  const rest = fullName.slice(4);
  for (const s of servers) {
    if (rest.startsWith(s.name + '_')) {
      return { serverName: s.name, toolName: rest.slice(s.name.length + 1) };
    }
  }
  return null;
}
