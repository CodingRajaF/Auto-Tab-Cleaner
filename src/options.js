const MINUTES_PER_HOUR = 60; // 理由: 分↔時間の変換を一元管理し保守性を上げるため
const DEFAULT_TIMEOUT_MINUTES = 30; // 理由: 既存仕様で定義済みの既定値を明示するため
const DEFAULT_FULL_CLEANUP_HOURS = 24; // 理由: 全削除タイマーの既定値 (24h=1440min) を分かりやすく保持するため

document.addEventListener("DOMContentLoaded", () => {
    // 理由: 繰り返しDOM探索を避け、操作時のコストを抑えるため
    const timeoutInput = document.getElementById("timeout");
    const fullCleanupInput = document.getElementById("fullCleanup");
    const fullCleanupToggle = document.getElementById("fullCleanupToggle");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    const recentlyRemovedUl = document.getElementById("recentlyRemoved");
    const clearRemovedBtn = document.getElementById("clearRemoved");

    let cachedFullCleanupMinutes = DEFAULT_FULL_CLEANUP_HOURS * MINUTES_PER_HOUR; // 理由: トグルOFF時に直近の設定値を保持するため

    chrome.storage.sync.get(
        ["timeoutMinutes", "fullCleanupMinutes", "fullCleanupEnabled", "whitelist"],
        (data) => {
            const normalizedTimeout = normalizeTimeout(
                data.timeoutMinutes,
                DEFAULT_TIMEOUT_MINUTES
            );
            const normalizedFullCleanupHours = normalizeFullCleanupHours(
                data.fullCleanupMinutes,
                normalizedTimeout,
                DEFAULT_FULL_CLEANUP_HOURS
            );
            const normalizedFullCleanupMinutes = Math.floor(
                normalizedFullCleanupHours * MINUTES_PER_HOUR
            );
            const enabled = normalizeFullCleanupToggle(data.fullCleanupEnabled);

            timeoutInput.value = normalizedTimeout;
            fullCleanupInput.value = formatHours(normalizedFullCleanupHours);
            fullCleanupToggle.checked = enabled;
            cachedFullCleanupMinutes = normalizedFullCleanupMinutes;
            applyFullCleanupState(enabled);

            (data.whitelist || []).forEach((url) => addWhitelistItem(url));
        }
    );

    fullCleanupToggle.addEventListener("change", () => {
        const enabled = fullCleanupToggle.checked;
        applyFullCleanupState(enabled);
    });

    saveButton.addEventListener("click", () => {
        const timeoutValue = Number(timeoutInput.value);
        const fullCleanupHourValue = Number(fullCleanupInput.value);
        const fullCleanupEnabled = fullCleanupToggle.checked;

        if (!Number.isFinite(timeoutValue)) {
            alert("数値を入力してください");
            return;
        }

        const timeoutMinutes = Math.floor(timeoutValue);
        if (timeoutMinutes < 1) {
            alert("通常タイムアウトは1以上で設定してください");
            return;
        }

        let nextFullCleanupMinutes = cachedFullCleanupMinutes;

        if (fullCleanupEnabled) {
            if (!Number.isFinite(fullCleanupHourValue)) {
                alert("数値を入力してください");
                return;
            }

            const computedMinutes = Math.floor(
                fullCleanupHourValue * MINUTES_PER_HOUR
            );

            if (computedMinutes < 1) {
                alert("全削除タイムアウトは1時間以上で設定してください");
                return;
            }

            if (timeoutMinutes >= computedMinutes) {
                alert("全削除タイムアウトは通常タイムアウトより大きい必要があります");
                return;
            }

            nextFullCleanupMinutes = computedMinutes;
        }

        chrome.storage.sync.set(
            {
                timeoutMinutes,
                fullCleanupMinutes: nextFullCleanupMinutes,
                fullCleanupEnabled,
            },
            () => {
                if (chrome.runtime.lastError) {
                    alert(`保存に失敗しました: ${chrome.runtime.lastError.message}`);
                    return;
                }
                cachedFullCleanupMinutes = nextFullCleanupMinutes;
                alert("保存しました");
            }
        );
    });

    addWhitelistButton.addEventListener("click", () => {
        const url = whitelistInput.value.trim(); // 理由: 不要な空白が原因の重複・誤登録を防ぐため
        if (!url) return;

        chrome.storage.sync.get("whitelist", (data) => {
            const list = data.whitelist || [];
            list.push(url);
            chrome.storage.sync.set({ whitelist: list }, () => {
                addWhitelistItem(url);
                whitelistInput.value = "";
            });
        });
    });

    renderRecentlyRemoved(); // 理由: 自動削除の結果を可視化し、誤操作からの復旧経路を用意するため

    clearRemovedBtn.addEventListener("click", async () => {
        await chrome.storage.local.set({ recentlyRemoved: [] });
        renderRecentlyRemoved();
    });

    function addWhitelistItem(url) {
        const li = document.createElement("li");
        li.textContent = url;
        whitelistUl.appendChild(li);
    }

    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString();
        } catch (_) {
            return "";
        }
    }

    async function renderRecentlyRemoved() {
        recentlyRemovedUl.innerHTML = ""; // 理由: 再描画時の重複表示やゴースト要素を防ぐため
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );

        recentlyRemoved.forEach((item, index) => {
            const li = document.createElement("li");
            const row = document.createElement("div");
            row.className = "item-row";

            const link = document.createElement("span");
            link.className = "url";
            link.textContent = item.title || item.url;
            link.title = item.url;
            link.addEventListener("click", async (e) => {
                e.preventDefault();
                await restoreItem(index);
            });

            const time = document.createElement("span");
            time.className = "time";
            time.textContent = formatTime(item.removedAt);

            row.appendChild(link);
            row.appendChild(time);
            li.appendChild(row);
            recentlyRemovedUl.appendChild(li);
        });
    }

    async function restoreItem(index) {
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );
        const item = recentlyRemoved[index];
        if (!item) return; // 理由: 不正インデックスや競合状態での例外を避けるため

        await chrome.tabs.create({ url: item.url });
        recentlyRemoved.splice(index, 1); // 理由: 多重復元を防ぎ、履歴の整合性を保つため
        await chrome.storage.local.set({ recentlyRemoved });
        renderRecentlyRemoved();
    }

    function applyFullCleanupState(enabled) {
        fullCleanupInput.disabled = !enabled;
        fullCleanupInput.title = enabled
            ? ""
            : "全削除タイマーを有効にすると編集できます";
    }
});

function normalizeTimeout(value, fallback) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 1) {
        return fallback;
    }
    return Math.floor(numberValue);
}

function normalizeFullCleanupHours(valueInMinutes, timeoutMinutes, fallbackHours) {
    const fallbackMinutes = Math.floor(fallbackHours * MINUTES_PER_HOUR);
    const numberValue = Number(valueInMinutes);
    let minutes;

    if (!Number.isFinite(numberValue) || numberValue < 1) {
        minutes = fallbackMinutes;
    } else {
        minutes = Math.floor(numberValue);
    }

    if (minutes <= timeoutMinutes) {
        minutes = timeoutMinutes + 1;
    }

    const hours = minutes / MINUTES_PER_HOUR;
    return Math.round(hours * 100) / 100;
}

function normalizeFullCleanupToggle(value) {
    return value !== false; // 理由: 既存ユーザーへはデフォルトONを維持するため
}

function formatHours(hours) {
    if (Number.isInteger(hours)) {
        return String(hours);
    }
    return (Math.round(hours * 100) / 100).toString();
}
