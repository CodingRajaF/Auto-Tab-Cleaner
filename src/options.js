const MINUTES_PER_HOUR = 60; // 理由: 分↔時間の変換を一元管理し保守性を上げるため
const DEFAULT_TIMEOUT_MINUTES = 30; // 理由: 既存仕様で定義済みの既定値を明示するため
const DEFAULT_FULL_CLEANUP_HOURS = 24; // 理由: 全削除タイマーの既定値 (24h=1440min) を分かりやすく保持するため

document.addEventListener("DOMContentLoaded", () => {
    // 理由: 繰り返しDOM探索を避け、操作時のコストを抑えるため
    const timeoutInput = document.getElementById("timeout");
    const fullCleanupInput = document.getElementById("fullCleanup");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    const recentlyRemovedUl = document.getElementById("recentlyRemoved");
    const clearRemovedBtn = document.getElementById("clearRemoved");

    // 理由: 以前の選択を保持し、意図どおりの動作を継続させるため
    chrome.storage.sync.get(
        ["timeoutMinutes", "fullCleanupMinutes", "whitelist"],
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
            timeoutInput.value = normalizedTimeout;
            fullCleanupInput.value = formatHours(normalizedFullCleanupHours);

            // 理由: 現在の設定内容を可視化し、編集を容易にするため
            (data.whitelist || []).forEach((url) => addWhitelistItem(url));
        }
    );

    // 理由: 明示的な保存操作により、意図しない変更の反映を防ぐため
    saveButton.addEventListener("click", () => {
        const timeoutValue = Number(timeoutInput.value);
        const fullCleanupHourValue = Number(fullCleanupInput.value);

        // 理由: 数値以外の入力は設定破綻につながるため
        if (
            !Number.isFinite(timeoutValue) ||
            !Number.isFinite(fullCleanupHourValue)
        ) {
            alert("数値を入力してください");
            return;
        }

        const timeoutMinutes = Math.floor(timeoutValue);
        const fullCleanupMinutes = Math.floor(
            fullCleanupHourValue * MINUTES_PER_HOUR
        );

        // 理由: 無効値を保存すると削除ロジックが破綻するため
        if (timeoutMinutes < 1 || fullCleanupMinutes < 1) {
            alert("通常・全削除タイムアウトは1以上で設定してください");
            return;
        }

        // 理由: 全削除タイムアウトは最終ラインとして通常タイムアウトより長くあるべきため
        if (timeoutMinutes >= fullCleanupMinutes) {
            alert("全削除タイムアウトは通常タイムアウトより大きい必要があります");
            return;
        }

        chrome.storage.sync.set(
            { timeoutMinutes, fullCleanupMinutes },
            () => {
                if (chrome.runtime.lastError) {
                    alert(`保存に失敗しました: ${chrome.runtime.lastError.message}`);
                    return;
                }
                alert("保存しました");
            }
        );
    });

    // 理由: ユーザーが除外対象を柔軟に拡張できるようにするため
    addWhitelistButton.addEventListener("click", () => {
        const url = whitelistInput.value.trim(); // 理由: 不要な空白による誤登録を防ぐため
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

    // 理由: 自動削除の結果を可視化し、誤操作からの復旧経路を用意するため
    renderRecentlyRemoved();

    // 理由: プライバシー配慮とリスト肥大化の抑制のため
    clearRemovedBtn.addEventListener("click", async () => {
        await chrome.storage.local.set({ recentlyRemoved: [] });
        renderRecentlyRemoved();
    });

    // 理由: 関心の分離により読みやすさ・再利用性を確保するため
    function addWhitelistItem(url) {
        const li = document.createElement("li");
        li.textContent = url;
        whitelistUl.appendChild(li);
    }

    // 理由: ユーザーのロケールに沿う表現で理解しやすくするため
    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString(); // 理由: ブラウザ/OSの設定に自動追従させるため
        } catch (_) {
            return "";
        }
    }

    // 理由: ストレージの真実の状態と画面表示を一致させるため
    async function renderRecentlyRemoved() {
        recentlyRemovedUl.innerHTML = ""; // 理由: 再描画時の重複を防ぐため
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

    // 理由: 復元の一連の副作用を集約し、安全に再利用できるようにするため
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
});

// 理由: タイムアウト入力を分単位に正規化し、最小値を強制するため
function normalizeTimeout(value, fallback) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 1) {
        return fallback;
    }
    return Math.floor(numberValue);
}

// 理由: 分で保存されている全削除タイマーを時間入力向けに正規化するため
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

// 理由: 入力欄へ表示する際に余計な 0 を避けつつ判読性を確保するため
function formatHours(hours) {
    if (Number.isInteger(hours)) {
        return String(hours);
    }
    return (Math.round(hours * 100) / 100).toString();
}
