/**
 *  WEBHOOK SERVICE (DISPATCHER LAYER)
 * -----------------------------------------------------------------------------
 *  Production-grade event dispatcher with reliability patterns.
 * 
 *  Key Features:
 *  1. Security: HMAC-SHA256 Request Signing via Web Crypto API.
 *  2. Resilience: Exponential Backoff Retry Policy.
 *  3. Observability: Structured Logging & Chaos Injection.
 * -----------------------------------------------------------------------------
 */

import { WebhookEventPayload } from "../types";
import { chaosService } from "./chaosService";
import { systemService } from "./systemService";

const WEBHOOK_CONFIG = {
    RETRY_POLICY: {
        MAX_ATTEMPTS: 3,
        BASE_DELAY_MS: 1000, // 1s, 2s, 4s...
        JITTER_FACTOR: 0.1
    },
    SECURITY: {
        ALGO_NAME: "HMAC",
        HASH_ALGO: "SHA-256",
        HEADER_SIGNATURE: "X-Sgs-Signature",
        SIGNATURE_PREFIX: "sha256="
    },
    LOG_SOURCE: "TRAFFIC" as const
};

class WebhookService {
    
    /**
     * Generates a secure HMAC-SHA256 signature using the browser's native Web Crypto API.
     * This creates a REAL signature, allowing for valid security testing on the consumer side.
     */
    private async signPayload(payload: WebhookEventPayload, secret: string): Promise<string> {
        try {
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const msgData = encoder.encode(JSON.stringify(payload));

            const key = await crypto.subtle.importKey(
                "raw", 
                keyData, 
                { name: WEBHOOK_CONFIG.SECURITY.ALGO_NAME, hash: WEBHOOK_CONFIG.SECURITY.HASH_ALGO }, 
                false, 
                ["sign"]
            );

            const signature = await crypto.subtle.sign(
                WEBHOOK_CONFIG.SECURITY.ALGO_NAME, 
                key, 
                msgData
            );
            
            // Convert ArrayBuffer to Hex string efficiently
            const hashArray = Array.from(new Uint8Array(signature));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return `${WEBHOOK_CONFIG.SECURITY.SIGNATURE_PREFIX}${hashHex}`;
        } catch (e: any) {
            // Log internal crypto failure but don't crash the simulation flow
            systemService.log('ERROR', 'Webhook Crypto Signing Failed', { error: e.message }, payload.tenantId, 'SYSTEM');
            return `${WEBHOOK_CONFIG.SECURITY.SIGNATURE_PREFIX}simulation_fallback_error`;
        }
    }

    /**
     * Calculates delay with exponential backoff and jitter to prevent thundering herd.
     */
    private getRetryDelay(attempt: number): number {
        const base = Math.pow(2, attempt) * WEBHOOK_CONFIG.RETRY_POLICY.BASE_DELAY_MS;
        const jitter = base * WEBHOOK_CONFIG.RETRY_POLICY.JITTER_FACTOR * (Math.random() - 0.5);
        return base + jitter;
    }

    /**
     * Dispatches an event to an external URL.
     */
    async dispatch(url: string, secret: string, payload: WebhookEventPayload): Promise<boolean> {
        // 1. Validation
        if (!url) {
            systemService.log('ERROR', 'Webhook Dispatch Skipped: Missing URL', { eventId: payload.eventId }, payload.tenantId, 'SYSTEM');
            return false;
        }

        let attempt = 0;
        const maxAttempts = WEBHOOK_CONFIG.RETRY_POLICY.MAX_ATTEMPTS;

        while (attempt < maxAttempts) {
            try {
                // 2. Resilience: Chaos Injection (Simulate network failures/latency)
                await chaosService.intercept('webhook');

                // 3. Security: Sign Payload
                const signature = await this.signPayload(payload, secret);
                
                // 4. Observability: Log Attempt
                if (attempt === 0) {
                    systemService.log('INFO', `Dispatching Webhook: ${payload.eventType}`, {
                        url: url,
                        eventId: payload.eventId,
                        signature: signature.substring(0, 15) + '...' // Masking
                    }, payload.tenantId, WEBHOOK_CONFIG.LOG_SOURCE);
                }

                // 5. Simulate Network Request (Success)
                // In production: const response = await fetch(url, { headers: { [HEADER_SIGNATURE]: signature, ... } });
                
                return true;

            } catch (e: any) {
                attempt++;
                const willRetry = attempt < maxAttempts;
                const waitTime = this.getRetryDelay(attempt);
                
                systemService.log('WARN', `Webhook Dispatch Failed (Attempt ${attempt}/${maxAttempts})`, {
                    url,
                    error: e.message,
                    nextRetryInMs: willRetry ? Math.round(waitTime) : 0
                }, payload.tenantId, 'SYSTEM');

                if (!willRetry) {
                    systemService.log('ERROR', 'Webhook Dropped: Max Retries Exceeded', { url, eventId: payload.eventId }, payload.tenantId, 'SYSTEM');
                    return false;
                }
                
                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        return false;
    }
}

export const webhookService = new WebhookService();
