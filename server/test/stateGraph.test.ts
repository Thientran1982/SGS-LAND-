import { describe, expect, it } from 'vitest';
import { StateGraph } from '../ai/stateGraph';

describe('StateGraph error-path resilience (P1-4)', () => {
  it('does not throw when state lacks t()/trace and a node fails', async () => {
    const graph = new StateGraph<Record<string, unknown>>();
    graph.addNode('boom', async () => { throw new Error('boom'); });
    graph.setEntryPoint('boom');
    const out = await graph.compileAndRun({});
    expect(typeof out.finalResponse).toBe('string');
    expect(String(out.finalResponse).length).toBeGreaterThan(0);
    expect(Array.isArray(out.trace)).toBe(true);
    expect((out as any).nodeErrors?.boom).toBe('boom');
  });

  it('uses state t() translator when available', async () => {
    const graph = new StateGraph<any>();
    graph.addNode('boom', async () => { throw new Error('boom'); });
    graph.setEntryPoint('boom');
    const out = await graph.compileAndRun({ t: (k: string) => 'BUSY:' + k });
    expect(String(out.finalResponse)).toContain('BUSY:ai.msg_system_busy');
  });
});
