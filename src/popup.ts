const MINUTES_PER_HOUR = 60; // 理由: 分↔時間変換の定数を共通化し、保守性を高めるため
const DEFAULT_TIMEOUT_MINUTES = 30; // 理由: 既定の通常タイマー値を明示するため
const DEFAULT_FULL_CLEANUP_HOURS = 24; // 理由: 全削除タイマーの既定値 (24h=1440min) を明確化するため

document.addEventListener("DOMContentLoaded", () => {
    // 理由: 繰り返しDOM探索を避け、更新処理を軽量化するため
    const timeoutInput = document.querySelector<HTMLInputElement>("#timeout");
    const fullCleanupInput = document.querySelector<HTMLInputElement>("#fullCleanup");
    const fullCleanupToggle = document.querySelector<HTMLInputElement>("#fullCleanupToggle");
    const saveButton = document.querySelector<HTMLButtonElement>("#save");
    const whitelistInput = document.querySelector<HTMLInputElement>("#whitelistInput");
    // const addWhitelistButton = document.querySelector<HTMLButtonElement>("#addWhitelist");
    const whitelistUl = document.querySelector<HTMLUListElement>("#whitelist");
    const recentlyRemovedUl = document.querySelector<HTMLUListElement>("#recentlyRemoved");
    const clearRemovedBtn = document.querySelector<HTMLButtonElement>("#clearRemoved");
    const switchToWhitelistBtn = document.querySelector<HTMLButtonElement>("#whitelistSwitch");
    const switchToRecentlyRemovedBtn = document.querySelector<HTMLButtonElement>("#historySwitch");
    let cachedFullCleanupMinutes = DEFAULT_FULL_CLEANUP_HOURS * MINUTES_PER_HOUR; // 理由: トグルOFF時に直近値を保持するため

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
            if(!timeoutInput || !fullCleanupInput || !fullCleanupToggle) {
                alert("内部エラー: 入力要素が見つかりません");
                return;
            }
            timeoutInput.value = normalizedTimeout.toString();
            fullCleanupInput.value = formatHours(normalizedFullCleanupHours);
            fullCleanupToggle.checked = enabled;
            cachedFullCleanupMinutes = normalizedFullCleanupMinutes;
            applyFullCleanupState(enabled);
            (data.whitelist || []).forEach((url:string) => addWhitelistItem(url));
        }
    );

    fullCleanupToggle?.addEventListener("change", () => {
        const enabled = fullCleanupToggle.checked;
        applyFullCleanupState(enabled);
    });

    saveButton?.addEventListener("click", () => {
        if (!timeoutInput || !fullCleanupInput || !fullCleanupToggle){
            alert("内部エラー: 入力要素が見つかりません");
            return;
        }
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

        if (!whitelistInput) {
            alert("内部エラー: 入力要素が見つかりません");
            return;
        }
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
        whitelistInput.value = "";
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

    renderRecentlyRemoved(); // 理由: 直近の自動削除を可視化し誤操作からのリカバリを可能にするため

    clearRemovedBtn?.addEventListener("click", async () => {
        await chrome.storage.local.set({ recentlyRemoved: [] });
        renderRecentlyRemoved();
    });

    function addWhitelistItem(url:string) {
        console.log("addWhitelistItem", url);
        const li = document.createElement("li");
        if (!whitelistUl) return;
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

    function reindexWhitelist() {
        if (!whitelistUl) return;
        Array.from(whitelistUl.children).forEach((item, idx) => {
            (item as HTMLElement).dataset.index = String(idx);
        });
    }

    function removeWhitelistItem(targetLi: HTMLElement) {
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

    function formatTime(ts:number) {
        try {
            return new Date(ts).toLocaleString();
        } catch (_) {
            return "";
        }
    }

    async function renderRecentlyRemoved() {
        if (!recentlyRemovedUl) {
            alert("内部エラー: recentlyRemovedUlが見つかりません");
            return;
        }
        recentlyRemovedUl.innerHTML = ""; // 理由: 再描画時の重複表示やゴースト要素を防ぐため
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );

        recentlyRemoved.forEach((item: { title?: string; url: string; removedAt: number }, index: number) => {
            
            const li = document.createElement("li");

            // タイトル表示
            const titleDiv = document.createElement("div");
            titleDiv.className = "list-title";
            titleDiv.textContent = shortenText(item.title || "(タイトルなし)", 40);
            li.appendChild(titleDiv);

            // URLと操作行
            const row = document.createElement("div");
            row.className = "item-row";

            const link = document.createElement("span");
            link.className = "url";
            link.textContent = shortenText(item.url);
            link.title = "click me to restore\n" + item.url;
            li.addEventListener("click", async (e) => {
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

    switchToWhitelistBtn?.addEventListener("click", function () {
        // const managementSection = document.querySelector<HTMLElement>("#management");
        // console.log(managementSection?.offsetHeight);
        if (this.classList.contains("active")) return;
        switchButton();
        
    });

    switchToRecentlyRemovedBtn?.addEventListener("click", function() {
        if (this.classList.contains("active")) return;
        switchButton();
    });

    // テキストを短縮して表示する（最大40文字、超えたら...）
    function shortenText(text: string, maxLength: number = 40): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3) + "...";
    }

    function switchButton(){
        console.log("switchButton called");
        const activeButton = document.querySelector(".switch.active");
        const toswitchButton = document.querySelector(".switch:not(.active)");
        if (activeButton) {
            activeButton.classList.remove("active");
        }
        if (toswitchButton) {
            toswitchButton.classList.add("active");
        }
        const hiddenUl = document.querySelector("ul.hidden");
        const shownUl = document.querySelector("ul:not(.hidden)");
        if (hiddenUl) {
            hiddenUl.classList.remove("hidden");
        }
        if (shownUl) {
            shownUl.classList.add("hidden");
        }
    }
    async function restoreItem(index: number) {
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

    function applyFullCleanupState(enabled: boolean) {
        if (!fullCleanupInput) return;
        fullCleanupInput.disabled = !enabled;
        fullCleanupInput.title = enabled
            ? ""
            : "全削除タイマーを有効にすると編集できます";
    }
});

function normalizeTimeout(value:string, fallback:number): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 1) {
        return fallback;
    }
    return Math.floor(numberValue);
}

function normalizeFullCleanupHours(valueInMinutes: number, timeoutMinutes: number, fallbackHours: number): number {
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

function normalizeFullCleanupToggle(value: boolean): boolean {
    return value !== false; // 理由: 既存ユーザーへはデフォルトONを維持するため
}

function formatHours(hours: number): string {
    if (Number.isInteger(hours)) {
        return String(hours);
    }
    return (Math.round(hours * 100) / 100).toString();
}
