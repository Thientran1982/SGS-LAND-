import React, { useEffect, useMemo, useState } from 'react';
import { SeoHead } from '../components/SeoHead';

type Run = {
  id: string;
  name: string;
  variant: string;
  fixture_version: string;
  prompt_version?: string;
  model?: string;
  total_cases: number;
  completed_cases: number;
  summary_json?: Record<string, number>;
  created_at: string;
};

const metricLabels: Record<string, string> = {
  intentAccuracy: 'Intent accuracy',
  groundedness: 'Groundedness',
  toolSuccess: 'Tool success',
  escalationRecall: 'Escalation recall',
  safety: 'Safety',
  latencyP95: 'Latency p95 (ms)',
  hallucination: 'Hallucination safety',
  requiredFacts: 'Required facts',
};

export const AiEvaluation: React.FC = () => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [fixtureCount, setFixtureCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [baselineId, setBaselineId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [comparison, setComparison] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    Promise.all([
      fetch('/api/ai/governance/evaluation/runs', { headers }).then(r => r.json()),
      fetch('/api/ai/governance/evaluation/fixture', { headers }).then(r => r.json()),
    ]).then(([runData, fixture]) => {
      setRuns(Array.isArray(runData) ? runData : []);
      setFixtureCount(Number(fixture?.count || 0));
    }).finally(() => setLoading(false));
  }, [headers]);

  useEffect(() => {
    if (!candidateId) return;
    fetch(`/api/ai/governance/evaluation/runs/${candidateId}/breakdown`, { headers })
      .then(r => r.json()).then(data => setBreakdown(Array.isArray(data) ? data : []));
  }, [candidateId, headers]);

  const compare = () => {
    if (!baselineId || !candidateId) return;
    fetch(`/api/ai/governance/evaluation/compare?baselineId=${baselineId}&candidateId=${candidateId}`, { headers })
      .then(r => r.json()).then(setComparison);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <SeoHead title="AI Evaluation | SGS Land" description="Đo chất lượng AI theo hội thoại tiếng Việt và Zalo/Messenger" />
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">AI Governance</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Evaluation dashboard</h1>
          <p className="mt-2 text-slate-600">So sánh prompt/model bằng cùng một bộ hội thoại synthetic, không dùng PII thật.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Fixture cases</p><p className="mt-2 text-3xl font-bold">{fixtureCount}</p><p className="text-xs text-slate-400">Zalo + Messenger</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Evaluation runs</p><p className="mt-2 text-3xl font-bold">{runs.length}</p><p className="text-xs text-slate-400">Baseline/candidate versioned</p></div>
          <div className="rounded-2xl bg-amber-50 p-5 shadow-sm"><p className="text-sm font-semibold text-amber-800">Promotion gate</p><p className="mt-2 text-sm text-amber-700">Không promote khi groundedness, safety hoặc escalation recall giảm.</p></div>
        </div>
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Runs</h2></div>
          {loading ? <p className="p-5 text-slate-500">Đang tải…</p> : runs.length === 0 ? (
            <p className="p-5 text-slate-500">Chưa có evaluation run. Hãy tạo run qua API sau khi cố định prompt/model và fixture version.</p>
          ) : <div className="divide-y divide-slate-100">
            {runs.map(run => <div className="p-5" key={run.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-semibold">{run.name}</h3><p className="text-xs text-slate-500">{run.variant} · {run.model || 'model n/a'} · {run.fixture_version}</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{run.completed_cases}/{run.total_cases} cases</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {Object.entries(metricLabels).map(([key, label]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{key === 'latencyP95' ? `${Math.round(Number(run.summary_json?.[key] || 0))} ms` : `${(Number(run.summary_json?.[key] || 0) * 100).toFixed(1)}%`}</p></div>)}
              </div>
            </div>)}
          </div>}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-600">Baseline
              <select className="mt-1 block rounded-lg border p-2" value={baselineId} onChange={e => setBaselineId(e.target.value)}>
                <option value="">Chọn run</option>{runs.map(run => <option key={run.id} value={run.id}>{run.name} ({run.variant})</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-600">Candidate
              <select className="mt-1 block rounded-lg border p-2" value={candidateId} onChange={e => setCandidateId(e.target.value)}>
                <option value="">Chọn run</option>{runs.map(run => <option key={run.id} value={run.id}>{run.name} ({run.variant})</option>)}
              </select>
            </label>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!baselineId || !candidateId} onClick={compare}>So sánh paired</button>
          </div>
          {comparison?.runs?.length === 2 && <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Case</th><th className="p-2">Baseline</th><th className="p-2">Candidate</th><th className="p-2">Delta</th></tr></thead>
              <tbody>{(comparison.cases || []).slice(0, 30).map((item: any) => {
                const b = Number(item.baseline_scores?.groundedness || 0);
                const c = Number(item.candidate_scores?.groundedness || 0);
                return <tr className="border-b border-slate-50" key={item.case_id}><td className="p-2">{item.case_id}</td><td className="p-2">{(b * 100).toFixed(0)}%</td><td className="p-2">{(c * 100).toFixed(0)}%</td><td className={`p-2 font-semibold ${c < b ? 'text-red-600' : 'text-emerald-600'}`}>{((c - b) * 100).toFixed(1)}pp</td></tr>;
              })}</tbody>
            </table>
          </div>}
        </section>
        {breakdown.length > 0 && <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Candidate theo intent</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{breakdown.map((row: any) =>
            <div className="rounded-xl bg-slate-50 p-4" key={row.intent}><div className="flex justify-between"><span className="font-semibold">{row.intent}</span><span className="text-xs text-slate-500">{row.cases} cases</span></div>
              <p className="mt-2 text-xs text-slate-600">Intent {(Number(row.intent_accuracy) * 100).toFixed(0)}% · Grounded {(Number(row.groundedness) * 100).toFixed(0)}% · Safety {(Number(row.safety) * 100).toFixed(0)}%</p>
              <p className="mt-1 text-xs text-slate-500">Escalation {(Number(row.escalation_recall) * 100).toFixed(0)}% · p95 {Math.round(Number(row.latency_p95 || 0))}ms</p>
            </div>)}</div>
        </section>}
      </div>
    </div>
  );
};

export default AiEvaluation;