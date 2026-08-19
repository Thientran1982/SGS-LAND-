import type { ChannelAdapter, ChannelId } from './types';
import { zaloAdapter } from './zaloAdapter';
import { facebookAdapter } from './facebookAdapter';
import { emailAdapter } from './emailAdapter';
import { webAdapter } from './webAdapter';

const ADAPTERS: Partial<Record<ChannelId, ChannelAdapter>> = {
  ZALO: zaloAdapter,
  FACEBOOK: facebookAdapter,
  EMAIL: emailAdapter,
  WEB: webAdapter,
  // TIKTOK: se them o buoc xay TikTokAdapter (theo dung thu tu da chot)
};

export function getAdapter(channel: ChannelId): ChannelAdapter | null {
  return ADAPTERS[channel] || null;
}

export type { ChannelAdapter, ChannelId, SendResult } from './types';
