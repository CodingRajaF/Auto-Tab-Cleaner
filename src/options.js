document.addEventListener("DOMContentLoaded", () => {
    const timeoutInput = document.getElementById("timeout");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    const recentlyRemovedUl = document.getElementById("recentlyRemoved");
    const clearRemovedBtn = document.getElementById("clearRemoved");

    // 設定ロード
    chrome.storage.sync.get(["timeoutMinutes", "whitelist"], (data) => {
        timeoutInput.value = data.timeoutMinutes || 30;
        (data.whitelist || []).forEach((url) => addWhitelistItem(url));
    });

    // 保存ボタン
    saveButton.addEventListener("click", () => {
        const timeoutMinutes = parseInt(timeoutInput.value, 10);
        chrome.storage.sync.set({ timeoutMinutes });
        alert("保存しました");
    });

    // ホワイトリスト追加
    addWhitelistButton.addEventListener("click", () => {
        const url = whitelistInput.value.trim();
        if (!url) return;
        chrome.storage.sync.get("whitelist", (data) => {
            const list = data.whitelist || [];
            list.push(url);
            chrome.storage.sync.set({ whitelist: list });
            addWhitelistItem(url);
            whitelistInput.value = "";
        });
    });

    // 最近削除したタブの描画
    renderRecentlyRemoved();

    // 履歴クリア
    clearRemovedBtn.addEventListener("click", async () => {
        await chrome.storage.local.set({ recentlyRemoved: [] });
        renderRecentlyRemoved();
    });

    // ---------- functions ----------
    function addWhitelistItem(url) {
        const li = document.createElement("li");
        li.textContent = url;
        whitelistUl.appendChild(li);
    }

    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString(); // ブラウザ/OSのロケール
        } catch (_) {
            return "";
        }
    }

    async function renderRecentlyRemoved() {
        recentlyRemovedUl.innerHTML = "";
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
        if (!item) return;
        await chrome.tabs.create({ url: item.url });
        // 復元した項目を履歴から削除
        recentlyRemoved.splice(index, 1);
        await chrome.storage.local.set({ recentlyRemoved });
        renderRecentlyRemoved();
    }
});

