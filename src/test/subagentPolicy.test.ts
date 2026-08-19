import { describe, expect, it } from 'vitest';
import { runWithSubagentPolicy } from '../../server/services/subagentPolicy';

describe('subagent execution policy', () => {
  it('retries one transient failure and then succeeds', async () => {
    let calls = 0;
    const result = await runWithSubagentPolicy(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('provider unavailable'), { code: '503' });
      return 'ok';
    }, { timeoutMs: 100 });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry validation failures', async () => {
    let calls = 0;
    await expect(runWithSubagentPolicy(async () => {
      calls += 1;
      throw new Error('permission denied');
    }, { timeoutMs: 100 })).rejects.toThrow('permission denied');
    expect(calls).toBe(1);
  });

  it('times out a stuck branch and retries once', async () => {
    let calls = 0;
    await expect(runWithSubagentPolicy(async () => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 40));
      throw new Error('still unavailable');
    }, { timeoutMs: 10 })).rejects.toThrow(/SUBAGENT_TIMEOUT|still unavailable/);
    expect(calls).toBe(2);
  });
});