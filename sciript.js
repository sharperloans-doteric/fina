const API = "https://funds-mauve.vercel.app/api";
const BACKEND_PAYMENT = "https://newpayment-srpu.onrender.com";
const WEB3FORMS_KEY = "bf0e28a0-7666-4bfc-91ad-bcb1699d5d6c";

window.onload = () => {
    checkBioStatus();
};

function checkBioStatus() {
    const isEnabled = localStorage.getItem('biometrics_enabled') === 'true';
    document.getElementById('quickBioBtn').style.display = isEnabled ? 'flex' : 'none';
    document.getElementById('disableBioLink').style.display = isEnabled ? 'block' : 'none';
}

function disableBiometrics() {
    if(confirm("Are you sure you want to disable robotic login?")) {
        localStorage.removeItem('biometrics_enabled');
        checkBioStatus();
        document.getElementById('status').style.color = "#ffab00";
        document.getElementById('status').innerText = "Robotic disabled.";
        setTimeout(() => { document.getElementById('status').innerText = ""; }, 2000);
    }
}

function closeBioOverlay() {
    document.getElementById('biometricOverlay').style.display = 'none';
    document.getElementById('bioMsg').innerText = "";
    showSection('choiceSection');
}

async function enrollBiometrics() {
    const bioMsg = document.getElementById('bioMsg');
    try {
        if (window.PublicKeyCredential) {
            localStorage.setItem('biometrics_enabled', 'true');
            bioMsg.style.color = "#4CAF50";
            bioMsg.innerText = "Robot enabled successfully!";
            checkBioStatus();
            setTimeout(closeBioOverlay, 1500);
        } else {
            bioMsg.style.color = "#ffab00";
            bioMsg.innerText = "Device does not support robot login.";
            setTimeout(closeBioOverlay, 2000);
        }
    } catch (e) {
        console.error(e);
        closeBioOverlay();
    }
}

async function loginWithBiometrics() {
    const status = document.getElementById('status');
    try {
        status.style.color = "#4CAF50";
        status.innerText = "Confirm robot on your device...";
        
        setTimeout(() => {
            const user = JSON.parse(localStorage.getItem('mledger_user'));
            if (user) {
                showSection('choiceSection');
                status.innerText = "";
            } else {
                status.style.color = "#ffab00";
                status.innerText = "Please login with PIN once first.";
            }
        }, 1500);
        
    } catch (err) {
        status.innerText = "Robot failed.";
    }
}

function showSection(sectionId) {
    ['loginSection', 'regSection', 'resetSection', 'choiceSection'].forEach(id => {
        document.getElementById(id).style.display = (id === sectionId) ? 'block' : 'none';
    });
    document.getElementById('status').innerText = "";
    if(sectionId === 'loginSection') checkBioStatus();
}

function toggleReferralInput() {
    const choice = document.getElementById('referralChoice').value;
    document.getElementById('rReferrer').style.display = (choice === 'yes') ? 'block' : 'none';
}

function goTo(page) { window.location.href = page; }

async function login() {
    const btn = document.getElementById('lBtn');
    const status = document.getElementById('status');
    const phone = document.getElementById('lPhone').value;
    const pass = document.getElementById('lPass').value;
    
    if(!phone || !pass) { status.innerText = "Enter credentials"; return; }

    btn.innerText = "Logging in...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/login`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ phone, password: pass })
        });
        const d = await res.json();
        if (d.success) {
            localStorage.setItem('mledger_user', JSON.stringify(d.user));
            if (localStorage.getItem('biometrics_enabled') !== 'true') {
                document.getElementById('biometricOverlay').style.display = 'flex';
            } else {
                showSection('choiceSection');
            }
        } else {
            status.style.color = "#ffab00";
            status.innerText = d.error || "Login failed";
            btn.innerText = "Login";
            btn.disabled = false;
        }
    } catch (err) {
        status.innerText = "Connection failed.";
        btn.disabled = false;
        btn.innerText = "Login";
    }
}

async function register() {
    const btn = document.getElementById('rBtn');
    const status = document.getElementById('status');
    const name = document.getElementById('rName').value;
    const phone = document.getElementById('rPhone').value;
    const pass = document.getElementById('rPass').value;
    const refChoice = document.getElementById('referralChoice').value;
    const refNumber = document.getElementById('rReferrer').value;
    
    btn.innerText = "Creating Account...";
    btn.disabled = true;
    try {
        const res = await fetch(`${API}/register`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ name, phone, password: pass })
        });
        const d = await res.json();
        if(d.message || d.success) {
            status.style.color = "#4CAF50";
            status.innerText = "Account Created!";
            await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_key: WEB3FORMS_KEY,
                    subject: "New Referral Registered",
                    message: `New User: ${name}\nPhone: ${phone}\nReferral: ${refChoice === 'yes' ? refNumber : 'NONE'}`
                })
            });
            setTimeout(() => showSection('loginSection'), 1500);
        } else {
            status.style.color = "#ffab00";
            status.innerText = d.error || "Registration failed";
        }
    } catch (err) { status.innerText = "Error during registration."; }
    finally { btn.innerText = "Register"; btn.disabled = false; }
}

async function changePin() {
    const btn = document.getElementById('resetBtn');
    const status = document.getElementById('status');
    const phone = document.getElementById('resetPhone').value;
    const newPassword = document.getElementById('resetPass').value;
    if(!phone || !newPassword) { status.innerText = "Fill all fields"; return; }
    btn.innerHTML = '<span class="loader"></span>Verifying...';
    btn.disabled = true;
    try {
        const payRes = await fetch(`${BACKEND_PAYMENT}/api/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: 10, phone_number: phone })
        });
        const payData = await payRes.json();
        const invoiceId = payData.invoice ? payData.invoice.invoice_id : (payData.id || null);
        if (invoiceId) {
            status.innerText = "Confirm M-Pesa PIN on your phone...";
            startPollingReset(invoiceId, phone, newPassword);
        } else { throw new Error(); }
    } catch (err) {
        status.innerText = "STK Push failed.";
        btn.disabled = false;
        btn.innerText = "Verify & Update PIN";
    }
}

function startPollingReset(invoiceId, phone, newPassword) {
    let pollCount = 0;
    const pollTimer = setInterval(async () => {
        pollCount++;
        try {
            const res = await fetch(`${BACKEND_PAYMENT}/api/status/${invoiceId}`);
            const data = await res.json();
            const state = data.invoice ? data.invoice.state : data.state;
            if (state === "COMPLETE" || state === "COMPLETED") {
                clearInterval(pollTimer);
                finalizePinUpdate(phone, newPassword);
            } else if (state === "FAILED" || pollCount > 20) {
                clearInterval(pollTimer);
                document.getElementById('status').innerText = "Verification failed.";
                document.getElementById('resetBtn').disabled = false;
            }
        } catch (e) { }
    }, 3000);
}

async function finalizePinUpdate(phone, newPassword) {
    await fetch(`${API}/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, newPassword })
    });
    showSection('loginSection');
}