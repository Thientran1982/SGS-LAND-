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
};

export const AiEvaluation: React.FC = () => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [fixtureCount, setFixtureCount] = useState(0);
  const [loading, setLoading] = useState(true);
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
      </div>
    </div>
  );
};

export default AiEvaluation;