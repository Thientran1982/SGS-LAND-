// I3: Refactored — defaultPrompts.ts is now a barrel re-export file.
// Each domain has its own prompt file for maintainability.
// Direct imports from domain files are preferred; this file exists for backward compatibility.

export * from './routerPrompts';
export * from './systemPrompts';
export * from './specialistPrompts';
export * from './valuationPrompts';
export * from './marketingGrowthPrompts';
