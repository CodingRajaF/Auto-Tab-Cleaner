// 理由: ポップアップ表示のたびに最新状態を反映するため
document.addEventListener("DOMContentLoaded", () => {
    // 理由: 繰り返しDOM探索を避け描画コストを抑えるため
    const timeoutInput = document.getElementById("timeout");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    const recentlyRemovedUl = document.getElementById("recentlyRemoved");
    const clearRemovedBtn = document.getElementById("clearRemoved");

    // 理由: ユーザーが以前保存した設定を継続利用できるようにするため
    chrome.storage.sync.get(["timeoutMinutes", "whitelist"], (data) => {
        timeoutInput.value = data.timeoutMinutes || 30;
        (data.whitelist || []).forEach((url) => addWhitelistItem(url));
    });

    // 理由: 明示的な保存操作で意図しない変更を防ぐため
    saveButton.addEventListener("click", () => {
        const timeoutMinutes = parseInt(timeoutInput.value, 10);
        chrome.storage.sync.set({ timeoutMinutes }, () => {
            alert("保存しました");
        });
    });

    // 理由: ユーザーが除外したいサイトを動的に登録できるようにするため
    addWhitelistButton.addEventListener("click", () => {
        const url = whitelistInput.value.trim();
        if (!url) return; 
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


    // ホワイトリスト項目のDOM生成を一箇所に集約し操作性を保つため
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

    // リスト内で一意のインデックスを保ち操作不整合を防ぐため
    function reindexWhitelist() {
        Array.from(whitelistUl.children).forEach((item, idx) => {
            item.dataset.index = String(idx);
        });
    }

    // 削除処理とストレージ中の整合性を同時に保つため
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

    // ユーザーのロケールに合わせて直感的に時刻を読める表示にするため
    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString();
        } catch (_) {
            return "";
        }
    }

    // 理由: データソース（ストレージ）とUIの状態を一致させるため
    async function renderRecentlyRemoved() {
        // 理由: 再描画時の重複表示やゴースト要素を防ぐため
        recentlyRemovedUl.innerHTML = "";

        // 理由: 一時的な履歴は同期不要のため local に保持している
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );

        // 理由: 各項目を独立した行にすることで操作性と可読性を高めるため
        recentlyRemoved.forEach((item, index) => {
            const li = document.createElement("li");
            const row = document.createElement("div");
            row.className = "item-row";

            // 理由: クリックしやすい領域を用意し復元操作を直感化するため
            const link = document.createElement("span");
            link.className = "url";
            link.textContent = item.title || item.url;
            link.title = item.url;
            link.addEventListener("click", async (e) => {
                e.preventDefault();
                await restoreItem(index);
            });

            // 理由: いつ削除されたかが分かると判断材料になるため
            const time = document.createElement("span");
            time.className = "time";
            time.textContent = formatTime(item.removedAt);

            // 理由: 表示要素とデータの結びつきを保ったままDOMを構築するため
            row.appendChild(link);
            row.appendChild(time);
            li.appendChild(row);
            recentlyRemovedUl.appendChild(li);
        });
    }

    // 理由: 復元操作を副作用と一緒にカプセル化し再利用性を高めるため
    async function restoreItem(index) {
        // 理由: 直前にUI操作があってもストレージの真実の状態を優先するため
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );

        // 理由: 不正なインデックスにより例外や意図しない動作を避けるため
        const item = recentlyRemoved[index];
        if (!item) return;

        // 理由: 復元は非破壊であるべきため既存タブを汚染しない
        await chrome.tabs.create({ url: item.url });

        // 理由: 同じ項目の多重復元を防止し履歴の整合性を保つため
        recentlyRemoved.splice(index, 1);
        await chrome.storage.local.set({ recentlyRemoved });

        // 理由: モデルとUIの不一致を残さないため
        renderRecentlyRemoved();
    }
});

