// Fix the 4 pre-existing failing test files (tests were out of date with the app).
import fs from 'node:fs';
const report = [];
function patch(file, steps) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [name, fn] of steps) {
    const n = fn(s);
    if (n === null || n === s) { report.push(`FAIL ${file}: ${name}`); return; }
    s = n;
  }
  fs.writeFileSync(file, s);
  report.push(`OK   ${file}`);
}
const all = (a, b) => (s) => (s.includes(a) ? s.split(a).join(b) : null);
const lit = (a, b) => (s) => (s.includes(a) ? s.replace(a, b) : null);

// 1. UI copy is the correct Vietnamese "Phễu" (funnel); the test still expected the old mixed "Funnel".
patch('src/test/Dashboard.test.tsx', [
  ['funnel label', all('"Funnel hành vi người xem"', '"Phễu hành vi người xem"')],
]);

// 2. SocialPublishing now renders AutoPostingOnboardingCard (react-query); stub it so the
//    listing-selector tests stay focused and don't need a QueryClientProvider.
patch('src/test/SocialPublishing.test.tsx', [
  ['stub onboarding card', lit("import { db } from '../../services/dbApi';\n",
    "import { db } from '../../services/dbApi';\n\nvi.mock('../../components/AutoPostingOnboardingCard', () => ({\n  AutoPostingOnboardingCard: () => null,\n}));\n")],
]);

// 3. The System-1 router also records a routing signal per call; assert only on delegation signals.
patch('src/test/minhOrchestrator.test.ts', [
  ['count delegation only', lit(
`    expect(recordSignal).toHaveBeenCalledTimes(2);
    const [firstCallArgs] = recordSignal.mock.calls[0];
    void firstCallArgs;
    const firstDedupeKey = recordSignal.mock.calls[0][1].dedupeKey;
    const secondDedupeKey = recordSignal.mock.calls[1][1].dedupeKey;`,
`    // The fast System-1 router may also record a routing signal; only delegation signals matter here.
    const delegationCalls = recordSignal.mock.calls.filter((call: any[]) => call[1]?.signalType === 'minh_delegation');
    expect(delegationCalls).toHaveLength(2);
    const firstDedupeKey = delegationCalls[0][1].dedupeKey;
    const secondDedupeKey = delegationCalls[1][1].dedupeKey;`)],
]);

// 4. Cockpit reloads are debounced/coalesced, so the new-window request arrives asynchronously.
patch('src/test/AgentCockpit.test.tsx', [
  ['await debounced reload', lit(
    "    expect((api.get as any).mock.calls.some(([path]: [string]) => path.includes('/api/internal/minh-brain/overview?limit=50&days=7'))).toBe(true);",
    "    await waitFor(() => expect((api.get as any).mock.calls.some(([path]: [string]) => path.includes('/api/internal/minh-brain/overview?limit=50&days=7'))).toBe(true));")],
  ['import waitFor', (s) => {
    const m = s.match(/import \{([^}]*)\} from '@testing-library\/react';/);
    if (!m) return null;
    if (/\bwaitFor\b/.test(m[1])) return s + '\n';
    return s.replace(m[0], `import {${m[1].replace(/\s*$/, '')}, waitFor } from '@testing-library/react';`);
  }],
]);
console.log(report.join('\n'));
