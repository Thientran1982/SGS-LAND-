/**
 * AiCreditBadge — compact monthly AI credit indicator
 * Shows remaining credits, reset date, and upgrade CTA when low.
 * Used in LeadDetail (ARIA) and ListingDetail (Valuation).
 */

import React from 'react';

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  resetAt: string;
  isUnlimited: boolean;
}

interface Props {
  quota: QuotaInfo | null;
  featureLabel: string;
  className?: string;
  onUpgradeClick?: () => void;
}

function daysUntil(isoDate: string): number {
  const now = Date.now();
  const target = new Date(isoDate).getTime();
  return Math.max(0, Math.ceil((target - now) / 86_400_000));
}

export const AiCreditBadge: React.FC<Props> = ({ quota, featureLabel, className = '', onUpgradeClick }) => {
  if (!quota) return null;
  if (quota.isUnlimited) return null;

  const { used, limit, remaining, resetAt } = quota;
  const pct = limit > 0 ? Math.min(100, (remaining / limit) * 100) : 0;
  const daysLeft = daysUntil(resetAt);
  const isExhausted = remaining <= 0;
  const isLow = !isExhausted && remaining <= Math.max(1, Math.floor(limit * 0.3));

  const barColor = isExhausted
    ? 'bg-rose-500'
    : isLow
      ? 'bg-amber-400'
      : 'bg-emerald-500';

  const textColor = isExhausted
    ? 'text-rose-700'
    : isLow
      ? 'text-amber-700'
      : 'text-emerald-700';

  const bgColor = isExhausted
    ? 'bg-rose-50 border-rose-200'
    : isLow
      ? 'bg-amber-50 border-amber-200'
      : 'bg-emerald-50 border-emerald-200';

  const resetLabel = daysLeft <= 1 ? 'Reset hôm nay' : daysLeft <= 7 ? `Reset sau ${daysLeft} ngày` : `Reset ${new Date(resetAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;

  return (
    <div className={`rounded-xl border px-3 py-2 space-y-1.5 ${bgColor} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${textColor}`}>
          {featureLabel}
        </span>
        <span className={`text-[10px] font-semibold ${textColor}`}>
          {isExhausted ? '0' : remaining}/{limit} lượt
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden border border-white/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-slate-500">{resetLabel}</span>
        {(isExhausted || isLow) && onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all ${
              isExhausted
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            {isExhausted ? 'Nâng cấp' : 'Xem gói'}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * AiQuotaGate — blocks a CTA when quota is exhausted,
 * shows upgrade panel instead; otherwise renders children.
 */
interface GateProps {
  quota: QuotaInfo | null;
  featureLabel: string;
  children: React.ReactNode;
  onUpgradeClick?: () => void;
}

export const AiQuotaGate: React.FC<GateProps> = ({ quota, featureLabel, children, onUpgradeClick }) => {
  const isExhausted = quota && !quota.isUnlimited && quota.remaining <= 0;
  const daysLeft = quota?.resetAt ? daysUntil(quota.resetAt) : 0;

  if (isExhausted) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3 animate-enter">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-800">Hết lượt {featureLabel} tháng này</p>
            <p className="text-xs text-rose-600 mt-0.5">
              Bạn đã dùng hết {quota!.limit} lượt/tháng (gói {quota!.plan}).
              {daysLeft > 0 ? ` Lượt sẽ reset sau ${daysLeft} ngày.` : ' Lượt sẽ reset hôm nay.'}
            </p>
          </div>
        </div>
        {onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className="w-full py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95 transition-all"
          >
            Nâng cấp lên TEAM — 50 lượt/tháng
          </button>
        )}
        <p className="text-center text-[10px] text-rose-400">
          Hoặc đợi đến kỳ reset tiếp theo · Dữ liệu cũ vẫn hiển thị
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
