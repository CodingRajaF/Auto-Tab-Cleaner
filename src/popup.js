const MINUTES_PER_HOUR = 60; // 理由: 分↔時間変換の定数を共通化し、保守性を高めるため
const DEFAULT_TIMEOUT_MINUTES = 30; // 理由: 既定の通常タイマー値を明示するため
const DEFAULT_FULL_CLEANUP_HOURS = 24; // 理由: 全削除タイマーの既定値 (24h=1440min) を明確化するため

document.addEventListener("DOMContentLoaded", () => {
    // 理由: 繰り返しDOM探索を避け、更新処理を軽量化するため
    const timeoutInput = document.getElementById("timeout");
    const fullCleanupInput = document.getElementById("fullCleanup");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    const recentlyRemovedUl = document.getElementById("recentlyRemoved");
    const clearRemovedBtn = document.getElementById("clearRemoved");

    // 理由: ユーザーが以前保存した設定を継続利用できるようにするため
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

            (data.whitelist || []).forEach((url) => addWhitelistItem(url));
        }
    );

    // 理由: 明示的な保存操作で意図しない変更を防ぐため
    saveButton.addEventListener("click", () => {
        const timeoutValue = Number(timeoutInput.value);
        const fullCleanupHourValue = Number(fullCleanupInput.value);

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

        if (timeoutMinutes < 1 || fullCleanupMinutes < 1) {
            alert("通常・全削除タイムアウトは1以上で設定してください");
            return;
        }

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

    // 理由: ユーザーが除外したいサイトを動的に登録できるようにするため
    addWhitelistButton.addEventListener("click", () => {
        const url = whitelistInput.value.trim();
        if (!url) return; // 理由: 空値は意味がなくノイズになるため

        chrome.storage.sync.get("whitelist", (data) => {
            const list = Array.isArray(data.whitelist) ? data.whitelist : [];
            list.push(url);
            chrome.storage.sync.set({ whitelist: list }, () => {
                addWhitelistItem(url);
                whitelistInput.value = "";
            });
        });
    });

    // 理由: 直近の自動削除を可視化し誤操作からのリカバリを可能にするため
    renderRecentlyRemoved();

    // 理由: プライバシー配慮やリスト肥大化を防ぐため
    clearRemovedBtn.addEventListener("click", async () => {
        await chrome.storage.local.set({ recentlyRemoved: [] });
        renderRecentlyRemoved();
    });

    // 理由: ホワイトリスト項目のDOM生成を一箇所に集約し操作性を保つため
    function addWhitelistItem(url) {
        const li = document.createElement("li");
        li.dataset.index = String(whitelistUl.children.length);

        const row = document.createElement("div");
        row.className = "item-row";

        const urlSpan = document.createElement("span");
        urlSpan.className = "url";
        urlSpan.textContent = url;
        urlSpan.title = url;

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-whitelist";
        deleteBtn.textContent = "×";
        deleteBtn.addEventListener("click", () => removeWhitelistItem(li));

        row.appendChild(urlSpan);
        row.appendChild(deleteBtn);
        li.appendChild(row);
        whitelistUl.appendChild(li);
    }

    // 理由: リスト内で一意のインデックスを保ち操作不整合を防ぐため
    function reindexWhitelist() {
        Array.from(whitelistUl.children).forEach((item, idx) => {
            item.dataset.index = String(idx);
        });
    }

    // 理由: 削除処理とストレージ中の整合性を同時に保つため
    function removeWhitelistItem(targetLi) {
        const index = Number.parseInt(targetLi.dataset.index || "-1", 10);
        if (Number.isNaN(index) || index < 0) {
            return;
        }

        chrome.storage.sync.get("whitelist", (data) => {
            const list = Array.isArray(data.whitelist) ? data.whitelist : [];
            if (index >= list.length) {
                return;
            }

            list.splice(index, 1);
            chrome.storage.sync.set({ whitelist: list }, () => {
                targetLi.remove();
                reindexWhitelist();
            });
        });
    }

    // 理由: ユーザーのロケールに合わせて直感的に時刻を読める表示にするため
    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString();
        } catch (_) {
            return "";
        }
    }

    // 理由: データソース（ストレージ）とUIの状態を一致させるため
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

    // 理由: 復元操作を副作用と一緒にカプセル化し再利用性を高めるため
    async function restoreItem(index) {
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );
        const item = recentlyRemoved[index];
        if (!item) return; // 理由: 不正なインデックスにより例外や意図しない動作を避けるため

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
