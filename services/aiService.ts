import { Lead, Interaction, AgentTraceResponse } from '../types';

const AI_QUOTA_MESSAGE_VN = 'Hệ thống AI đang bận do lượng truy cập cao. Vui lòng thử lại sau ít phút.';
const AI_QUOTA_MESSAGE_EN = 'The AI system is temporarily busy. Please try again in a few minutes.';
const AI_ERROR_MESSAGE_VN = 'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.';
const AI_ERROR_MESSAGE_EN = 'AI service temporarily unavailable. Please try again later.';

class AiApiClient {
    private async fetchApi(endpoint: string, body: unknown): Promise<any> {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        if (response.status === 401 || response.status === 403) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('sgs_auth_cached');
                window.dispatchEvent(new CustomEvent('auth:logout'));
            }
            throw new Error('Authentication required');
        }
        if (response.status === 429) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || AI_QUOTA_MESSAGE_VN);
        }
        if (response.status === 503) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || AI_ERROR_MESSAGE_VN);
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || `API request failed: ${response.statusText}`);
        }
        return await response.json();
    }

    async processMessage(lead: Lead, userMessage: string, history: Interaction[], lang: string, onStream?: (chunk: string) => void): Promise<AgentTraceResponse> {
        const result = await this.fetchApi('/api/ai/process-message', { lead, userMessage, history, lang });
        if (onStream && result.content) {
            const words = String(result.content).split(' ');
            for (let i = 0; i < words.length; i++) {
                const chunk = (i === 0 ? '' : ' ') + words[i];
                onStream(chunk);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        return result;
    }

    async scoreLead(leadData: Partial<Lead>, messageContent?: string, weights?: Record<string, number>, lang: string = 'vn'): Promise<{ score: number, grade: string, reasoning: string }> {
        return this.fetchApi('/api/ai/score-lead', { leadData, messageContent, weights, lang });
    }

    async summarizeLead(lead: Lead, logs: unknown[], lang: string): Promise<string> {
        try {
            const result = await this.fetchApi('/api/ai/summarize-lead', { lead, logs, lang });
            return result.summary || (lang === 'vn' ? `Khách hàng ${lead.name} đang được hệ thống AI phân tích chuyên sâu.` : `Lead ${lead.name} is undergoing deep AI analysis.`);
        } catch (e: any) {
            console.warn("Summarize Lead Error:", e?.message);
            const msg = e?.message || '';
            if (msg && !msg.includes('API request failed')) return msg;
            return lang === 'vn' ? AI_QUOTA_MESSAGE_VN : AI_QUOTA_MESSAGE_EN;
        }
    }

    async getRealtimeValuation(address: string, area: number, roadWidth: number, legal: string, propertyType?: string): Promise<any> {
        return this.fetchApi('/api/ai/valuation', { address, area, roadWidth, legal, propertyType });
    }

    async parseSearchQuery(query: string): Promise<any> {
        const prompt = `
            Bạn là một hệ thống phân tích ngôn ngữ tự nhiên cho công cụ tìm kiếm bất động sản.
            Nhiệm vụ: Trích xuất các tiêu chí tìm kiếm từ câu truy vấn của người dùng.
            
            Câu truy vấn: "${query}"
        `;
        
        const schema = {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "Cleaned search query" },
                propertyType: { type: "STRING" },
                transactionType: { type: "STRING" },
                location: { type: "STRING", description: "City, District, or Project name" },
                priceMin: { type: "NUMBER" },
                priceMax: { type: "NUMBER" },
                areaMin: { type: "NUMBER" },
                areaMax: { type: "NUMBER" },
                features: { 
                    type: "ARRAY", 
                    items: { type: "STRING" },
                    description: "Extracted features like 'sổ hồng', 'mặt tiền', 'hẻm xe hơi'"
                }
            },
            required: ['query']
        };

        const result = await this.fetchApi('/api/ai/generate-content', {
            prompt,
            model: 'gemini-2.0-flash',
            responseMimeType: 'application/json',
            responseSchema: schema
        });
        
        return JSON.parse(result.text || '{}');
    }
}

export const aiService = new AiApiClient();
