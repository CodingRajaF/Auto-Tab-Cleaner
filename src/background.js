// タブの最終アクティブ時刻を追跡
const tabActivity = {};

chrome.tabs.onActivated.addListener(activeInfo => {
    tabActivity[activeInfo.tabId] = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active) {
        tabActivity[tabId] = Date.now();
    }
});

// 定期的にチェックして削除
setInterval(() => {
    chrome.storage.sync.get(["timeoutMinutes", "whitelist"], (data) => {
        const timeout = (data.timeoutMinutes || 30) * 60 * 1000;
        const whitelist = data.whitelist || [];

        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                // ホワイトリスト判定
                if (whitelist.some(url => tab.url.startsWith(url))) return;

                const lastActive = tabActivity[tab.id] || Date.now();
                if (Date.now() - lastActive > timeout) {
                    chrome.tabs.remove(tab.id);
                }
            });
        });
    });
}, 60 * 1000); // 1分ごとにチェック
