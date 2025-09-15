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
    console.log("Alarm set:","sweep",Date.now().toLocaleString("ja-JP"));
});
chrome.runtime.onStartup.addListener(async () => {
    await seedAllTabs();
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    console.log("Alarm set:","sweep",Date.now().toLocaleString("ja-JP"));
});

// ホワイトリスト判定のヘルパ
function isWhitelisted(url, list) {
    return (list || []).some(entry => url?.startsWith(entry));
}

// 定期削除本体
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "sweep") return;

    const { timeoutMinutes = 30, whitelist = [] } = await chrome.storage.sync.get(["timeoutMinutes", "whitelist"]);
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
    const now = Date.now();

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
	if (!tab || !tab.id || !tab.url) continue;
	if (isWhitelisted(tab.url, whitelist)) {
        console.log(tab.url,"is whitelist member",Date.now().toLocaleString("ja-JP"));
        continue;
    };

	const last = tabActivity[tab.id] ?? now; // 未記録なら今を入れて猶予スタート
	if (now - last > timeoutMs) {
	    try {
		await chrome.tabs.remove(tab.id);
		delete tabActivity[tab.id];
	    } catch (_) { /* 既に閉じられてる等は無視 */ }
	}
    }
});
