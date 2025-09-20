// 最終アクティブ時刻を追跡
const tabActivity = {};

// 起動/再起動/インストール時：全タブに初期値を入れる
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
    if (tab.active) tabActivity[tabId] = Date.now();
});

// タブが閉じられたらメモリ掃除
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabActivity[tabId];
});

// アラームで定期チェック（1分ごと）
chrome.runtime.onInstalled.addListener(async () => {
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(Date(Date.now()),"\nAlarm Installed : sweep");
});
chrome.runtime.onStartup.addListener(async () => {
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log(Date(Date.now()),"\nAlarm Starup : sweep");
});

// ホワイトリスト判定のヘルパ
function isWhitelisted(url, list) {
    return (list || []).some(entry => url?.startsWith(entry));
}

// 定期削除本体
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log(Date(Date.now()),"\nAlarm Fired:",alarm.name)
    if (alarm.name !== "sweep") return;

    const { timeoutMinutes = 30, whitelist = [] } = await chrome.storage.sync.get(["timeoutMinutes", "whitelist"]);
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
    const now = Date.now();

    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        if (!tab || !tab.id || !tab.url) continue;

        // ホワイトリストは除外
        if (isWhitelisted(tab.url, whitelist)) continue;

        // アクティビティ未記録のタブは即時削除（アクティブ除外済み）
        const last = tabActivity[tab.id];
        if (last === undefined) {
            try {
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];

            } catch (_) { /* 既に閉じられている等は無視 */ }
            continue;
        };

        console.log(
            Date(Date.now()),
            "\n削除時間(分):",
            timeoutMinutes,
            "\n経過時間:",
            Math.round((now - last) / 60 / 1000),
            "\nURL:",
            tab.url
        );

        // アクティブタブ,オーディオタブ,ピン(固定)タブは常にタブ時間を更新
        if (tab.active || tab.audible || tab.pinned) {
            tabActivity[tab.id]=Date.now();
            continue;
        };

        if (now - last > timeoutMs) {
            try {
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];
            } catch (_) { /* 既に閉じられている等は無視 */ }
        }
    }
});