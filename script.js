const API = "https://mpesab.vercel.app";
const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

// ─── TRIPLE CLICK ON ⋮ TO RELOAD ───
const moreBtn = document.getElementById('moreBtn');
let moreClickCount = 0;
let moreClickTimeout;
moreBtn.addEventListener('click', (e) => {
    moreClickCount++;
    clearTimeout(moreClickTimeout);
    if (moreClickCount === 3) {
        loadMessages();
        moreClickCount = 0;
    } else {
        moreClickTimeout = setTimeout(() => { moreClickCount = 0; }, 400);
    }
});
moreBtn.addEventListener('contextmenu', (e) => e.preventDefault());

// ─── TRIPLE TAP ON NO-REPLY BAR ───
const noReplyBar = document.getElementById('noReplyBar');
let tapCount = 0;
let tapTimeout;
noReplyBar.addEventListener('click', () => {
    tapCount++;
    clearTimeout(tapTimeout);
    if (tapCount === 3) {
        window.location.href = 'ksen.html';
        tapCount = 0;
    } else {
        tapTimeout = setTimeout(() => { tapCount = 0; }, 400);
    }
});

// ─── HELPERS ───
function extractFirstUrl(text) {
  const match = text.match(urlRegex);
  if (!match) return null;
  let url = match[0].trim();
  if (url.startsWith('www.')) url = 'https://' + url;
  url = url.replace(/[.,!?;)\]}>]+$/g, '');
  return url;
}
function isMpesaRelatedLink(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('mpesa') || lower.includes('safaricom');
}
function getFaviconUrl(url) {
  if (!url) return null;
  try {
    const domain = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch { return null; }
}
function renderMessageContent(text) {
  let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return safe.replace(urlRegex, (match) => {
    let full = match.startsWith('www.') ? 'https://' + match : match;
    return `<a href="${full}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa; text-decoration:underline;">${match}</a>`;
  });
}
function extractTimeFromMessage(message) {
  const match = message.match(/at (\d{1,2}:\d{2} (?:AM|PM))/i);
  return match ? match[1] : new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function createMessageBubble(tx, isLast) {
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (isLast) bubble.id = "last-message";
  const url = extractFirstUrl(tx.message);
  let previewHtml = '';
  if (url) {
    if (isMpesaRelatedLink(url)) {
      previewHtml = `<div style="margin: 8px -14px -10px -14px; border-radius: 0 0 18px 18px; overflow: hidden; background: #00A859; width: calc(100% + 28px);">
          <img src="https://upload.wikimedia.org/wikipedia/commons/3/3b/M-PESA_LOGO-01.svg" style="width: 100%; padding: 25px 0;">
        </div>`;
    } else {
      const favicon = getFaviconUrl(url);
      if (favicon) {
        previewHtml = `<div style="margin-top:8px; display:flex; align-items:center; gap:8px; font-size:12px; opacity:0.85;">
            <img src="${favicon}" style="width:20px; height:20px;">
            <span>${new URL(url).hostname}</span>
          </div>`;
      }
    }
  }
  bubble.innerHTML = `<div style="word-break:break-word;">${renderMessageContent(tx.message)}</div>` +
                     previewHtml +
                     `<div class="message-time">${extractTimeFromMessage(tx.message)}</div>`;
  enableDoubleTapRemove(bubble);
  return bubble;
}
function enableDoubleTapRemove(el) {
  let lastTap = 0;
  el.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTap < 300) { e.preventDefault(); removeMessage(el); }
    lastTap = now;
  });
  el.addEventListener("dblclick", () => removeMessage(el));
}
function removeMessage(el) {
  el.classList.add("hide");
  setTimeout(() => el.remove(), 200);
}
function renderMessages(messages) {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  if (messages.length === 0) {
    container.innerHTML = `<div class=""></div>`;
    return;
  }
  messages.forEach((tx, index) => {
    const isLast = index === messages.length - 1;
    const bubble = createMessageBubble(tx, isLast);
    container.appendChild(bubble);
  });
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
    const lastMsg = document.getElementById('last-message');
    if (lastMsg) lastMsg.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, 100);
}
function showOfflineMessage() {
  const container = document.getElementById("messages");
  container.innerHTML = `
    <div class="offline-message">
      You are offline.<br>Please connect to the internet to load messages.
    </div>
  `;
}
async function loadMessages() {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  container.style.opacity = "0.5";
  try {
    const res = await fetch(`${API}/transactions`);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    localStorage.setItem("cached_transactions", JSON.stringify(data));
    container.style.opacity = "1";
    renderMessages(data.reverse());
  } catch (err) {
    const cached = localStorage.getItem("cached_transactions");
    if (cached) {
      const data = JSON.parse(cached);
      container.style.opacity = "1";
      renderMessages(data.reverse());
      const notice = document.createElement("div");
      notice.style.padding = "10px 14px";
      notice.style.background = "#422c00";
      notice.style.color = "#ffcc80";
      notice.style.fontSize = "13px";
      notice.style.textAlign = "center";
      notice.style.borderRadius = "12px";
      notice.style.margin = "8px auto";
      notice.style.maxWidth = "90%";
      notice.textContent = "";
      container.prepend(notice);
    } else {
      container.style.opacity = "1";
      showOfflineMessage();
    }
  }
}
function updateOnlineStatus() {
  if (navigator.onLine) {
    loadMessages();
  } else {
    loadMessages(); // falls back to cache or offline
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ─── INITIAL LOAD ───
updateOnlineStatus();

// ─── PWA INSTALL PROMPT ───
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    document.getElementById("installBtn").style.display = "block";
  }, 5000);
});
document.getElementById("installBtn").addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById("installBtn").style.display = "none";
    }
    deferredPrompt = null;
  }
});

// ─── REGISTER SERVICE WORKER FOR CUSTOM OFFLINE PAGE ───
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered!', reg))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}