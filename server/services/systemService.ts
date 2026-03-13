import { pool } from '../db';

const startTime = Date.now();

export const systemService = {
  async checkHealth() {
    let dbConnected = false;
    let latency = 0;
    const startPing = Date.now();

    try {
      await pool.query('SELECT 1');
      dbConnected = true;
      latency = Date.now() - startPing;
    } catch {
      dbConnected = false;
    }

    const aiConfigured = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);

    return {
      status: dbConnected ? 'healthy' : 'critical',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV',
      checks: {
        database: dbConnected,
        aiService: aiConfigured,
      },
      latency,
    };
  },
};
