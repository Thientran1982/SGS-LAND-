
import { SocialUserProfile, Channel } from '../types';
import { systemService } from './systemService';

const ZALO_CONFIG = {
    LATENCY: { PROFILE: 300 },
    VALIDATION: { ID_MIN_LENGTH: 5 },
    AVATAR_API: 'https://ui-avatars.com/api/?background=0088ff&color=fff&name='
};

class ZaloService {
    async getProfile(zaloUserId: string): Promise<SocialUserProfile> {
        // 1. Chaos Injection
        await new Promise(r => setTimeout(r, ZALO_CONFIG.LATENCY.PROFILE));
        
        // 2. Strict Validation
        if (!zaloUserId || zaloUserId.length < ZALO_CONFIG.VALIDATION.ID_MIN_LENGTH) {
            systemService.log('WARN', 'Zalo GetProfile Failed: Invalid ID format', { userId: zaloUserId }, undefined, 'SYSTEM');
            throw new Error('zalo.err_invalid_id'); // Localized Error Key
        }

        // 3. Deterministic Mock Data
        // Use the last 4 chars to generate a consistent "name" suffix
        const suffix = zaloUserId.slice(-4);
        const displayName = `Zalo User ${suffix}`;
        
        return {
            id: zaloUserId,
            name: displayName,
            avatar: `${ZALO_CONFIG.AVATAR_API}${encodeURIComponent(displayName)}`,
            platform: Channel.ZALO
        };
    }

    async sendMessage(userId: string, text: string): Promise<{ messageId: string, error?: string }> {
        // Mock send logic
        await new Promise(r => setTimeout(r, 200));
        if (userId === 'error_user') {
            return { messageId: '', error: 'Failed to send' };
        }
        return { messageId: `msg_${Date.now()}` };
    }
}

export const zaloService = new ZaloService();
