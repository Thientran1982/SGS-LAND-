import { ChaosConfig } from '../types';

// -----------------------------------------------------------------------------
// CONSTANTS & TYPES
// -----------------------------------------------------------------------------

export class ChaosError extends Error {
    constructor(public serviceName: string, message: string) {
        super(`[CHAOS] ${serviceName}: ${message}`);
        this.name = 'ChaosError';
    }
}

const DEFAULT_CONFIG: ChaosConfig = {
    latencyMs: 0,
    errorRate: 0,
    services: {
        database: true,
        webhook: true,
        ai: true
    },
    enabled: false
};

const JITTER_FACTOR = 0.2;

// -----------------------------------------------------------------------------
// SERVICE IMPLEMENTATION
// -----------------------------------------------------------------------------

class ChaosService {
    private config: ChaosConfig = { ...DEFAULT_CONFIG };

    /**
     * Update chaos configuration (Admin Only).
     * Merges with existing config using safe object spread.
     */
    configure(newConfig: Partial<ChaosConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): ChaosConfig {
        return { ...this.config };
    }

    /**
     * Intercept an operation and inject chaos if enabled.
     * @param service Target service identifier
     */
    async intercept(service: keyof ChaosConfig['services']): Promise<void> {
        // Fast-fail if chaos is disabled globally or for specific service
        if (!this.config.enabled || !this.config.services[service]) return;

        // 1. Latency Injection (Network Jitter Simulation)
        if (this.config.latencyMs > 0) {
            // Jitter: +/- 20% to simulate real-world network instability
            const jitter = this.config.latencyMs * JITTER_FACTOR * (Math.random() - 0.5);
            const delay = Math.max(0, this.config.latencyMs + jitter);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // 2. Fault Injection (500 Errors)
        if (this.config.errorRate > 0 && Math.random() < this.config.errorRate) {
            // Throw specific ChaosError so monitoring tools can properly classify these alerts
            throw new ChaosError(service, 'Simulated Infrastructure Failure (500)');
        }
    }
}

export const chaosService = new ChaosService();