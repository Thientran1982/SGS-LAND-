// @ts-nocheck
// =======================================================
// SGS-LAND TYPES: Workflow & Automation
// =======================================================

// =============================================================================
// 5. WORKFLOW & AUTOMATION
// =============================================================================

export enum TaskStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
    OVERDUE = 'OVERDUE',
    CANCELED = 'CANCELED'
}
export enum Priority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}
export interface Task {
    id: TaskId;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    relatedEntityId?: string; // Polymorphic ID
    relatedEntityType?: 'LEAD' | 'LISTING' | 'DEAL' | 'CAMPAIGN';
    assignedTo?: UserId;
    dueDate: ISOString;
    createdAt: ISOString;
}
export enum RoutingStrategy {
    ROUND_ROBIN = 'ROUND_ROBIN',
    WEIGHTED_ROUND_ROBIN = 'WEIGHTED_ROUND_ROBIN',
    SKILL_BASED = 'SKILL_BASED',
    BEST_AVAILABLE = 'BEST_AVAILABLE'
}
export interface RoutingCondition {
    source?: string[];
    region?: string[];
    projects?: string[];
    tags?: string[];
    budgetMin?: number;
    budgetMax?: number;
    temperature?: string[];
}
export interface RoutingRule {
    id: UUID;
    name: string;
    priority: number;
    conditions: RoutingCondition;
    action: {
        type: 'ASSIGN_TEAM' | 'ASSIGN_USER';
        targetId: string; // UUID of Team or User
        strategy: RoutingStrategy;
        requiredSkills?: string[];
    };
    enabled?: boolean;
    isActive?: boolean;
}