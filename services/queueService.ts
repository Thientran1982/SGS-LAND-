import { withRetry } from '../utils/aiUtils';

export type TaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface QueueTask<T = any, R = any> {
    id: string;
    type: string;
    payload: T;
    status: TaskStatus;
    result?: R;
    error?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    retries: number;
}

/**
 * A simple in-memory Queue System for processing heavy AI tasks in the background.
 * Supports concurrency limits and automatic retries via Exponential Backoff.
 */
class QueueService {
    private queue: QueueTask[] = [];
    private isProcessing: boolean = false;
    private concurrencyLimit: number = 2; // Process max 2 tasks concurrently to avoid rate limits
    private activeTasks: number = 0;
    private handlers: Map<string, (payload: any) => Promise<any>> = new Map();

    /**
     * Register a handler function for a specific task type.
     */
    registerHandler(type: string, handler: (payload: any) => Promise<any>) {
        this.handlers.set(type, handler);
    }

    /**
     * Add a new task to the queue.
     */
    enqueue<T>(type: string, payload: T): string {
        const id = `task_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
        const task: QueueTask<T> = {
            id,
            type,
            payload,
            status: 'PENDING',
            createdAt: Date.now(),
            retries: 0
        };
        
        this.queue.push(task);
        console.log(`[Queue] Task ${id} (${type}) enqueued. Queue length: ${this.queue.length}`);
        
        // Start processing if not already running
        this.processQueue();
        
        return id;
    }

    /**
     * Get the status of a specific task.
     */
    getTaskStatus(id: string): QueueTask | undefined {
        return this.queue.find(t => t.id === id);
    }

    /**
     * Get all tasks in the queue.
     */
    getAllTasks(): QueueTask[] {
        return [...this.queue];
    }

    /**
     * Process the queue with concurrency limits.
     */
    private async processQueue() {
        if (this.isProcessing && this.activeTasks >= this.concurrencyLimit) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.some(t => t.status === 'PENDING') && this.activeTasks < this.concurrencyLimit) {
            const taskIndex = this.queue.findIndex(t => t.status === 'PENDING');
            if (taskIndex === -1) break;

            const task = this.queue[taskIndex];
            task.status = 'PROCESSING';
            task.startedAt = Date.now();
            this.activeTasks++;

            // Process task asynchronously without awaiting here to allow concurrency
            this.executeTask(task).finally(() => {
                this.activeTasks--;
                this.processQueue(); // Trigger next task
            });
        }

        if (this.activeTasks === 0) {
            this.isProcessing = false;
        }
    }

    /**
     * Execute a single task with retry logic.
     */
    private async executeTask(task: QueueTask) {
        console.log(`[Queue] Processing task ${task.id} (${task.type})...`);
        
        const handler = this.handlers.get(task.type);
        if (!handler) {
            task.status = 'FAILED';
            task.error = `No handler registered for task type: ${task.type}`;
            task.completedAt = Date.now();
            console.error(`[Queue] Task ${task.id} failed: ${task.error}`);
            return;
        }

        try {
            // Use Exponential Backoff for the handler execution
            const result = await withRetry(
                () => handler(task.payload),
                3, // max retries
                2000 // base delay 2s
            );
            
            task.status = 'COMPLETED';
            task.result = result;
            task.completedAt = Date.now();
            console.log(`[Queue] Task ${task.id} completed successfully.`);
        } catch (error: any) {
            task.status = 'FAILED';
            task.error = error.message || 'Unknown error';
            task.completedAt = Date.now();
            console.error(`[Queue] Task ${task.id} failed after retries:`, error);
        }
    }
    
    /**
     * Clear completed and failed tasks from memory.
     */
    cleanup() {
        this.queue = this.queue.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING');
    }
}

export const queueService = new QueueService();
