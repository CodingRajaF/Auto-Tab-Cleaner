declare let tabActivity: Record<number, number>;
declare function saveTabActivity(): Promise<void>;
declare function loadTabActivity(): Promise<void>;
declare function seedAllTabs(): Promise<void>;
declare function isWhitelisted(url: string, list: string[]): boolean;
declare function logRemovedTab(tab: chrome.tabs.Tab, reason?: string): Promise<void>;
declare function notifyTabRemoved(tab: chrome.tabs.Tab, reason: string): void;
declare function ensureDefaultSettings(): Promise<void>;
declare function minutesToMs(minutes: number): number;
//# sourceMappingURL=background.d.ts.map