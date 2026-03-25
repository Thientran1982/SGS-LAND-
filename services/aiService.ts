import { Lead, Interaction, AgentTraceResponse } from '../types';

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
        if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
        return await response.json();
    }

    async processMessage(lead: Lead, userMessage: string, history: Interaction[], lang: string, onStream?: (chunk: string) => void): Promise<AgentTraceResponse> {
        // Since the backend doesn't support streaming for processMessage yet, we'll just return the final response
        const result = await this.fetchApi('/api/ai/process-message', { lead, userMessage, history, lang });
        if (onStream && result.content) {
            onStream(result.content);
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
        } catch (e) {
            console.error("Summarize Lead Error:", e);
            return lang === 'vn' ? "Hệ thống AI đang bận, vui lòng thử lại sau." : "AI Analysis system is busy, please try again later.";
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
