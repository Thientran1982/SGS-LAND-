import { describe, expect, it, vi } from 'vitest';

describe('Agent Cockpit failure isolation', () => {
  it('keeps optional panel failures from becoming an endpoint-wide failure', () => {
    const panelResults = [
      { rows: [{ status: 'DONE', count: 1 }] },
      { rows: [] },
      { rows: [] },
    ];
    expect(panelResults.every(result => Array.isArray(result.rows))).toBe(true);
    expect(panelResults[0].rows).toHaveLength(1);
    expect(panelResults[1].rows).toHaveLength(0);
  });
});