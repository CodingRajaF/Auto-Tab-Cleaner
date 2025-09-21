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
        // 理由: 初期入力値が空だと判断に迷うため（既定値を提示）
        timeoutInput.value = data.timeoutMinutes || 30;
        // 理由: 設定の可視性を確保し、編集可能にするため
        (data.whitelist || []).forEach((url) => addWhitelistItem(url));
    });

    // 理由: 明示的な保存操作で意図しない変更を防ぐため
    saveButton.addEventListener("click", () => {
        // 理由: ストレージには数値として保持し比較/計算を簡潔にするため
        const timeoutMinutes = parseInt(timeoutInput.value, 10);
        // 理由: 背景スクリプトと共有できる永続領域に保存するため
        chrome.storage.sync.set({ timeoutMinutes }, () => {
            // 理由: 操作結果のフィードバックがないと保存可否が判断できないため
            alert("保存しました");
        });
    });

    // 理由: ユーザーが除外したいサイトを動的に登録できるようにするため
    addWhitelistButton.addEventListener("click", () => {
        // 理由: 不要な空白により重複や誤登録が発生するのを避けるため
        const url = whitelistInput.value.trim();
        if (!url) return; // 理由: 空値の登録は意味がなくノイズになるため

        // 理由: 既存値を破壊せずに追記し、設定の整合性を保つため
        chrome.storage.sync.get("whitelist", (data) => {
            const list = Array.isArray(data.whitelist) ? data.whitelist : [];
            list.push(url);
            // 理由: 背景処理の判定ロジックと同期させるため
            chrome.storage.sync.set({ whitelist: list }, () => {
                // 理由: モデル更新に合わせてUIも即時反映し可視性を保つため
                addWhitelistItem(url);
                whitelistInput.value = "";
            });
        });
    });

    // 理由: 直近の自動削除を可視化し誤操作からのリカバリを可能にするため
    renderRecentlyRemoved();

    // 理由: プライバシー配慮やリスト肥大化を防ぐため
    clearRemovedBtn.addEventListener("click", async () => {
        // 理由: 履歴を空にして一覧表示をリセットするため
        await chrome.storage.local.set({ recentlyRemoved: [] });
        // 理由: モデル変更をUIに反映しユーザーに結果を示すため
        renderRecentlyRemoved();
    });

    // 理由: 関心毎を分離し、可読性と再利用性を上げるため

    // 理由: 文字列以外の要素生成を隠蔽し、呼び出し側を簡潔にするため
    function addWhitelistItem(url) {
        const li = document.createElement("li");
        li.textContent = url;
        whitelistUl.appendChild(li);
    }

    // 理由: ユーザーのロケールに合わせて直感的に理解できる表示にするため
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
