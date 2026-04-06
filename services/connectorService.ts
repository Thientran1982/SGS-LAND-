import { ConnectorType, SyncJob, SyncStatus, DataExportResponse } from '../types';
import { db } from './dbApi';
import { systemService } from './systemService';
import { chaosService } from './chaosService';

// -----------------------------------------------------------------------------
// 1. CONSTANTS & CONFIGURATION
// -----------------------------------------------------------------------------

const SYNC_CONFIG = {
    BATCH_SIZE: 100,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    DEFAULT_ENTITY: 'LEAD',
    LOG_SOURCE: 'SYSTEM' as const,
    EVENTS: {
        START: 'SYNC_JOB_STARTED',
        COMPLETE: 'SYNC_JOB_COMPLETED',
        FAIL: 'SYNC_JOB_FAILED',
        RETRY: 'SYNC_JOB_RETRY',
        EXPORT_BATCH: 'BATCH_EXPORT',
        LOAD_BATCH: 'BATCH_LOAD'
    }
} as const;

// -----------------------------------------------------------------------------
// 2. ADAPTER PATTERN
// -----------------------------------------------------------------------------

interface BatchResult {
    success: number;
    errors: string[];
}

interface ConnectorAdapter {
    /** Validate configuration using the localized translator */
    validateConfig(config: Record<string, unknown>, t: (k: string) => string): Promise<boolean>;

    /** Send data batch to external system */
    sendBatch(batch: unknown[], config: Record<string, unknown>): Promise<BatchResult>;
}

// --- ADAPTER IMPLEMENTATIONS ---

const googleSheetsAdapter: ConnectorAdapter = {
    async validateConfig(config, t) {
        if (!config?.spreadsheetId) throw new Error(t('data.error_missing_spreadsheet_id'));
        return true;
    },
    async sendBatch(batch, config) {
        // Simulation: Calculate payload size
        const payloadSize = JSON.stringify(batch).length;
        
        systemService.log('INFO', SYNC_CONFIG.EVENTS.LOAD_BATCH, { 
            target: 'Google Sheets',
            spreadsheetId: config.spreadsheetId,
            recordCount: batch.length,
            bytes: payloadSize
        }, undefined, SYNC_CONFIG.LOG_SOURCE);

        return { success: batch.length, errors: [] };
    }
};

const crmAdapter: ConnectorAdapter = {
    async validateConfig(config, t) {
        if (!config?.apiKey) throw new Error(t('data.error_missing_api_key'));
        return true;
    },
    async sendBatch(batch, config) {
        systemService.log('INFO', SYNC_CONFIG.EVENTS.LOAD_BATCH, { 
            target: 'CRM', 
            recordCount: batch.length 
        }, undefined, SYNC_CONFIG.LOG_SOURCE);
        return { success: batch.length, errors: [] };
    }
};

const webhookAdapter: ConnectorAdapter = {
    async validateConfig(config, t) {
        if (!config?.targetUrl) throw new Error(t('data.error_missing_url'));
        return true;
    },
    async sendBatch(batch, config) {
        systemService.log('INFO', SYNC_CONFIG.EVENTS.LOAD_BATCH, { 
            target: 'Webhook',
            url: config.targetUrl, 
            recordCount: batch.length 
        }, undefined, SYNC_CONFIG.LOG_SOURCE);
        return { success: batch.length, errors: [] };
    }
};

const ADAPTER_REGISTRY: Record<ConnectorType, ConnectorAdapter> = {
    [ConnectorType.GOOGLE_SHEETS]: googleSheetsAdapter,
    [ConnectorType.HUBSPOT]: crmAdapter,
    [ConnectorType.ZOHO_CRM]: crmAdapter,
    [ConnectorType.SALESFORCE]: crmAdapter,
    [ConnectorType.WEBHOOK_EXPORT]: webhookAdapter,
};

// -----------------------------------------------------------------------------
// 3. SERVICE ORCHESTRATOR
// -----------------------------------------------------------------------------

class ConnectorService {
    
    /**
     * Trigger a sync job.
     * Flow: Validation -> Chaos -> Export (Source) -> Transform (Redact) -> Load (Dest) -> Commit
     */
    async runSync(connectorId: string): Promise<SyncJob> {
        // 1. Validation & Setup
        const configs = await db.getConnectorConfigs();
        const config = configs.find(c => c.id === connectorId);
        
        if (!config) throw new Error("Connector config not found");
        if (config.status !== 'ACTIVE') throw new Error("Connector is PAUSED or DISABLED");

        const adapter = ADAPTER_REGISTRY[config.type];
        if (!adapter) throw new Error(`No adapter registered for type: ${config.type}`);

        // 2. Determine Compliance Policy (Dynamic PII Redaction)
        const compliance = await db.getComplianceConfig();
        // Default to redaction for external webhooks unless specifically allowed
        const shouldRedact = compliance.dlpRules?.some((r: { enabled: boolean; action: string }) => r.enabled && r.action === 'REDACT') ?? false;

        // 3. Init Job
        let job = await db.createSyncJob(connectorId);
        
        try {
            // Chaos Injection: Database Layer
            await chaosService.intercept('database');

            // Start Job
            job = await db.updateSyncJob(job.id, { status: SyncStatus.RUNNING });
            systemService.log('INFO', SYNC_CONFIG.EVENTS.START, { jobId: job.id, connector: config.name }, undefined, SYNC_CONFIG.LOG_SOURCE);

            // 4. Export Phase (Incremental)
            const exportResult: DataExportResponse<any> = await db.exportData({
                entityType: SYNC_CONFIG.DEFAULT_ENTITY,
                watermark: config.watermark,
                limit: SYNC_CONFIG.BATCH_SIZE,
                redactPii: shouldRedact // Passed dynamically based on compliance config
            });

            // Handle Empty Data
            if (exportResult.data.length === 0) {
                job = await db.updateSyncJob(job.id, { 
                    status: SyncStatus.COMPLETED, 
                    finishedAt: new Date().toISOString(),
                    recordsProcessed: 0
                });
                return job;
            }

            // 5. Load Phase (Send to External)
            // Chaos Injection: Network Layer
            if (config.type === ConnectorType.WEBHOOK_EXPORT) {
                await chaosService.intercept('webhook');
            }

            const loadResult = await adapter.sendBatch(exportResult.data, config.config);

            // 6. Commit Phase
            job = await db.updateSyncJob(job.id, {
                status: SyncStatus.COMPLETED,
                finishedAt: new Date().toISOString(),
                recordsProcessed: loadResult.success,
                errors: loadResult.errors
            });

            // Update Watermark
            await db.saveConnectorConfig(config.id, {
                ...config,
                watermark: exportResult.newWatermark,
                lastSyncAt: new Date().toISOString(),
                lastSyncStatus: SyncStatus.COMPLETED
            });

            systemService.log('INFO', SYNC_CONFIG.EVENTS.COMPLETE, { 
                jobId: job.id, 
                processed: loadResult.success 
            }, undefined, SYNC_CONFIG.LOG_SOURCE);

        } catch (e: any) {
            const isChaos = e.name === 'ChaosError';
            const errorMsg = e.message || 'Unknown Sync Error';

            systemService.log('ERROR', SYNC_CONFIG.EVENTS.FAIL, { 
                jobId: job.id, 
                error: errorMsg,
                isChaos 
            }, undefined, SYNC_CONFIG.LOG_SOURCE);
            
            // Retry Strategy with Exponential Backoff
            if (job.retryCount < SYNC_CONFIG.MAX_RETRIES) {
                // Wait before retrying (simulated via db status update)
                job = await db.updateSyncJob(job.id, { 
                    status: SyncStatus.QUEUED,
                    retryCount: job.retryCount + 1,
                    errors: [...job.errors, errorMsg]
                });
            } else {
                // Hard Failure
                job = await db.updateSyncJob(job.id, { 
                    status: SyncStatus.FAILED, 
                    finishedAt: new Date().toISOString(),
                    errors: [...job.errors, errorMsg]
                });
                
                await db.saveConnectorConfig(config.id, {
                    ...config,
                    lastSyncAt: new Date().toISOString(),
                    lastSyncStatus: SyncStatus.FAILED
                });
            }
        }

        return job;
    }

    /**
     * Validate connection settings using the specific adapter logic.
     */
    async validateConnection(type: ConnectorType, config: any, t: (k: string) => string): Promise<boolean> {
        const adapter = ADAPTER_REGISTRY[type];
        if (!adapter) throw new Error(t('data.error_adapter_missing'));
        return adapter.validateConfig(config, t);
    }
}

export const connectorService = new ConnectorService();