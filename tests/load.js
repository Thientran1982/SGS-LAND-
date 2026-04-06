
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

/**
 *  K6 LOAD TEST SUITE: SGS LAND ENTERPRISE
 * -----------------------------------------------------------------------------
 *  Performance testing for Public Proposal Access (High Traffic Endpoint).
 *  
 *  Optimization:
 *  1. Added Trend Metrics (P95, P99 Latency).
 *  2. Modular Configuration.
 *  3. Robust SPA Checks.
 * -----------------------------------------------------------------------------
 */

// --- 1. METRICS ---
const waitingTime = new Trend('waiting_time'); // Time to first byte (TTFB)

// --- 2. CONFIGURATION ---
const CONFIG = {
    BASE_URL: __ENV.BASE_URL || 'http://localhost:3000',
    // Default token if none provided
    TOKEN: __ENV.TOKEN || 'mock_token_123', 
    PROFILE: __ENV.PROFILE || 'average'
};

const HEADERS = {
    'User-Agent': 'k6-load-test/2.0 (SGS-Land-Enterprise)',
    'Accept': 'text/html,application/xhtml+xml,application/json',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
};

// --- 3. SCENARIOS ---
const SCENARIOS = {
    average: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '10s', target: 10 }, // Warm up
            { duration: '30s', target: 20 }, // Steady load
            { duration: '10s', target: 0 },  // Cool down
        ],
        gracefulRampDown: '10s',
    },
    stress: {
        executor: 'ramping-arrival-rate',
        startRate: 10,
        timeUnit: '1s',
        preAllocatedVUs: 50,
        maxVUs: 200,
        stages: [
            { duration: '30s', target: 50 },  // Ramp to 50 RPS
            { duration: '1m', target: 50 },   // Hold
            { duration: '30s', target: 0 },   // Cooldown
        ],
    },
    spike: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '10s', target: 100 }, // Fast spike
            { duration: '1m', target: 100 },  // Hold
            { duration: '10s', target: 0 },   // Drop
        ],
    }
};

export const options = {
    scenarios: {
        workload: SCENARIOS[CONFIG.PROFILE] || SCENARIOS.average
    },
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'], // Total duration
        waiting_time: ['p(95)<200'],                    // TTFB (Server processing time)
        http_req_failed: ['rate<0.01'],                 // Error rate < 1%
    },
};

// --- 4. TEST EXECUTION ---
export default function () {
    const url = `${CONFIG.BASE_URL}/#/p/${CONFIG.TOKEN}`; // Note: Testing Hash Router URL logic
    
    // Inject correlation ID for observability
    const iterHeaders = {
        ...HEADERS,
        'X-Correlation-ID': `k6-${__VU}-${__ITER}-${Date.now()}`
    };

    const res = http.get(url, { headers: iterHeaders, tags: { name: 'GetPublicProposal' } });

    // Custom Metrics
    waitingTime.add(res.timings.waiting);

    // --- 5. ASSERTIONS ---
    check(res, {
        'status is 200': (r) => r.status === 200,
        'content loaded': (r) => r.body && r.body.length > 0,
        // Validate React Root exists (Critical for SPA)
        'react root present': (r) => r.body.includes('id="root"'),
        // Security headers check (simulated)
        'no server errors': (r) => r.status < 500
    });

    // Randomized user think time (1s - 3s)
    sleep(Math.random() * 2 + 1);
}
