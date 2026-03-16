const SYSTEM_API  = "https://funds-mauve.vercel.app/api";
const EXTERNAL_API = "https://mpesab.vercel.app";
const STORAGE_KEY = "tillToNameMap";

let user = JSON.parse(localStorage.getItem('mledger_user'));
if (!user) location.href = 'index.html';

const elements = {
  phone: document.getElementById("phone"),
  amount: document.getElementById("amount"),
  account: document.getElementById("account"),
  name: document.getElementById("name"),
  nameHint: document.getElementById("nameHint"),
  status: document.getElementById("statusDisplay"),
  phoneOkBtn: document.getElementById("phoneOkBtn"),
  amountOkBtn: document.getElementById("amountOkBtn"),
  accountOkBtn: document.getElementById("accountOkBtn"),
  nameOkBtn: document.getElementById("nameOkBtn"),
  sendBtn: document.getElementById("sendBtn")
};

let tillToName = {};
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) tillToName = JSON.parse(saved);
} catch (e) {}

// --- Token helpers ---
function getYearLetter() {
  const year = new Date().getFullYear();
  const offset = year - 2026;
  return String.fromCharCode(85 + offset); // 2026 = U
}

function getMonthThirdLetter() {
  const thirdLetters = "ABCDEFGHIJKL";
  return thirdLetters[new Date().getMonth()];
}

function getDayCode() {
  const day = new Date().getDate();
  if (day <= 9) return day.toString();
  return String.fromCharCode(65 + (day - 10)); // 10=A, etc.
}

// --- Formatters ---
function formatBalance(amount) {
  return "Ksh " + Number(amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function formatDateNumeric() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime12Hour() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function calculateCost(amt) {
  if (amt <= 100) return 0;
  if (amt <= 500) return 7;
  if (amt <= 1000) return 13;
  if (amt <= 5000) return 25;
  if (amt <= 10000) return 55;
  if (amt <= 20000) return 75;
  return 108;
}

// --- Navigation ---
function showStatus(msg, isError = false) {
  elements.status.textContent = msg;
  elements.status.className = isError ? 'status-text active error' : 'status-text active';
}

function hideAll() {
  document.querySelectorAll('.current-step, input, button, .search-note').forEach(e => e.classList.remove('active'));
}

function showPhone() {
  hideAll();
  document.getElementById('phoneLabel').classList.add('active');
  elements.phone.classList.add('active');
  elements.phoneOkBtn.classList.add('active');
}

function showAccount() {
  hideAll();
  document.getElementById('accountLabel').classList.add('active');
  elements.account.classList.add('active');
  elements.accountOkBtn.classList.add('active');
}

function showAmount() {
  hideAll();
  document.getElementById('amountLabel').classList.add('active');
  elements.amount.classList.add('active');
  elements.amountOkBtn.classList.add('active');
}

function showName() {
  hideAll();
  document.getElementById('nameLabel').classList.add('active');
  elements.name.classList.add('active');
  elements.nameHint.classList.add('active');
  elements.nameOkBtn.classList.add('active');
}

function showSend() {
  hideAll();
  document.getElementById('sendLabel').classList.add('active');
  elements.sendBtn.classList.add('active');
}

// --- Logic ---
elements.phoneOkBtn.onclick = async () => {
  const till = elements.phone.value.trim();
  if (!till) return showStatus("Please enter business number", true);
 
  let prefilled = tillToName[till] || "";
  if (!prefilled) {
    try {
      const r = await fetch(`${EXTERNAL_API}/lookup/${till}`);
      const d = await r.json();
      if (d.found && d.name) {
        prefilled = d.name;
        tillToName[till] = prefilled;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tillToName));
      }
    } catch {}
  }
  elements.name.value = prefilled;
  showAccount();
};

elements.accountOkBtn.onclick = () => {
  if (!elements.account.value.trim()) return showStatus("Enter account number", true);
  showAmount();
};

elements.amountOkBtn.onclick = () => {
  const amt = parseFloat(elements.amount.value);
  if (!amt || amt <= 0) return showStatus("Invalid amount", true);
 
  const cost = calculateCost(amt);
  const required = amt + cost;
  if (required > user.balance) {
    return showStatus(`Balance airtime you have : ${formatBalance(user.balance)}. Needed airtime: ${formatBalance(required)} Please buy airtime to complete transcation`, true);
  }
  showName();
};

elements.nameOkBtn.onclick = () => {
  if (!elements.name.value.trim()) return showStatus("Enter full name", true);
  showSend();
};

elements.sendBtn.onclick = async () => {
  const amountVal = parseFloat(elements.amount.value);
  elements.sendBtn.innerText = "Processing...";
  elements.sendBtn.disabled = true;

  try {
    const sysRes = await fetch(`${SYSTEM_API}/send`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ fromPhone: user.phone, toPhone: elements.phone.value, amount: amountVal })
    });
   
    const sysData = await sysRes.json();
    if (!sysRes.ok) throw new Error(sysData.error || "Transaction failed");

    user.balance = sysData.balance;
    localStorage.setItem('mledger_user', JSON.stringify(user));

    const token = `${getYearLetter()}${getMonthThirdLetter()}${getDayCode()}K${Math.random().toString(36).substring(2,8).toUpperCase()}`;
    const dateStr = formatDateNumeric();
    const timeStr = formatTime12Hour();

    const message = `${token} Confirmed. Ksh${amountVal.toFixed(2)} transferred to ${elements.name.value} for account ${elements.account.value} on ${dateStr} at ${timeStr}. Merchant Account Balance is Ksh${user.balance.toFixed(2)}.`;

    showStatus(message);

    fetch(`${EXTERNAL_API}/send`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ phone: elements.phone.value, name: elements.name.value, amount: amountVal, message, token })
    }).catch(() => {});

    setTimeout(() => { location.href = 'act.html.html'; }, 1800);
  } catch (e) {
    showStatus(e.message || "Transaction failed", true);
    elements.sendBtn.innerText = "Try Again";
    elements.sendBtn.disabled = false;
  }
};

showPhone();
