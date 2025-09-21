document.addEventListener("DOMContentLoaded", () => {
    // 理由: 繰り返しDOM探索を避け、操作時のコストを抑えるため
    const timeoutInput = document.getElementById("timeout");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    const recentlyRemovedUl = document.getElementById("recentlyRemoved");
    const clearRemovedBtn = document.getElementById("clearRemoved");

    // 理由: 以前の選択を保持し、意図どおりの動作を継続させるため
    chrome.storage.sync.get(["timeoutMinutes", "whitelist"], (data) => {
        // 理由: 初期値がないと判断が難しく、既定値を示す必要があるため
        timeoutInput.value = data.timeoutMinutes || 30;
        // 理由: 現在の設定内容を可視化し、編集を容易にするため
        (data.whitelist || []).forEach((url) => addWhitelistItem(url));
    });

    // 理由: 明示的な保存操作により、意図しない変更の反映を防ぐため
    saveButton.addEventListener("click", () => {
        // 理由: 計算・比較を行いやすいプリミティブ型（数値）で保持するため
        const timeoutMinutes = parseInt(timeoutInput.value, 10);
        // 理由: 背景スクリプトからも参照できる共有領域に保存するため
        chrome.storage.sync.set({ timeoutMinutes });
        // 理由: ユーザーに保存が成功したことを明確に伝えるため
        alert("保存しました");
    });

    // 理由: ユーザーが除外対象を柔軟に拡張できるようにするため
    addWhitelistButton.addEventListener("click", () => {
        // 理由: 不要な空白が原因の重複・誤登録を防ぐため
        const url = whitelistInput.value.trim();
        if (!url) return; // 理由: 空値は意味がなくノイズになるため
        // 理由: 既存値を保持しつつ追記し、設定の整合性を保つため
        chrome.storage.sync.get("whitelist", (data) => {
            const list = data.whitelist || [];
            list.push(url);
            // 理由: 背景の判定処理と同期させるため
            chrome.storage.sync.set({ whitelist: list });
            // 理由: モデルの更新をUIに即時反映し、フィードバックを提供するため
            addWhitelistItem(url);
            whitelistInput.value = "";
        });
    });

    // 理由: 自動削除の結果を可視化し、誤操作からの復旧経路を用意するため
    renderRecentlyRemoved();

    // 理由: プライバシー配慮とリスト肥大化の抑制のため
    clearRemovedBtn.addEventListener("click", async () => {
        await chrome.storage.local.set({ recentlyRemoved: [] });
        // 理由: データの変更をUIに反映し、状態の一貫性を保つため
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
        // 理由: 再描画時の重複表示を避け、最新状態だけを出すため
        recentlyRemovedUl.innerHTML = "";
        const { recentlyRemoved = [] } = await chrome.storage.local.get(
            "recentlyRemoved"
        );

        // 理由: 項目ごとに独立した操作領域を作ることで可用性を高めるため
        recentlyRemoved.forEach((item, index) => {
            const li = document.createElement("li");
            const row = document.createElement("div");
            row.className = "item-row";

            // 理由: タイトル/URLをクリック可能にして復元操作を直感化するため
            const link = document.createElement("span");
            link.className = "url";
            link.textContent = item.title || item.url;
            link.title = item.url;
            link.addEventListener("click", async (e) => {
                e.preventDefault();
                await restoreItem(index);
            });

            // 理由: 削除時刻を示すことで判断材料（重要度/新しさ）を提供するため
            const time = document.createElement("span");
            time.className = "time";
            time.textContent = formatTime(item.removedAt);

            // 理由: 表示要素とデータの結び付きを保持しつつ組み立てるため
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
        // 理由: 不正インデックスや競合状態での例外を避けるため
        const item = recentlyRemoved[index];
        if (!item) return;
        // 理由: 既存タブを壊さず非破壊的に復元するため
        await chrome.tabs.create({ url: item.url });
        // 理由: 多重復元を防ぎ、履歴の整合性を保つため
        recentlyRemoved.splice(index, 1);
        await chrome.storage.local.set({ recentlyRemoved });
        // 理由: モデルとUIの不一致を残さないため
        renderRecentlyRemoved();
    }
});

