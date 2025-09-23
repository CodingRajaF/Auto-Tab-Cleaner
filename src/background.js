// タブの最終アクティブ時刻を保持して整理判断に使う
const tabActivity = {};

const TAB_GROUP_ID_NONE = -1;
const DOMAIN_GROUP_COLOR = "blue";
const IGNORED_SCHEMES = new Set([
    "chrome:",
    "chrome-extension:",
    "edge:",
    "edge-extension:",
    "moz-extension:",
    "opera:",
    "vivaldi:",
    "brave:",
    "about:"
]);

// 起動時点で存在するタブのアクティビティを初期化する
async function seedAllTabs() {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    for (const tab of tabs) {
        tabActivity[tab.id] = now;
    }
}

// ホワイトリストは前方一致で判定する
function isWhitelisted(url, list) {
    return (list || []).some((entry) => url?.startsWith(entry));
}

// URLからドメイン文字列だけを取り出し整理対象を決める
function extractHostname(targetUrl) {
    if (!targetUrl) {
        return null;
    }

    const scheme = targetUrl.split("/", 1)[0]?.toLowerCase();
    if (scheme && IGNORED_SCHEMES.has(scheme)) {
        return null;
    }

    try {
        const parsed = new URL(targetUrl);
        return parsed.hostname;
    } catch (_) {
        return null;
    }
}

// 共通タブ上限の設定値を取得し数値へ正規化する
async function loadDomainLimit() {
    const { defaultDomainLimit = 0 } = await chrome.storage.sync.get("defaultDomainLimit");
    const parsed = Number.parseInt(defaultDomainLimit, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// ドメイン名をタイトルとしたタブグループを確保する
async function ensureDomainGroup(tab, domain) {
    if (!tab?.id || !domain) {
        return null;
    }

    try {
        if (tab.groupId !== TAB_GROUP_ID_NONE) {
            const currentGroup = await chrome.tabGroups.get(tab.groupId);
            if (currentGroup?.title === domain) {
                return currentGroup.id;
            }
        }
    } catch (_) {
        // 取得失敗時は既存グループ探索へフォールバック
    }

    try {
        const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
        const matched = groups.find((group) => group.title === domain);
        if (matched) {
            await chrome.tabs.group({ groupId: matched.id, tabIds: tab.id });
            return matched.id;
        }
    } catch (_) {
        // クエリ失敗時は新規グループを作る
    }

    try {
        const createdGroupId = await chrome.tabs.group({ tabIds: tab.id });
        await chrome.tabGroups.update(createdGroupId, {
            title: domain,
            color: DOMAIN_GROUP_COLOR,
        });
        return createdGroupId;
    } catch (_) {
        return null;
    }
}

// 上限超過したグループから古いタブを順次削除する
async function enforceDomainLimit(groupId, windowId, limit) {
    if (!Number.isFinite(limit) || limit < 1) {
        return;
    }
    if (groupId === null || groupId === TAB_GROUP_ID_NONE) {
        return;
    }

    let groupedTabs = [];
    try {
        groupedTabs = await chrome.tabs.query({ groupId, windowId });
    } catch (_) {
        return;
    }

    const closableTabs = groupedTabs.filter((groupedTab) => !groupedTab.pinned);
    if (closableTabs.length <= limit) {
        return;
    }

    const sorted = closableTabs
        .map((groupedTab) => ({
            tab: groupedTab,
            lastActive: tabActivity[groupedTab.id] ?? 0,
        }))
        .sort((a, b) => a.lastActive - b.lastActive);

    const excessCount = sorted.length - limit;
    const targets = sorted.slice(0, excessCount);

    for (const entry of targets) {
        try {
            await logRemovedTab(entry.tab);
            await chrome.tabs.remove(entry.tab.id);
            delete tabActivity[entry.tab.id];
        } catch (_) {
            // 削除失敗は他タブの処理を止めない
        }
    }
}

// 単一タブへドメイン整理と上限チェックを適用する
async function applyDomainRulesForTab(tab, sharedLimit) {
    if (!tab?.id || tab.pinned || !tab.url) {
        return;
    }

    const domain = extractHostname(tab.url);
    if (!domain) {
        return;
    }

    const limit = sharedLimit ?? (await loadDomainLimit());
    const groupId = await ensureDomainGroup(tab, domain);
    if (groupId === null) {
        return;
    }

    await enforceDomainLimit(groupId, tab.windowId, limit);
}

// 全タブに対してドメイン整理を一括適用する
async function applyDomainRulesToAllTabs() {
    const tabs = await chrome.tabs.query({});
    const limit = await loadDomainLimit();
    for (const tab of tabs) {
        await applyDomainRulesForTab(tab, limit);
    }
}

// 削除したタブの情報を最近の履歴として保持する
async function logRemovedTab(tab) {
    try {
        const entry = {
            url: tab.url,
            title: tab.title || tab.url,
            favIconUrl: tab.favIconUrl || "",
            removedAt: Date.now(),
        };
        const { recentlyRemoved = [] } = await chrome.storage.local.get("recentlyRemoved");
        recentlyRemoved.unshift(entry);
        const trimmed = recentlyRemoved.slice(0, 15);
        await chrome.storage.local.set({ recentlyRemoved: trimmed });
    } catch (_) {
        // 履歴保存失敗はユーザー操作に影響を与えない
    }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
    tabActivity[tabId] = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab?.active) {
        tabActivity[tabId] = Date.now();
    }
    if (changeInfo?.url || changeInfo?.status === "complete") {
        applyDomainRulesForTab(tab).catch(() => {});
    }
});

chrome.tabs.onCreated.addListener((tab) => {
    if (!tab?.id) {
        return;
    }
    tabActivity[tab.id] = Date.now();
    applyDomainRulesForTab(tab).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabActivity[tabId];
});

chrome.runtime.onInstalled.addListener(async () => {
    await seedAllTabs();
    await chrome.storage.sync.remove("domainLimits");
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    await applyDomainRulesToAllTabs();
    console.log(new Date(), "Alarm Installed: sweep");
});

chrome.runtime.onStartup.addListener(async () => {
    await seedAllTabs();
    await chrome.storage.sync.remove("domainLimits");
    chrome.alarms.create("sweep", { periodInMinutes: 1 });
    await applyDomainRulesToAllTabs();
    console.log(new Date(), "Alarm Startup: sweep");
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "sweep") {
        return;
    }

    await applyDomainRulesToAllTabs();

    const { timeoutMinutes = 30, whitelist = [] } = await chrome.storage.sync.get([
        "timeoutMinutes",
        "whitelist",
    ]);
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
    const now = Date.now();

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab || !tab.id || !tab.url) {
            continue;
        }

        if (isWhitelisted(tab.url, whitelist)) {
            continue;
        }

        const last = tabActivity[tab.id];
        console.log(
            "[tab information]",
            "\n日時:",
            new Date(),
            "\n設定分:",
            timeoutMinutes,
            "\n経過分:",
            Math.round((now - last) / 60000),
            "\nURL:",
            tab.url
        );

        if (last === undefined) {
            try {
                await logRemovedTab(tab);
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];
            } catch (_) {
                // 削除失敗は他タブ処理へ影響させない
            }
            continue;
        }

        if (tab.active || tab.audible || tab.pinned) {
            tabActivity[tab.id] = Date.now();
            continue;
        }

        if (now - last > timeoutMs) {
            try {
                await logRemovedTab(tab);
                await chrome.tabs.remove(tab.id);
                delete tabActivity[tab.id];
            } catch (_) {
                // 削除失敗は他タブ処理へ影響させない
            }
        }
    }
});