declare const MINUTES_PER_HOUR = 60;
declare const DEFAULT_TIMEOUT_MINUTES = 30;
declare const DEFAULT_FULL_CLEANUP_HOURS = 24;
/**
 * DOM要素を取得するヘルパー
 */
declare function getElement<T extends HTMLElement>(selector: string): T | null;
/**
 * 必須DOM要素を取得し、nullの場合はエラーを表示
 */
declare function getRequiredElement<T extends HTMLElement>(selector: string, errorMsg: string): T | null;
/**
 * エラーメッセージを表示
 */
declare function showError(message: string): void;
/**
 * 成功メッセージを表示
 */
declare function showSuccess(message: string): void;
/**
 * Chrome Storage Syncからデータを取得
 */
declare function getStorageData<T>(keys: string[]): Promise<T>;
/**
 * Chrome Storage Syncにデータを保存
 */
declare function setStorageData(data: Record<string, any>): Promise<void>;
/**
 * Chrome Storage Localからデータを取得
 */
declare function getLocalStorageData<T>(keys: string[]): Promise<T>;
/**
 * Chrome Storage Localにデータを保存
 */
declare function setLocalStorageData(data: Record<string, any>): Promise<void>;
/**
 * 数値バリデーション
 */
declare function validateNumber(value: any, min: number | undefined, errorMessage: string): number | null;
/**
 * DOM要素を作成するヘルパー
 */
declare function createElement<T extends HTMLElement>(tagName: string, options?: {
    className?: string;
    textContent?: string;
    title?: string;
    type?: string;
    dataset?: Record<string, string>;
}): T;
declare function normalizeTimeout(value: number | undefined, fallback: number): number;
declare function normalizeFullCleanupHours(valueInMinutes: number | undefined, timeoutMinutes: number, fallbackHours: number): number;
declare function normalizeFullCleanupToggle(value: boolean | undefined): boolean;
declare function formatHours(hours: number): string;
//# sourceMappingURL=popup.d.ts.map