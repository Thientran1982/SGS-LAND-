import { HealthStatus, SystemHealth, EnvCheckResult, LogEntry, LogSource } from '../types';
import { db } from './mockDb';

// -----------------------------------------------------------------------------
// 1. CONFIGURATION
// -----------------------------------------------------------------------------

const SYS_CONFIG = {
    VERSION: '4.2.0-ent',
    LOGS: {
        MAX_BUFFER: 500,
        RETENTION_MS: 60000,
        ERROR_THRESHOLD_PER_MIN: 10,
    },
    HEALTH: {
        LATENCY_THRESHOLD_MS: 1000,
    },
    BACKUP: {
        PREFIX: 'sgs_backup_',
        MIME_TYPE: 'application/json'
    },
    TRAFFIC: {
        INTERVAL_MS: 1500,
        PROBABILITY: 0.6 // 60% chance to generate traffic per tick
    }
} as const;

const SIMULATION_ROUTES = [
    { method: 'GET', path: '/api/v1/leads', weight: 0.4 },
    { method: 'POST', path: '/api/v1/leads', weight: 0.1 },
    { method: 'GET', path: '/api/v1/auth/session', weight: 0.3 },
    { method: 'POST', path: '/api/v1/listings/search', weight: 0.2 }
];

// -----------------------------------------------------------------------------
// 2. ENVIRONMENT ABSTRACTION
// -----------------------------------------------------------------------------

const getEnv = (key: string, defaultValue: string = ''): string => {
    // 1. Try Vite/Modern Bundlers
    // Cast import.meta to any to avoid TS error: Property 'env' does not exist on type 'ImportMeta'
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
        return String((import.meta as any).env[key]);
    }
    // 2. Try Node/Webpack
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] as string;
    }
    return defaultValue;
};

const ENV_VARS = {
    NODE_ENV: getEnv('NODE_ENV', 'production'),
    DATABASE_URL: getEnv('DATABASE_URL', 'postgres://mock:5432/db'),
    API_KEY: getEnv('API_KEY', ''), 
    EMAIL_SERVICE_KEY: getEnv('EMAIL_SERVICE_KEY', 'mock-ses-key'),
    PUBLIC_BASE_URL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
};

// -----------------------------------------------------------------------------
// 3. SERVICE IMPLEMENTATION
// -----------------------------------------------------------------------------

class SystemService {
    private readonly startTime: number = Date.now();
    private logBuffer: LogEntry[] = new Array(SYS_CONFIG.LOGS.MAX_BUFFER);
    private logHead = 0;
    private logCount = 0;
    private trafficIntervalId: ReturnType<typeof setInterval> | null = null;
    
    // Alert Monitoring Stats
    private errorCountLastMinute = 0;
    private lastErrorCheck = Date.now();

    /**
     *  CHECK HEALTH
     *  Aggregates status from DB, API, and Environment.
     */
    async checkHealth(): Promise<SystemHealth> {
        const startPing = Date.now();
        let dbConnected = false;
        let latency = 0;
        
        try {
            dbConnected = await db.ping();
            latency = Date.now() - startPing;
        } catch (e) {
            dbConnected = false;
        }

        // Config Checks
        const configChecks: EnvCheckResult[] = Object.keys(ENV_VARS).map(key => {
            const value = (ENV_VARS as any)[key];
            const isKeySecret = key.includes('KEY') || key.includes('SECRET');
            return {
                key,
                exists: !!value,
                status: value ? 'OK' : 'MISSING',
                maskedValue: isKeySecret && value ? '********' : value
            };
        });

        // Status Determination Logic
        let status = HealthStatus.HEALTHY;
        
        // 1. Critical Failure
        if (!dbConnected) {
            status = HealthStatus.CRITICAL;
            this.log('ERROR', 'Database Connection Failed', { latency }, undefined, 'SYSTEM');
        } 
        // 2. Degraded Performance
        else if (latency > SYS_CONFIG.HEALTH.LATENCY_THRESHOLD_MS || this.errorCountLastMinute > SYS_CONFIG.LOGS.ERROR_THRESHOLD_PER_MIN) {
            status = HealthStatus.DEGRADED;
        }

        return {
            status,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            timestamp: new Date().toISOString(),
            environment: ENV_VARS.NODE_ENV === 'development' ? 'DEV' : 'PROD',
            version: SYS_CONFIG.VERSION,
            checks: {
                database: dbConnected,
                aiService: !!ENV_VARS.API_KEY,
                emailService: true,
                storage: true
            },
            config: configChecks
        };
    }

    /**
     *  STRUCTURED LOGGER
     *  Handles log rotation and filtering.
     */
    log(level: 'INFO' | 'WARN' | 'ERROR', message: string, context?: Record<string, any>, tenantId?: string, source: LogSource = 'USER') {
        const now = Date.now();
        
        // Rotate Error Counter
        if (now - this.lastErrorCheck > SYS_CONFIG.LOGS.RETENTION_MS) {
            this.errorCountLastMinute = 0;
            this.lastErrorCheck = now;
        }
        if (level === 'ERROR') this.errorCountLastMinute++;

        const entry: LogEntry = {
            id: `log_${now}_${Math.random().toString(36).substr(2,5)}`,
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            tenantId,
            source,
            traceId: context?.traceId || `trace_${now}`
        };

        // Circular Buffer Rotation O(1)
        this.logHead = (this.logHead - 1 + SYS_CONFIG.LOGS.MAX_BUFFER) % SYS_CONFIG.LOGS.MAX_BUFFER;
        this.logBuffer[this.logHead] = entry;
        if (this.logCount < SYS_CONFIG.LOGS.MAX_BUFFER) {
            this.logCount++;
        }

        // Dev Console (Filtered to reduce noise in DevTools)
        if (ENV_VARS.NODE_ENV === 'development' && level === 'ERROR') {
            console.error(`[${source}] ${message}`, context);
        }
    }

    getRecentLogs(): LogEntry[] {
        const result: LogEntry[] = [];
        for (let i = 0; i < this.logCount; i++) {
            result.push(this.logBuffer[(this.logHead + i) % SYS_CONFIG.LOGS.MAX_BUFFER]);
        }
        return result;
    }

    clearLogs() {
        this.logBuffer = new Array(SYS_CONFIG.LOGS.MAX_BUFFER);
        this.logHead = 0;
        this.logCount = 0;
    }

    /**
     *  BACKUP & RESTORE LOGIC
     */
    async downloadBackup(): Promise<void> {
        try {
            const data = await db.createBackup();
            const blob = new Blob([data], { type: SYS_CONFIG.BACKUP.MIME_TYPE });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${SYS_CONFIG.BACKUP.PREFIX}${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.log('INFO', 'System backup generated and downloaded.', undefined, undefined, 'SYSTEM');
        } catch (e: any) {
            this.log('ERROR', `Backup failed: ${e.message}`, undefined, undefined, 'SYSTEM');
            throw e;
        }
    }

    async processRestoreFile(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const content = ev.target?.result as string;
                    if (!content) throw new Error("Empty file content");
                    
                    // Basic Validation
                    let parsed;
                    try {
                        parsed = JSON.parse(content);
                    } catch {
                        throw new Error("Invalid Backup Format: Malformed JSON.");
                    }

                    if (!parsed || typeof parsed !== 'object') {
                        throw new Error("Invalid Backup Format: Not an object.");
                    }

                    await db.restoreBackup(content);
                    this.log('WARN', `System restored from backup file: ${file.name}`, undefined, undefined, 'SYSTEM');
                    resolve();
                } catch (err: any) {
                    this.log('ERROR', `Restore Failed: ${err.message}`, undefined, undefined, 'SYSTEM');
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("File reading failed"));
            reader.readAsText(file);
        });
    }

    /**
     *  TRAFFIC GENERATOR
     *  Simulates system load for observability testing.
     */
    startTrafficSimulation(shouldFail: boolean, failureRate: number) {
        if (this.trafficIntervalId) return;

        this.trafficIntervalId = setInterval(() => {
            // Only generate traffic X% of ticks to vary load naturally
            if (Math.random() > (1 - SYS_CONFIG.TRAFFIC.PROBABILITY)) { 
                
                const route = SIMULATION_ROUTES[Math.floor(Math.random() * SIMULATION_ROUTES.length)];
                const latency = Math.floor(Math.random() * 100) + 20; // 20-120ms base latency

                if (shouldFail && Math.random() < failureRate) {
                    this.log('ERROR', `HTTP 500: Internal Server Error - ${route.method} ${route.path}`, { error: 'Chaos Injection' }, undefined, 'CHAOS');
                } else {
                    // Simulate varying success codes
                    const statusCodes = [200, 201, 204, 304];
                    const code = statusCodes[Math.floor(Math.random() * statusCodes.length)];
                    this.log('INFO', `HTTP ${code} - ${route.method} ${route.path} (${latency}ms)`, undefined, undefined, 'TRAFFIC');
                }
            }
        }, SYS_CONFIG.TRAFFIC.INTERVAL_MS);
    }

    stopTrafficSimulation() {
        if (this.trafficIntervalId) {
            clearInterval(this.trafficIntervalId);
            this.trafficIntervalId = null;
        }
    }
}

export const systemService = new SystemService();