document.addEventListener("DOMContentLoaded", () => {
  const timeoutInput = document.getElementById("timeout");
  const saveButton = document.getElementById("save");
  const whitelistInput = document.getElementById("whitelistInput");
  const addWhitelistButton = document.getElementById("addWhitelist");
  const whitelistUl = document.getElementById("whitelist");

  // 設定ロード
  chrome.storage.sync.get(["timeoutMinutes", "whitelist"], (data) => {
    timeoutInput.value = data.timeoutMinutes || 30;
    (data.whitelist || []).forEach(url => addToList(url));
  });

  // 保存ボタン
  saveButton.addEventListener("click", () => {
    const timeoutMinutes = parseInt(timeoutInput.value, 10);
    chrome.storage.sync.set({ timeoutMinutes });
    alert("保存しました！");
  });

  // ホワイトリスト追加
  addWhitelistButton.addEventListener("click", () => {
    const url = whitelistInput.value.trim();
    if (!url) return;
    chrome.storage.sync.get("whitelist", (data) => {
      const list = data.whitelist || [];
      list.push(url);
      chrome.storage.sync.set({ whitelist: list });
      addToList(url);
      whitelistInput.value = "";
    });
  });

  // リスト描画用
  function addToList(url) {
    const li = document.createElement("li");
    li.textContent = url;
    whitelistUl.appendChild(li);
  }
});
