
import { SocialUserProfile, Channel } from '../types';

const FB_CONFIG = {
    LATENCY: { PROFILE: 300 },
    MOCK_DATA: {
        AVATAR_API: 'https://ui-avatars.com/api/?background=1877f2&color=fff&name='
    }
};

class FacebookService {
    /**
     * Simulate getting user profile (Public Profile Access)
     */
    async getProfile(psid: string, config?: { pageAccessToken: string }): Promise<SocialUserProfile> {
        // Direct latency simulation for read operations
        await new Promise(r => setTimeout(r, FB_CONFIG.LATENCY.PROFILE));
        
        if (!psid) throw new Error('fb.err_invalid_psid');

        // Deterministic Mock Data based on PSID
        const shortId = psid.length > 4 ? psid.slice(-4) : psid;
        const name = `Facebook User ${shortId}`;
        
        return {
            id: psid,
            name: name,
            avatar: `${FB_CONFIG.MOCK_DATA.AVATAR_API}${encodeURIComponent(name)}`,
            platform: Channel.FACEBOOK,
            email: `fb.${shortId}@example.com` // Simulated scoped email
        };
    }
}

export const facebookService = new FacebookService();
