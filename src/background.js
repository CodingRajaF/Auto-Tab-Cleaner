// 最終アクティブ時刻を追跡
const tabActivity = {};

// すべての既存タブに現在時刻をセット
async function seedAllTabs() {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    for (const t of tabs) tabActivity[t.id] = now;
}

// タブがアクティブ化されたら時刻更新
chrome.tabs.onActivated.addListener(({ tabId }) => {
    tabActivity[tabId] = Date.now();
});

// タブ更新時、activeなら時刻更新（URL遷移直後も拾える）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab?.active) tabActivity[tabId] = Date.now();
});

// タブが閉じられたらメモリ掃除
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabActivity[tabId];
});

// 起動/インストール時にアラーム設定
chrome.runtime.onInstalled.addListener(async () => {
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(new Date(), "Alarm Installed: sweep");
});
chrome.runtime.onStartup.addListener(async () => {
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(new Date(), "Alarm Startup: sweep");
});

// ホワイトリスト判定
function isWhitelisted(url, list) {
    return (list || []).some((entry) => url?.startsWith(entry));
}

// 削除したタブを履歴に保存（最大15件）
async function logRemovedTab(tab) {
    try {
        const entry = {
            url: tab.url,
            title: tab.title || tab.url,
            favIconUrl: tab.favIconUrl || "",
            removedAt: Date.now(),
        };
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );
        recentlyRemoved.unshift(entry);
        const trimmed = recentlyRemoved.slice(0, 15);
        await chrome.storage.local.set({ recentlyRemoved: trimmed });
    } catch (e) {
        // 失敗しても処理継続
    }
}

// 定期削除本体
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "sweep") return;

    const { timeoutMinutes = 30, whitelist = [] } =
        await chrome.storage.sync.get(["timeoutMinutes", "whitelist"]);
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
    const now = Date.now();

    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        if (!tab || !tab.id || !tab.url) continue;

        // ホワイトリストは除外
        if (isWhitelisted(tab.url, whitelist)) continue;

        const last = tabActivity[tab.id];

        // アクティビティ未記録のタブは即時削除
        if (last === undefined) {
            try {
                await logRemovedTab(tab);
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];
            } catch (_) {
                // 既に閉じられている等は無視
            }
            continue;
        }

        // アクティブ/音声再生/ピン留め中は延長
        if (tab.active || tab.audible || tab.pinned) {
            tabActivity[tab.id] = Date.now();
            continue;
        }

        // 閾値を超えたら削除
        if (now - last > timeoutMs) {
            try {
                await logRemovedTab(tab);
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];
            } catch (_) {
                // 無視
            }
        }
    }
});

