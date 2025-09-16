document.addEventListener("DOMContentLoaded", () => {
    const timeoutInput = document.getElementById("timeout");
    const saveButton = document.getElementById("save");
    const whitelistInput = document.getElementById("whitelistInput");
    const addWhitelistButton = document.getElementById("addWhitelist");
    const whitelistUl = document.getElementById("whitelist");
    // Toast notification (non-blocking)
    function toast(message, type = "info", duration = 2000) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            Object.assign(container.style, {
                position: "fixed",
                right: "12px",
                bottom: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                zIndex: 9999,
                pointerEvents: "none",
                fontFamily: "system-ui, sans-serif",
                fontSize: "12px",
            });
            document.body.appendChild(container);
        }
        const el = document.createElement("div");
        el.textContent = message;
        const bg = type === "error" ? "#f44336" : type === "success" ? "#4caf50" : "#333";
        Object.assign(el.style, {
            background: bg,
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,.2)",
            opacity: "0",
            transform: "translateY(6px)",
            transition: "opacity .2s, transform .2s",
            pointerEvents: "auto",
        });
        container.appendChild(el);
        requestAnimationFrame(() => {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
        });
        setTimeout(() => {
            el.style.opacity = "0";
            el.style.transform = "translateY(6px)";
            el.addEventListener("transitionend", () => el.remove(), { once: true });
        }, duration);
    }
    // Load settings
    chrome.storage.sync.get(["timeoutMinutes", "whitelist"], (data) => {
        timeoutInput.value = data.timeoutMinutes || 30;
        (data.whitelist || []).forEach((url) => addToList(url));
    });
    // Save timeout
    saveButton.addEventListener("click", () => {
        const timeoutMinutes = Math.max(1, parseInt(timeoutInput.value, 10) || 30);
        chrome.storage.sync.set({ timeoutMinutes }, () => {
            toast("保存しました", "success");
        });
    });
    // Add whitelist entry
    addWhitelistButton.addEventListener("click", () => {
        const url = (whitelistInput.value || "").trim();
        if (!url) return;
        chrome.storage.sync.get("whitelist", (data) => {
            const list = data.whitelist || [];
            list.push(url);
            chrome.storage.sync.set({ whitelist: list }, () => {
                addToList(url);
                whitelistInput.value = "";
                toast("追加しました", "success");
            });
        });
    });
    // Render list
    function addToList(url) {
        const li = document.createElement("li");
        li.textContent = url;
        whitelistUl.appendChild(li);
    }
});