// ポップアップ初期化
document.addEventListener("DOMContentLoaded", () => {
    const timeoutInput = document.getElementById("timeout");
    const defaultDomainLimitInput = document.getElementById("defaultDomainLimit");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    const recentlyRemovedUl = document.getElementById("recentlyRemoved");
    const clearRemovedBtn = document.getElementById("clearRemoved");

    chrome.storage.sync.get(
        ["timeoutMinutes", "whitelist", "defaultDomainLimit"],
        (data) => {
            timeoutInput.value = data.timeoutMinutes || 30;
            const defaultLimitValue = Number.parseInt(data.defaultDomainLimit, 10);
            defaultDomainLimitInput.value = Number.isFinite(defaultLimitValue) && defaultLimitValue >= 0
                ? defaultLimitValue
                : 0;
            (data.whitelist || []).forEach((url) => addWhitelistItem(url));
        }
    );

    saveButton.addEventListener("click", () => {
        const timeoutMinutes = Math.max(1, Number.parseInt(timeoutInput.value, 10) || 30);
        let defaultLimit = Number.parseInt(defaultDomainLimitInput.value, 10);
        if (!Number.isFinite(defaultLimit) || defaultLimit < 0) {
            defaultLimit = 0;
        }
        chrome.storage.sync.set(
            {
                timeoutMinutes,
                defaultDomainLimit: defaultLimit,
            },
            () => {
                alert("保存しました");
            }
        );
    });

    addWhitelistButton.addEventListener("click", () => {
        const url = whitelistInput.value.trim();
        if (!url) {
            return;
        }
        chrome.storage.sync.get("whitelist", (data) => {
            const list = Array.isArray(data.whitelist) ? data.whitelist : [];
            list.push(url);
            chrome.storage.sync.set({ whitelist: list }, () => {
                addWhitelistItem(url);
                whitelistInput.value = "";
            });
        });
    });

    renderRecentlyRemoved();

    clearRemovedBtn.addEventListener("click", async () => {
        await chrome.storage.local.set({ recentlyRemoved: [] });
        renderRecentlyRemoved();
    });

    // ホワイトリストの表示項目を追加する
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

    // ホワイトリストのインデックスを振り直す
    function reindexWhitelist() {
        Array.from(whitelistUl.children).forEach((item, idx) => {
            item.dataset.index = String(idx);
        });
    }

    // ホワイトリスト削除をストレージへ反映する
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

    // 削除時刻をユーザー向けに整形する
    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString();
        } catch (_) {
            return "";
        }
    }

    // 最近削除したタブ一覧を描画する
    async function renderRecentlyRemoved() {
        recentlyRemovedUl.innerHTML = "";
        const { recentlyRemoved = [] } = await chrome.storage.local.get("recentlyRemoved");

        recentlyRemoved.forEach((item, index) => {
            const li = document.createElement("li");
            const row = document.createElement("div");
            row.className = "item-row";

            const link = document.createElement("span");
            link.className = "url";
            link.textContent = item.title || item.url;
            link.title = item.url;
            link.addEventListener("click", async (event) => {
                event.preventDefault();
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

    // 削除履歴からタブを復元する
    async function restoreItem(index) {
        const { recentlyRemoved = [] } = await chrome.storage.local.get("recentlyRemoved");
        const item = recentlyRemoved[index];
        if (!item) {
            return;
        }

        await chrome.tabs.create({ url: item.url });
        recentlyRemoved.splice(index, 1);
        await chrome.storage.local.set({ recentlyRemoved });
        renderRecentlyRemoved();
    }
});