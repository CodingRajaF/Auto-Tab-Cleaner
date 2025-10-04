// 理由: タブごとの最終アクティビティを追跡し、削除判定の根拠を共有するため
// 理由: タブごとの最終アクティビティを永続化し、再起動後も削除ロジックを継続するため
let tabActivity: Record<number, number> = {};

// 理由: tabActivityをchrome.storage.localに保存する共通関数
async function saveTabActivity() {
    try {
        await chrome.storage.local.set({ tabActivity });
    } catch (e) {
        console.warn('Failed to save tabActivity', e);
    }
}

// 理由: chrome.storage.localからtabActivityを復元する共通関数
async function loadTabActivity() {
    try {
        const data = await chrome.storage.local.get('tabActivity');
        if (data.tabActivity && typeof data.tabActivity === 'object') {
            tabActivity = data.tabActivity;
        } else {
            tabActivity = {};
        }
    } catch (e) {
        tabActivity = {};
        console.warn('Failed to load tabActivity', e);
    }
}

// 理由: 拡張起動時点の全タブに同じ基準時刻を与え、誤差を抑えるため
// 理由: 拡張起動時点の全タブに同じ基準時刻を与え、誤差を抑えるため
async function seedAllTabs() {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    for (const t of tabs) {
        if (t?.id) {
            tabActivity[t.id] = now;
        }
    }
    await saveTabActivity(); // 理由: 初期化時も永続化するため
}

// 理由: ホワイトリストへの一致判定を共通化し、条件漏れを防ぐため
function isWhitelisted(url:string, list: string[]): boolean {
    return (list || []).some((entry) => url?.startsWith(entry));
}

// 理由: 削除理由を含めて履歴を残し、復元時の判断材料にするため
async function logRemovedTab(tab: chrome.tabs.Tab, reason = "timeout") {
    try {
        const entry = {
            url: tab.url,
            title: tab.title || tab.url,
            favIconUrl: tab.favIconUrl || "",
            removedAt: Date.now(),
            reason,
        };
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );
        recentlyRemoved.unshift(entry);
        const trimmed = recentlyRemoved.slice(0, 15);
        await chrome.storage.local.set({ recentlyRemoved: trimmed });
    } catch (error) {
        console.warn("Failed to log removed tab", { tabId: tab?.id, reason }, error);
    }
}

// 理由: 設定未初期化でも確実に既定値を利用できるよう保証するため
async function ensureDefaultSettings() {
    const defaults = {
        timeoutMinutes: 30,
        fullCleanupMinutes: 1440,
        fullCleanupEnabled: true,
    };
    const stored = await chrome.storage.sync.get([
        "timeoutMinutes",
        "fullCleanupMinutes",
        "fullCleanupEnabled",
    ]);

    let timeoutMinutes = Number(stored.timeoutMinutes);
    if (!Number.isFinite(timeoutMinutes) || timeoutMinutes < 1) {
        timeoutMinutes = defaults.timeoutMinutes;
    } else {
        timeoutMinutes = Math.floor(timeoutMinutes);
    }

    let fullCleanupMinutes = Number(stored.fullCleanupMinutes);
    if (!Number.isFinite(fullCleanupMinutes) || fullCleanupMinutes < 1) {
        fullCleanupMinutes = defaults.fullCleanupMinutes;
    } else {
        fullCleanupMinutes = Math.floor(fullCleanupMinutes);
    }

    if (fullCleanupMinutes <= timeoutMinutes) {
        fullCleanupMinutes = Math.max(timeoutMinutes + 1, defaults.fullCleanupMinutes);
    }

    const fullCleanupEnabled = stored.fullCleanupEnabled !== false;

    interface Updates {
        timeoutMinutes?: number;
        fullCleanupMinutes?: number;
        fullCleanupEnabled?: boolean;
    }
    const updates: Updates = {};
    if (stored.timeoutMinutes !== timeoutMinutes) {
        updates.timeoutMinutes = timeoutMinutes;
    }
    if (stored.fullCleanupMinutes !== fullCleanupMinutes) {
        updates.fullCleanupMinutes = fullCleanupMinutes;
    }
    if (stored.fullCleanupEnabled !== fullCleanupEnabled) {
        updates.fullCleanupEnabled = fullCleanupEnabled;
    }

    if (Object.keys(updates).length > 0) {
        await chrome.storage.sync.set(updates);
    }
}

// 理由: 分単位の設定をそのままミリ秒に変換し、ゼロや負数を排除するため
function minutesToMs(minutes: number): number {
    return Math.max(1, minutes) * 60 * 1000;
}

chrome.runtime.onInstalled.addListener(async () => {
    await ensureDefaultSettings();
    await loadTabActivity(); // 理由: 起動時に永続化データを復元するため
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(new Date(), "Alarm Installed: sweep");
});

chrome.runtime.onStartup.addListener(async () => {
    await ensureDefaultSettings();
    await loadTabActivity(); // 理由: 起動時に永続化データを復元するため
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(new Date(), "Alarm Startup: sweep");
});

// 理由: アクティブ化直後のタブを最新とみなし、誤判定を避けるため

// 理由: アクティブ化直後のタブを最新とみなし、誤判定を避けるため
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    tabActivity[tabId] = Date.now();
    await saveTabActivity(); // 理由: 状態変化ごとに即時保存するため
});

// 理由: 表示更新時にアクティブであれば閲覧中と判断し猶予を更新するため

// 理由: 表示更新時にアクティブであれば閲覧中と判断し猶予を更新するため
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tab?.active) {
        tabActivity[tabId] = Date.now();
        await saveTabActivity(); // 理由: 状態変化ごとに即時保存するため
    }
});

// 理由: 閉じたタブの記録を即時削除し、メモリリークを防ぐため

// 理由: 閉じたタブの記録を即時削除し、メモリリークと永続データ残りを防ぐため
chrome.tabs.onRemoved.addListener(async (tabId) => {
    delete tabActivity[tabId];
    await saveTabActivity(); // 理由: 削除時も即時保存するため
});


chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log(new Date(), "Alarm Triggered:", alarm.name);
    if (alarm.name !== "sweep") {
        return; // 理由: 他アラームと処理を混同しないため
    }

    // 理由: アラーム発火時も最新の永続化データを参照するため
    await loadTabActivity();

    const settings = await chrome.storage.sync.get([
        "timeoutMinutes",
        "fullCleanupMinutes",
        "fullCleanupEnabled",
        "whitelist",
    ]);

    const normalizedTimeout = Math.max(1, Math.floor(settings.timeoutMinutes ?? 30));
    let normalizedFullCleanup = Math.max(
        1,
        Math.floor(settings.fullCleanupMinutes ?? 1440)
    );
    if (normalizedFullCleanup <= normalizedTimeout) {
        normalizedFullCleanup = normalizedTimeout + 1;
    }

    const fullCleanupEnabled = settings.fullCleanupEnabled !== false;
    const whitelist = settings.whitelist || [];

    const timeoutMs = minutesToMs(normalizedTimeout);
    const fullCleanupMs = minutesToMs(normalizedFullCleanup);
    const now = Date.now();
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        if (!tab || !tab.id || !tab.url) {
            console.warn(`Skipping invalid tab\n  tabTitle: ${tab?.title || tab?.url || "invalid tab"}`);
            continue; // 理由: 判定に必要な情報が欠落しているため
        }

        if (tab.active || tab.audible || tab.pinned) {
            tabActivity[tab.id] = now;
            console.log(`Skipping active/audible/pinned tab\n  tabTitle: ${tab.title || tab.url}`);
            continue; // 理由: ユーザー操作中のタブは削除対象外とするため
        }

        const lastActivity = tabActivity[tab.id];

        if (lastActivity === undefined) {
            try {
                tabActivity[tab.id] = now;
                console.log(`Seeding tab activity\n  tabTitle: ${tab.title || tab.url}`);
                continue;
            } catch (error) {
                console.warn(`Failed to seed tab activity\n  tabTitle: ${tab.title || tab.url}\n  error: ${error}`);
                continue;
            }
        }

        const elapsed = now - lastActivity;
        const forceRemoval = fullCleanupEnabled && elapsed >= fullCleanupMs;
        // forceRemoval（全体クリーンアップ時）はホワイトリストを無視して削除します（仕様通り）。
                const whitelisted = isWhitelisted(tab.url, whitelist);
        
                if (!forceRemoval && whitelisted) {
                    console.log(`Skipping whitelisted tab\n  tabTitle: ${tab.title || tab.url}`);
                    continue; // 理由: 通常猶予内のホワイトリストは尊重するため
                }

        const timeoutExceeded = elapsed >= timeoutMs;
        if (!forceRemoval && !timeoutExceeded) {
            console.log(`Skipping tab\n  tabTitle: ${tab.title || tab.url}\n  elapsedMinutes: ${Math.round(elapsed / 60000)}\n  timeoutMinutes: ${normalizedTimeout}`);
            continue;
        }

        const reason = forceRemoval ? "fullCleanup" : "timeout";
        try {
            await logRemovedTab(tab, reason);
            await chrome.tabs.remove(tab.id);
        } catch (error) {
            console.warn(`Failed to remove tab\n  tabTitle: ${tab?.title}\n  reason: ${reason}\n  error: ${error}`);
            continue;
        }

        delete tabActivity[tab.id];
        console.log(`[tab cleanup]\n  reason: ${reason}\n  tabId: ${tab.id}\n  url: ${tab.url}\n  elapsedMinutes: ${Math.round(elapsed / 60000)}\n  timeoutMinutes: ${normalizedTimeout}\n  fullCleanupMinutes: ${normalizedFullCleanup}\n  fullCleanupEnabled: ${fullCleanupEnabled}\n  loggedAt: ${new Date(now).toISOString()}`);
    }
    await saveTabActivity(); // 理由: 変更後の状態を永続化するため
});
