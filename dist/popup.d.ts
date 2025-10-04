declare const MINUTES_PER_HOUR = 60;
declare const DEFAULT_TIMEOUT_MINUTES = 30;
declare const DEFAULT_FULL_CLEANUP_HOURS = 24;
declare function normalizeTimeout(value: string, fallback: number): number;
declare function normalizeFullCleanupHours(valueInMinutes: number, timeoutMinutes: number, fallbackHours: number): number;
declare function normalizeFullCleanupToggle(value: boolean): boolean;
declare function formatHours(hours: number): string;
//# sourceMappingURL=popup.d.ts.map