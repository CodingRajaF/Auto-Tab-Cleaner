// 理由: タブごとの最終アクティビティを追跡し、削除判定の根拠を共有するため
const tabActivity = {};

// 理由: 拡張起動時点の全タブに同じ基準時刻を与え、誤差を抑えるため
async function seedAllTabs() {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    for (const t of tabs) {
        if (t?.id) {
            tabActivity[t.id] = now;
        }
    }
}

// 理由: ホワイトリストへの一致判定を共通化し、条件漏れを防ぐため
function isWhitelisted(url, list) {
    return (list || []).some((entry) => url?.startsWith(entry));
}

// 理由: 削除理由を含めて履歴を残し、復元時の判断材料にするため
async function logRemovedTab(tab, reason = "timeout") {
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
    const defaults = { timeoutMinutes: 30, fullCleanupMinutes: 1440 };
    const stored = await chrome.storage.sync.get([
        "timeoutMinutes",
        "fullCleanupMinutes",
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

    const updates = {};
    if (stored.timeoutMinutes !== timeoutMinutes) {
        updates.timeoutMinutes = timeoutMinutes;
    }
    if (stored.fullCleanupMinutes !== fullCleanupMinutes) {
        updates.fullCleanupMinutes = fullCleanupMinutes;
    }

    if (Object.keys(updates).length > 0) {
        await chrome.storage.sync.set(updates);
    }
}

// 理由: 分単位の設定をそのままミリ秒に変換し、ゼロや負数を排除するため
function minutesToMs(minutes) {
    return Math.max(1, minutes) * 60 * 1000;
}

chrome.runtime.onInstalled.addListener(async () => {
    await ensureDefaultSettings();
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(new Date(), "Alarm Installed: sweep");
});

chrome.runtime.onStartup.addListener(async () => {
    await ensureDefaultSettings();
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(new Date(), "Alarm Startup: sweep");
});

// 理由: アクティブ化直後のタブを最新とみなし、誤判定を避けるため
chrome.tabs.onActivated.addListener(({ tabId }) => {
    tabActivity[tabId] = Date.now();
});

// 理由: 表示更新時にアクティブであれば閲覧中と判断し猶予を更新するため
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab?.active) {
        tabActivity[tabId] = Date.now();
    }
});

// 理由: 閉じたタブの記録を即時削除し、メモリリークを防ぐため
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabActivity[tabId];
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "sweep") {
        return; // 理由: 他アラームと処理を混同しないため
    }

    const {
        timeoutMinutes = 30,
        fullCleanupMinutes = 1440,
        whitelist = [],
    } = await chrome.storage.sync.get([
        "timeoutMinutes",
        "fullCleanupMinutes",
        "whitelist",
    ]);

    const normalizedTimeout = Math.max(1, Math.floor(timeoutMinutes));
    let normalizedFullCleanup = Math.max(1, Math.floor(fullCleanupMinutes));
    if (normalizedFullCleanup <= normalizedTimeout) {
        normalizedFullCleanup = normalizedTimeout + 1;
    }

    const timeoutMs = minutesToMs(normalizedTimeout);
    const fullCleanupMs = minutesToMs(normalizedFullCleanup);
    const now = Date.now();
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        if (!tab || !tab.id || !tab.url) {
            continue; // 理由: 判定に必要な情報が欠落しているため
        }

        if (tab.active || tab.audible || tab.pinned) {
            tabActivity[tab.id] = now;
            continue; // 理由: ユーザー操作中のタブは削除対象外とするため
        }

        const lastActivity = tabActivity[tab.id];

        if (lastActivity === undefined) {
            try {
                await logRemovedTab(tab, "unknown");
                await chrome.tabs.remove(tab.id);
            } catch (error) {
                console.warn("Failed to remove tab without activity", tab?.id, error);
            } finally {
                delete tabActivity[tab.id];
            }
            continue;
        }

        const elapsed = now - lastActivity;
        const forceRemoval = elapsed >= fullCleanupMs;
        const whitelisted = isWhitelisted(tab.url, whitelist);

        if (!forceRemoval && whitelisted) {
            continue; // 理由: 通常猶予内のホワイトリストは尊重するため
        }

        const timeoutExceeded = elapsed >= timeoutMs;
        if (!forceRemoval && !timeoutExceeded) {
            continue;
        }

        const reason = forceRemoval ? "fullCleanup" : "timeout";
        try {
            await logRemovedTab(tab, reason);
            await chrome.tabs.remove(tab.id);
        } catch (error) {
            console.warn("Failed to remove tab", { tabId: tab?.id, reason }, error);
            continue;
        }

        delete tabActivity[tab.id];
        console.log("[tab cleanup]", {
            reason,
            tabId: tab.id,
            url: tab.url,
            elapsedMinutes: Math.round(elapsed / 60000),
            timeoutMinutes: normalizedTimeout,
            fullCleanupMinutes: normalizedFullCleanup,
            loggedAt: new Date(now).toISOString(),
        });
    }
});
