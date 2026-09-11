import React from 'react';
import { useQuery } from '@tanstack/react-query';

type OnboardingPlatform = {
  platform: string;
  status: string;
  ready: boolean;
  hasPublisher: boolean;
  reason: string;
};

type OnboardingData = {
  tenantId: string;
  autoPostingEnabled: boolean;
  autoEnabledNow: boolean;
  connectedPlatforms: string[];
  platforms: OnboardingPlatform[];
};

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK_PAGE: 'Facebook Page',
  ZALO_BROADCAST: 'Zalo OA',
  INSTAGRAM: 'Instagram',
  LINKEDIN_PAGE: 'LinkedIn',
  TIKTOK: 'TikTok',
};

function statusDotClass(status: string, ready: boolean): string {
  if (ready) return 'bg-emerald-500';
  if (status === 'UNSUPPORTED') return 'bg-zinc-400';
  return 'bg-amber-500';
}

export const AutoPostingOnboardingCard: React.FC = () => {
  const { data, isLoading, isError } = useQuery<OnboardingData>({
    queryKey: ['auto-posting-onboarding'],
    queryFn: async () => {
      const res = await fetch('/api/auto-posting/onboarding', { credentials: 'include' });
      if (!res.ok) throw new Error('onboarding ' + res.status);
      return res.json() as Promise<OnboardingData>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-card)] p-4 animate-pulse">
        <div className="h-4 w-56 rounded bg-[var(--ui-border)]" />
        <div className="mt-3 h-3 w-full rounded bg-[var(--ui-border)]" />
      </div>
    );
  }
  if (isError || !data) return null;

  return (
    <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Marketing Agent · Kênh quảng cáo tự động (18:30 hằng ngày)</h3>
        <span
          className={
            'rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
            (data.autoPostingEnabled
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-amber-500/10 text-amber-500')
          }
        >
          {data.autoPostingEnabled ? 'Đang bật' : 'Chưa bật'}
        </span>
      </div>
      {data.autoEnabledNow && (
        <p className="mt-2 text-xs text-emerald-500">
          Agent đã được kích hoạt tự động cho doanh nghiệp của bạn vì đã có kênh sẵn sàng.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {data.platforms.map(item => (
          <li key={item.platform} className="flex items-start gap-2">
            <span className={'mt-1 h-2 w-2 shrink-0 rounded-full ' + statusDotClass(item.status, item.ready)} />
            <div className="min-w-0">
              <div className="text-xs font-medium">
                {PLATFORM_LABELS[item.platform] || item.platform}
                <span className="ml-2 font-normal opacity-60">{item.ready ? 'Sẵn sàng' : item.status}</span>
              </div>
              {!item.ready && item.reason && (
                <div className="text-[11px] leading-snug opacity-60">{item.reason}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
