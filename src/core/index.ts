/**
 * Shopfloor core: business profiles, domain math, services, and ports.
 * Nothing in src/core may import NetSuite (N/*) or any other platform SDK.
 */
export * from './profiles/index';
export * from './domain/index';
export * from './errors';
export * from './ports/index';
export * from './services/index';
export { MemoryBackend } from './adapters/memory/index';
export type { MemorySale } from './adapters/memory/index';
