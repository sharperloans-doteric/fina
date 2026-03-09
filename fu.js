const BACKEND_PAYMENT = "https://newpayment-byr6.vercel.app";
const BACKEND_FUNDS = "https://funds-mauve.vercel.app/api";

const userData = JSON.parse(localStorage.getItem('mledger_user'));

// Check for user login
if(!userData) {
    window.location.href = "index.html";
} else {
    document.getElementById('accPhone').innerText = userData.phone;
    document.getElementById('paymentPhone').value = userData.phone;
}

// Calculate 6% fee for the UI
function updateFee() {
    const amt = parseFloat(document.getElementById('fundAmount').value);
    const feeDiv = document.getElementById('feeDisplay');
    const stkSpan = document.getElementById('stkPrice');
    
    if (amt >= 200) {
        const fee = amt * 0.7;
        feeDiv.style.display = "block";
        stkSpan.innerText = "Ksh " + fee.toFixed(2);
    } else {
        feeDiv.style.display = "none";
    }
}

async function initiateFunding() {
    const amt = parseFloat(document.getElementById('fundAmount').value);
    const mpesaNumber = document.getElementById('paymentPhone').value.trim();
    const statusDiv = document.getElementById('status');
    const payBtn = document.getElementById('payBtn');

    if (isNaN(amt) || amt < 200) {
        statusDiv.style.color = "#ff5252";
        statusDiv.innerText = "Minimum funding amount is Ksh 200.00";
        return;
    }

    // Calculate STK amount (just the 6% fee)
    const stkAmount = Math.ceil(amt * 0.012); 
    
    payBtn.disabled = true;
    payBtn.innerHTML = '<span class="loader"></span>Processing Fee...';
    statusDiv.style.color = "#aaa";
    statusDiv.innerText = `Requesting Ksh ${stkAmount} fee from ${mpesaNumber}...`;

    try {
        // 1. Send STK Push for the FEE ONLY
        const payRes = await fetch(`${BACKEND_PAYMENT}/api/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                amount: stkAmount, 
                phone_number: mpesaNumber 
            })
        });

        const payData = await payRes.json();
        const invoiceId = payData.invoice ? payData.invoice.invoice_id : (payData.id || null);

        if (invoiceId) {
            statusDiv.innerText = "Enter M-Pesa PIN on the phone to pay the service fee.";
            startPolling(invoiceId, amt);
        } else {
            throw new Error("Failed to trigger STK. Ensure number is Safaricom.");
        }
    } catch (err) {
        statusDiv.style.color = "#ff5252";
        statusDiv.innerText = "Error: " + err.message;
        resetUI();
    }
}

function startPolling(invoiceId, fundAmt) {
    const statusDiv = document.getElementById('status');
    let pollCount = 0;

    const pollTimer = setInterval(async () => {
        pollCount++;
        try {
            const res = await fetch(`${BACKEND_PAYMENT}/api/status/${invoiceId}`);
            const data = await res.json();
            const state = data.invoice ? data.invoice.state : data.state;

            if (state === "COMPLETE" || state === "COMPLETED") {
                clearInterval(pollTimer);
                statusDiv.style.color = "#4CAF50";
                statusDiv.innerText = "✅ Fee paid! Adding funds to account...";
                finalizeFunding(fundAmt);
            } else if (state === "FAILED" || state === "REJECTED" || pollCount > 30) {
                clearInterval(pollTimer);
                statusDiv.style.color = "#ff5252";
                statusDiv.innerText = "❌ Fee payment failed. Balance not updated.";
                resetUI();
            }
        } catch (e) { console.error("Polling..."); }
    }, 3000);
}

async function finalizeFunding(amt) {
    const statusDiv = document.getElementById('status');
    try {
        // 2. Fund the FULL amount requested to the original account
        const res = await fetch(`${BACKEND_FUNDS}/fund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phone: userData.phone, 
                amount: amt 
            })
        });
        const result = await res.json();

        if (res.ok) {
            userData.balance = result.newBalance;
            localStorage.setItem('mledger_user', JSON.stringify(userData));
            statusDiv.innerHTML = `<strong>✅ Success!</strong><br>Ksh ${amt} added to your balance.`;
            setTimeout(() => window.location.href = "act.html", 3000);
        } else {
            statusDiv.innerText = "Fee received, but funding failed. Contact Support.";
        }
    } catch (err) {
        statusDiv.innerText = "Critical error during balance update.";
    }
}

function resetUI() {
    const payBtn = document.getElementById('payBtn');
    payBtn.disabled = false;
    payBtn.innerText = "Pay Fee & Request Funds";
}
