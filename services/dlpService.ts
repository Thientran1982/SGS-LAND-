import { ComplianceConfig } from '../types';
import { systemService } from './systemService';

// -----------------------------------------------------------------------------
// 1. CONSTANTS & CONFIG
// -----------------------------------------------------------------------------

const DLP_CONFIG = {
    SIMULATION_LATENCY_MS: 300,
    REDACTION_CHAR: '█',
    REDACTION_FALLBACK_LEN: 5,
    LOG_SOURCE: 'SECURITY' as const
};

// -----------------------------------------------------------------------------
// 2. TYPES
// -----------------------------------------------------------------------------

export interface DlpViolation {
    ruleName: string;
    action: 'REDACT' | 'BLOCK' | 'LOG_ONLY';
    match: string;
}

export interface DlpResult {
    redactedText: string;
    blocked: boolean;
    violations: DlpViolation[];
}

// -----------------------------------------------------------------------------
// 3. SERVICE IMPLEMENTATION
// -----------------------------------------------------------------------------

class DlpService {
    // Cache compiled regexes to avoid re-compilation overhead on every scan.
    // Key: pattern string, Value: RegExp object
    private regexCache: Map<string, RegExp> = new Map();

    /**
     * Helper to safely get or compile regex.
     * Prevents invalid regex crashing the app and re-uses compiled patterns.
     */
    private getSafeRegex(pattern: string): RegExp | null {
        if (this.regexCache.has(pattern)) {
            return this.regexCache.get(pattern)!;
        }

        try {
            // Security Note: In a real Node.js env, use 're2' or 'vm' module 
            // to prevent ReDoS (Regular Expression Denial of Service).
            // Since this runs in browser/mock, we use native RegExp but cache it.
            const regex = new RegExp(pattern, 'gi');
            this.regexCache.set(pattern, regex);
            return regex;
        } catch (e) {
            return null; // Invalid pattern, handled by caller
        }
    }

    /**
     * Async DLP Scan.
     * Evaluates text against configured regex rules using cached patterns.
     */
    async scan(text: string, config: ComplianceConfig): Promise<DlpResult> {
        // Simulate processing latency (can be removed for production)
        if (DLP_CONFIG.SIMULATION_LATENCY_MS > 0) {
            await new Promise(resolve => setTimeout(resolve, DLP_CONFIG.SIMULATION_LATENCY_MS));
        }

        const result: DlpResult = {
            redactedText: text,
            blocked: false,
            violations: []
        };

        if (!config?.dlpRules || !text) {
            return result;
        }

        // Iterate through enabled rules
        for (const rule of config.dlpRules) {
            if (!rule.enabled || !rule.pattern) continue;
            
            const regex = this.getSafeRegex(rule.pattern);
            
            if (!regex) {
                systemService.log('WARN', 'Invalid DLP Rule Pattern', { 
                    ruleName: rule.name, 
                    pattern: rule.pattern 
                }, undefined, DLP_CONFIG.LOG_SOURCE);
                continue;
            }

            try {
                // Reset lastIndex for global regex reused from cache
                regex.lastIndex = 0; 
                const matches = text.match(regex);

                if (matches && matches.length > 0) {
                    // 1. Record Violation
                    result.violations.push({
                        ruleName: rule.name,
                        action: rule.action,
                        match: matches[0] // Sample match for logging (be careful with PII in logs)
                    });

                    // 2. Apply Action
                    if (rule.action === 'BLOCK') {
                        result.blocked = true;
                        // Optimization: If blocked, we can stop scanning other rules? 
                        // Depends on policy. Usually we want to find all violations.
                    } else if (rule.action === 'REDACT') {
                        // Apply redaction
                        result.redactedText = result.redactedText.replace(regex, (match) => 
                            DLP_CONFIG.REDACTION_CHAR.repeat(match.length || DLP_CONFIG.REDACTION_FALLBACK_LEN)
                        ); 
                    }
                }
            } catch (e: any) {
                systemService.log('ERROR', 'DLP Execution Error', { 
                    ruleName: rule.name, 
                    error: e.message 
                }, undefined, DLP_CONFIG.LOG_SOURCE);
            }
        }

        // Audit Log if violations found
        if (result.violations.length > 0) {
            systemService.log('INFO', 'DLP Scan Detected Violations', { 
                count: result.violations.length, 
                blocked: result.blocked,
                rules: result.violations.map(v => v.ruleName)
            }, undefined, DLP_CONFIG.LOG_SOURCE);
        }

        return result;
    }
    
    /**
     * Clear regex cache (e.g., when config updates)
     */
    clearCache() {
        this.regexCache.clear();
    }
}

export const dlpService = new DlpService();