// 理由: 非アクティブ判定の基準となる最終アクティブ時刻を追跡するため
const tabActivity = {};

// 理由: 拡張の起動直後に全タブへ基準時刻を与え、即時削除を防ぐため
async function seedAllTabs() {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    for (const t of tabs) tabActivity[t.id] = now;
}

// 理由: ユーザーの明示的なフォーカス移動を最新アクティビティとして扱うため
chrome.tabs.onActivated.addListener(({ tabId }) => {
    tabActivity[tabId] = Date.now();
});

// 理由: ナビゲーション直後やタブの更新でも活動とみなし、誤削除を避けるため
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab?.active) tabActivity[tabId] = Date.now();
});

// 理由: 閉じたタブの情報を保持し続けるとリークや誤判定につながるため
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabActivity[tabId];
});

// 理由: インストール/起動時に定期的な清掃をスケジュールして安定動作させるため
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

// 理由: 事前に指定された除外URLは削除対象から外すべきため
function isWhitelisted(url, list) {
    return (list || []).some((entry) => url?.startsWith(entry));
}

// 理由: 誤削除時の復旧やユーザーへの可視化のため履歴を保持（上限あり）
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
        // 理由: ログ取得に失敗しても清掃自体は継続させるため
    }
}

// 理由: 時限処理で定期的にアイドルタブを清掃するため
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "sweep") return; // 理由: 他アラームと混同しないため

    const { timeoutMinutes = 30, whitelist = [] } =
        await chrome.storage.sync.get(["timeoutMinutes", "whitelist"]);
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000; // 理由: 極端な値でも最低1分は確保するため
    const now = Date.now();

    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        if (!tab || !tab.id || !tab.url) continue; // 理由: 不完全な情報では判定できないため

        // 理由: 除外対象のタブはユーザー意図を尊重してスキップするため
        if (isWhitelisted(tab.url, whitelist)) continue;

        const last = tabActivity[tab.id];

        //理由: 情報確認用
        console.log(
        "[tab information]",
        "\n時刻: ",new Date(),
        "\n設定時刻: ",timeoutMinutes,
        "\n経過時刻: ",Math.round((now - last)/60000),
        "\nURL: ",tab.url
        );

        // 理由: アクティブ/再生中/ピン留めのタブは利用中の意図が強いため期限を延長する
        if (tab.active || tab.audible || tab.pinned) {
            tabActivity[tab.id] = Date.now();
            continue;
        }
        

        // 理由: 活動履歴が取れないタブはゾンビ化の可能性があるためフェイルセーフで掃除する
        if (last === undefined) {
            try {
                await logRemovedTab(tab);
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];
            } catch (_) {
                // 理由: 既に閉じられている等の競合時でも失敗を無視して続行するため
            }
            continue;
        }



        // 理由: 閾値を超過したタブはリソース解放と視認性向上のため閉じる
        if (now - last > timeoutMs) {
            try {
                await logRemovedTab(tab);
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];

            } catch (_) {
                // 理由: 競合や権限エラーでも処理全体を止めないため
            }
        }
    }
});

