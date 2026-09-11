import React, { useEffect, useState } from 'react';
import { BrainCircuit } from 'lucide-react';

type NeuronRow = {
  intent: string;
  tool: string;
  runs: number;
  success: number;
  avgMs: number;
};

type NeuronMapData = {
  brain: string;
  budget: { used: number; budget: number; exceeded: boolean };
  neurons: NeuronRow[];
};

export const AgentNeuronMap: React.FC = () => {
  const [data, setData] = useState<NeuronMapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/agents/neuron-map', { credentials: 'include' })
      .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(json => { if (alive) setData(json as NeuronMapData); })
      .catch(err => { if (alive) setError(String(err?.message || err)); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <BrainCircuit size={16} className="text-indigo-600" /> Neuron Map — Bộ não MINH điều phối
        </h3>
        {data && (
          <span className={
            'rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
            (data.budget.exceeded ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600')
          }>
            Budget 24h: {data.budget.used}/{data.budget.budget}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">Lỗi tải neuron map: {error}</p>}
      {data && (
        <div className="mt-3">
          <div className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
            Bộ não MINH (LangGraph) điều phối {data.neurons.length} nơ-ron chuyên gia
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.neurons.map(item => {
              const rate = item.runs ? Math.round((item.success / item.runs) * 100) : null;
              return (
                <div key={item.intent} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <div className="text-xs font-semibold text-slate-700">{item.intent}</div>
                  <div className="text-[10px] text-slate-500">{item.tool}</div>
                  <div className="mt-1 text-[10px] text-slate-600">
                    {item.runs} lần chạy 7 ngày{rate !== null ? ' · ' + rate + '% thành công' : ''} · ~{item.avgMs}ms
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
