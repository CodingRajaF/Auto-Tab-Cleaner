"use strict";
const MINUTES_PER_HOUR = 60; // 理由: 分↔時間変換の定数を共通化し、保守性を高めるため
const DEFAULT_TIMEOUT_MINUTES = 30; // 理由: 既定の通常タイマー値を明示するため
const DEFAULT_FULL_CLEANUP_HOURS = 24; // 理由: 全削除タイマーの既定値 (24h=1440min) を明確化するため
// 共通ヘルパー関数群 🚀
/**
 * DOM要素を取得するヘルパー
 */
function getElement(selector) {
    return document.querySelector(selector);
}
/**
 * 必須DOM要素を取得し、nullの場合はエラーを表示
 */
function getRequiredElement(selector, errorMsg) {
    const element = getElement(selector);
    if (!element) {
        showError(`内部エラー: ${errorMsg} (${selector})`);
    }
    return element;
}
/**
 * Toastを表示する共通関数
 */
function showToast(message, options = { type: 'info' }) {
    // 既存のtoastがあれば削除
    const existingToast = document.querySelector('.toast.show');
    if (existingToast) {
        existingToast.remove();
    }
    // Toast要素を作成
    const toast = createElement('div', {
        className: `toast ${options.type}`,
        textContent: message
    });
    // 閉じるボタンを追加（dismissibleがtrueの場合）
    if (options.dismissible !== false) {
        const closeBtn = createElement('button', {
            className: 'toast-close',
            textContent: '×'
        });
        closeBtn.addEventListener('click', () => {
            hideToast(toast);
        });
        toast.appendChild(closeBtn);
    }
    // bodyに追加
    document.body.appendChild(toast);
    // アニメーション用のクラスを追加
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    // 自動削除（デフォルト3秒、エラーは5秒）
    const duration = options.duration ?? (options.type === 'error' ? 5000 : 3000);
    setTimeout(() => {
        hideToast(toast);
    }, duration);
}
/**
 * Toastを非表示にする
 */
function hideToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300); // CSSのtransition時間に合わせる
}
/**
 * エラーメッセージを表示
 */
function showError(message) {
    showToast(message, { type: 'error' });
}
/**
 * 成功メッセージを表示
 */
function showSuccess(message) {
    showToast(message, { type: 'success' });
}
/**
 * Chrome Storage Syncからデータを取得
 */
function getStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(keys, (data) => resolve(data));
    });
}
/**
 * Chrome Storage Syncにデータを保存
 */
function setStorageData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            }
            else {
                resolve();
            }
        });
    });
}
/**
 * Chrome Storage Localからデータを取得
 */
function getLocalStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (data) => resolve(data));
    });
}
/**
 * Chrome Storage Localにデータを保存
 */
function setLocalStorageData(data) {
    return new Promise((resolve) => {
        chrome.storage.local.set(data, () => resolve());
    });
}
/**
 * 数値バリデーション
 */
function validateNumber(value, min = 1, errorMessage) {
    const num = Number(value);
    if (Number.isNaN(num) || num < min) {
        showError(errorMessage);
        return null;
    }
    return Math.floor(num);
}
/**
 * DOM要素を作成するヘルパー
 */
function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    if (options.className)
        element.className = options.className;
    if (options.textContent)
        element.textContent = options.textContent;
    if (options.title)
        element.title = options.title;
    if (options.type && 'type' in element)
        element.type = options.type;
    if (options.dataset) {
        Object.entries(options.dataset).forEach(([key, value]) => {
            element.dataset[key] = value;
        });
    }
    return element;
}
document.addEventListener("DOMContentLoaded", () => {
    // DOM要素を取得（共通化済み） 🎯
    const timeoutInput = getRequiredElement("#timeout", "タイムアウト入力欄が見つかりません");
    const fullCleanupInput = getRequiredElement("#fullCleanup", "全削除入力欄が見つかりません");
    const fullCleanupToggle = getRequiredElement("#fullCleanupToggle", "全削除トグルが見つかりません");
    const saveButton = getRequiredElement("#save", "保存ボタンが見つかりません");
    const whitelistInput = getRequiredElement("#whitelistInput", "ホワイトリスト入力欄が見つかりません");
    const whitelistUl = getRequiredElement("#whitelist", "ホワイトリストが見つかりません");
    const recentlyRemovedUl = getRequiredElement("#recentlyRemoved", "削除履歴リストが見つかりません");
    const switchToWhitelistBtn = getRequiredElement("#whitelistSwitch", "ホワイトリスト切り替えボタンが見つかりません");
    const switchToRecentlyRemovedBtn = getRequiredElement("#historySwitch", "履歴切り替えボタンが見つかりません");
    // 必須要素チェック
    if (!timeoutInput || !fullCleanupInput || !fullCleanupToggle || !saveButton ||
        !whitelistInput || !whitelistUl || !recentlyRemovedUl) {
        return; // エラーは各getRequiredElementで表示済み
    }
    // タブ削除通知をチェックして表示
    checkAndShowTabRemovedNotifications();
    let cachedFullCleanupMinutes = DEFAULT_FULL_CLEANUP_HOURS * MINUTES_PER_HOUR; // 理由: トグルOFF時に直近値を保持するため
    // 設定読み込み関数 📥
    async function loadSettings() {
        try {
            const data = await getStorageData(["timeoutMinutes", "fullCleanupMinutes", "fullCleanupEnabled", "whitelist"]);
            const normalizedTimeout = normalizeTimeout(data.timeoutMinutes, DEFAULT_TIMEOUT_MINUTES);
            const normalizedFullCleanupHours = normalizeFullCleanupHours(data.fullCleanupMinutes, normalizedTimeout, DEFAULT_FULL_CLEANUP_HOURS);
            const normalizedFullCleanupMinutes = Math.floor(normalizedFullCleanupHours * MINUTES_PER_HOUR);
            const enabled = normalizeFullCleanupToggle(data.fullCleanupEnabled);
            // 要素が存在する場合のみ設定
            if (timeoutInput)
                timeoutInput.value = normalizedTimeout.toString();
            if (fullCleanupInput)
                fullCleanupInput.value = formatHours(normalizedFullCleanupHours);
            if (fullCleanupToggle)
                fullCleanupToggle.checked = enabled;
            cachedFullCleanupMinutes = normalizedFullCleanupMinutes;
            applyFullCleanupState(enabled);
            (data.whitelist || []).forEach((url) => addWhitelistItem(url));
        }
        catch (error) {
            showError("設定の読み込みに失敗しました");
        }
    }
    // 設定の読み込み実行
    loadSettings();
    fullCleanupToggle?.addEventListener("change", () => {
        const enabled = fullCleanupToggle.checked;
        applyFullCleanupState(enabled);
    });
    // 設定保存関数 💾
    async function saveSettings() {
        try {
            // 入力値を取得
            const url = whitelistInput?.value.trim() || "";
            const timeoutValue = timeoutInput ? Number(timeoutInput.value) : NaN;
            const fullCleanupHourValue = fullCleanupInput ? Number(fullCleanupInput.value) : NaN;
            const fullCleanupEnabled = fullCleanupToggle ? fullCleanupToggle.checked : false;
            // 通常タイムアウト保存
            let timeoutMinutes = undefined;
            if (timeoutInput && !Number.isNaN(timeoutValue)) {
                const validatedTimeout = validateNumber(timeoutValue, 1, "通常タイムアウトは1以上で設定してください");
                if (validatedTimeout === null)
                    return;
                timeoutMinutes = validatedTimeout;
            }
            // 全削除タイマー保存
            let nextFullCleanupMinutes = cachedFullCleanupMinutes;
            if (fullCleanupEnabled) {
                const validatedFullCleanup = validateNumber(fullCleanupHourValue, 0.1, "数値を入力してください");
                if (validatedFullCleanup === null)
                    return;
                const computedMinutes = Math.floor(fullCleanupHourValue * MINUTES_PER_HOUR);
                if (computedMinutes < 60) {
                    showError("全削除タイムアウトは1時間以上で設定してください");
                    return;
                }
                if (timeoutMinutes !== undefined && timeoutMinutes >= computedMinutes) {
                    showError("全削除タイムアウトは通常タイムアウトより大きい必要があります");
                    return;
                }
                nextFullCleanupMinutes = computedMinutes;
            }
            // ホワイトリスト追加（空白はスキップ）
            if (url && whitelistInput) {
                await addToWhitelist(url);
                whitelistInput.value = "";
            }
            // 設定保存
            const saveObj = {};
            if (timeoutMinutes !== undefined)
                saveObj.timeoutMinutes = timeoutMinutes;
            if (fullCleanupEnabled) {
                saveObj.fullCleanupMinutes = nextFullCleanupMinutes;
                saveObj.fullCleanupEnabled = true;
            }
            else {
                saveObj.fullCleanupEnabled = false;
            }
            await setStorageData(saveObj);
            cachedFullCleanupMinutes = nextFullCleanupMinutes;
            showSuccess("保存しました");
        }
        catch (error) {
            showError(`保存に失敗しました: ${error}`);
        }
    }
    // ホワイトリスト追加関数 📝
    async function addToWhitelist(url) {
        try {
            const data = await getStorageData(["whitelist"]);
            const list = Array.isArray(data.whitelist) ? data.whitelist : [];
            list.push(url);
            await setStorageData({ whitelist: list });
            addWhitelistItem(url);
        }
        catch (error) {
            showError("ホワイトリストの追加に失敗しました");
        }
    }
    saveButton?.addEventListener("click", saveSettings);
    renderRecentlyRemoved(); // 理由: 直近の自動削除を可視化し誤操作からのリカバリを可能にするため
    function addWhitelistItem(url) {
        console.log("addWhitelistItem", url);
        if (!whitelistUl)
            return;
        // 共通化されたDOM作成を使用 🎯
        const li = createElement("li", {
            dataset: { index: String(whitelistUl.children.length) }
        });
        const row = createElement("div", { className: "item-row" });
        const urlSpan = createElement("span", {
            className: "url",
            textContent: url,
            title: url
        });
        const deleteBtn = createElement("button", {
            type: "button",
            className: "delete-whitelist",
            textContent: "Delete"
        });
        deleteBtn.addEventListener("click", () => removeWhitelistItem(li));
        row.appendChild(urlSpan);
        row.appendChild(deleteBtn);
        li.appendChild(row);
        whitelistUl.appendChild(li);
    }
    function reindexWhitelist() {
        if (!whitelistUl)
            return;
        Array.from(whitelistUl.children).forEach((item, idx) => {
            item.dataset.index = String(idx);
        });
    }
    async function removeWhitelistItem(targetLi) {
        try {
            const index = Number.parseInt(targetLi.dataset.index || "-1", 10);
            if (Number.isNaN(index) || index < 0) {
                return;
            }
            const data = await getStorageData(["whitelist"]);
            const list = Array.isArray(data.whitelist) ? data.whitelist : [];
            if (index >= list.length) {
                return;
            }
            list.splice(index, 1);
            await setStorageData({ whitelist: list });
            targetLi.remove();
            reindexWhitelist();
        }
        catch (error) {
            showError("ホワイトリストの削除に失敗しました");
        }
    }
    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString();
        }
        catch (_) {
            return "";
        }
    }
    async function renderRecentlyRemoved() {
        try {
            if (!recentlyRemovedUl) {
                showError("内部エラー: recentlyRemovedUlが見つかりません");
                return;
            }
            recentlyRemovedUl.innerHTML = ""; // 理由: 再描画時の重複表示やゴースト要素を防ぐため
            const { recentlyRemoved = [] } = await getLocalStorageData(["recentlyRemoved"]);
            recentlyRemoved.forEach((item, index) => {
                const li = createElement("li");
                // タイトル表示
                const titleDiv = createElement("div", {
                    className: "list-title",
                    textContent: shortenText(item.title || "(タイトルなし)", 33)
                });
                li.appendChild(titleDiv);
                // URLと操作行
                const row = createElement("div", { className: "item-row" });
                const link = createElement("span", {
                    className: "url",
                    textContent: shortenText(item.url),
                    title: "click me to restore\n" + item.url
                });
                const time = createElement("span", {
                    className: "time",
                    textContent: formatTime(item.removedAt)
                });
                li.addEventListener("click", async (e) => {
                    e.preventDefault();
                    await restoreItem(index);
                });
                row.appendChild(link);
                row.appendChild(time);
                li.appendChild(row);
                recentlyRemovedUl.appendChild(li);
            });
        }
        catch (error) {
            showError("削除履歴の表示に失敗しました");
        }
    }
    switchToWhitelistBtn?.addEventListener("click", function () {
        // const managementSection = document.querySelector<HTMLElement>("#management");
        // console.log(managementSection?.offsetHeight);
        if (this.classList.contains("active"))
            return;
        switchButton();
    });
    switchToRecentlyRemovedBtn?.addEventListener("click", function () {
        if (this.classList.contains("active"))
            return;
        switchButton();
    });
    // テキストを短縮して表示する（最大40文字、超えたら...）
    function shortenText(text, maxLength = 40) {
        if (text.length <= maxLength)
            return text;
        return text.slice(0, maxLength - 3) + "...";
    }
    function switchButton() {
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
    async function restoreItem(index) {
        try {
            const { recentlyRemoved = [] } = await getLocalStorageData(["recentlyRemoved"]);
            const item = recentlyRemoved[index];
            if (!item)
                return; // 理由: 不正なインデックスにより例外や意図しない動作を避けるため
            await chrome.tabs.create({ url: item.url });
            recentlyRemoved.splice(index, 1); // 理由: 多重復元を防ぎ、履歴の整合性を保つため
            await setLocalStorageData({ recentlyRemoved });
            renderRecentlyRemoved();
        }
        catch (error) {
            showError("アイテムの復元に失敗しました");
        }
    }
    function applyFullCleanupState(enabled) {
        if (!fullCleanupInput)
            return;
        fullCleanupInput.disabled = !enabled;
        fullCleanupInput.title = enabled
            ? ""
            : "全削除タイマーを有効にすると編集できます";
    }
    // タブ削除通知をチェックして表示する関数
    async function checkAndShowTabRemovedNotifications() {
        try {
            const data = await getLocalStorageData(["tabRemovedNotifications", "lastNotificationCheck"]);
            const notifications = data.tabRemovedNotifications || [];
            const lastCheck = data.lastNotificationCheck || 0;
            const currentTime = Date.now();
            // 前回チェック以降の新しい通知のみ表示
            const newNotifications = notifications.filter((notification) => notification.removedAt > lastCheck);
            for (const notification of newNotifications) {
                const message = `📭 ${notification.title} が ${notification.reason} により閉じられました`;
                showToast(message, { type: 'info', duration: 4000 });
            }
            // 最後のチェック時刻を更新
            await setLocalStorageData({ lastNotificationCheck: currentTime });
        }
        catch (error) {
            console.warn("Failed to check tab removed notifications", error);
        }
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
    }
    else {
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
//# sourceMappingURL=popup.js.map