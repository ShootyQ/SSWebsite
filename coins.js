import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, addDoc, query, where, onSnapshot, orderBy, runTransaction, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const goalFill = document.getElementById('goal-fill');
const goalStatus = document.getElementById('goal-status');
const coinForm = document.getElementById('coin-form');
const historyList = document.getElementById('history-list');
const adminPanel = document.getElementById('admin-panel');
const adminList = document.getElementById('admin-list');

let currentUser = null;
let isAdmin = false;
const GOAL_TARGET = 300; // Default

// Init
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Check Admin Status
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            isAdmin = data.role === 'admin' || data.email === 'admin@example.com' || (data.claims && data.claims.admin);
            
            if (isAdmin) {
                adminPanel.style.display = 'block';
                subscribeToPending();
            }
        }

        // Load Data
        subscribeToGoal();
        subscribeToHistory();
        
    } else {
        window.location.href = "index.html";
    }
});

// --- Goal Logic ---
function subscribeToGoal() {
    onSnapshot(doc(db, "system", "class_goals"), (docSnap) => {
        let current = 0;
        let target = GOAL_TARGET;

        if (docSnap.exists()) {
            const data = docSnap.data();
            current = data.currentCoins || 0;
            if (data.targetCoins) target = data.targetCoins;
        } else {
            // Create if missing
            setDoc(doc(db, "system", "class_goals"), { currentCoins: 0, targetCoins: GOAL_TARGET });
        }

        updateProgressBar(current, target);
    });
}

function updateProgressBar(current, target) {
    const pct = Math.min(100, Math.round((current / target) * 100));
    goalFill.style.width = `${pct}%`;
    goalFill.textContent = `${pct}%`;
    goalStatus.textContent = `${current} / ${target}`;
}

// --- Submission Logic ---
coinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById('coin-amount').value);
    const reason = document.getElementById('coin-reason').value;

    if (!amount || amount < 1) return alert("Invalid amount");

    const submitBtn = coinForm.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        await addDoc(collection(db, "coin_submissions"), {
            userId: currentUser.uid,
            userEmail: currentUser.email, // Store email for admin visibility
            nickname: currentUser.displayName || "Student", // Ideally fetch nickname
            amount: amount,
            reason: reason,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        
        coinForm.reset();
        alert("Submitted for review!");
    } catch (err) {
        console.error(err);
        alert("Error submitting.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit for Review";
    }
});

// --- History Logic ---
function subscribeToHistory() {
    const q = query(
        collection(db, "coin_submissions"), 
        where("userId", "==", currentUser.uid)
        // Note: Composite index might be needed for orderBy, so we'll sort client side for now to avoid error
    );

    onSnapshot(q, (snapshot) => {
        const submissions = [];
        snapshot.forEach(doc => submissions.push({id: doc.id, ...doc.data()}));
        
        // Sort DESC
        submissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (submissions.length === 0) {
            historyList.innerHTML = '<li>No submissions yet.</li>';
            return;
        }

        historyList.innerHTML = submissions.map(sub => `
            <li class="history-item">
                <div>
                    <strong>${sub.amount} Coin${sub.amount > 1 ? 's' : ''}</strong>
                    <span style="color:#666; font-size:0.9rem;"> - ${sub.reason}</span>
                    <div style="font-size:0.8rem; color:#999;">${new Date(sub.createdAt).toLocaleDateString()}</div>
                </div>
                <span class="status-badge status-${sub.status}">${sub.status}</span>
            </li>
        `).join('');
    });
}

// --- Admin Logic ---
function subscribeToPending() {
    const q = query(
        collection(db, "coin_submissions"), 
        where("status", "==", "pending")
    );

    onSnapshot(q, (snapshot) => {
        const pending = [];
        snapshot.forEach(doc => pending.push({id: doc.id, ...doc.data()}));

        if (pending.length === 0) {
            adminList.innerHTML = '<li>No pending reviews.</li>';
            return;
        }

        adminList.innerHTML = pending.map(sub => `
            <li class="admin-item">
                <div>
                    <strong>${sub.nickname || sub.userEmail}</strong> wants to submit 
                    <strong>${sub.amount} Coin${sub.amount > 1 ? 's' : ''}</strong><br>
                    <span style="font-style:italic;">"${sub.reason}"</span>
                </div>
                <div class="admin-actions">
                    <button class="btn-sm" style="background:#2ecc71; color:white; border:none; padding:5px 10px; cursor:pointer;" onclick="approveCoin('${sub.id}', ${sub.amount})">✔</button>
                    <button class="btn-sm" style="background:#e74c3c; color:white; border:none; padding:5px 10px; cursor:pointer;" onclick="rejectCoin('${sub.id}')">✖</button>
                </div>
            </li>
        `).join('');
    });
}

// Global functions for HTML onclick
window.approveCoin = async (id, amount) => {
    if (!isAdmin) return;
    if (!confirm(`Approve ${amount} coins?`)) return;

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Update Goal
            const goalRef = doc(db, "system", "class_goals");
            transaction.update(goalRef, {
                currentCoins: increment(amount)
            });

            // 2. Update Submission Status
            const subRef = doc(db, "coin_submissions", id);
            transaction.update(subRef, { status: 'approved' });
        });
    } catch (err) {
        console.error("Approval failed", err);
        alert("Failed to approve. Check console."); // If goals doc missing, simple handler above creates it, but Transaction requires it to exist.
        // If it fails because goalRef doesn't exist, we might need to set it first. 
        // But loadGoal creates it. Admin should see it.
    }
};

window.rejectCoin = async (id) => {
    if (!isAdmin) return;
    if (!confirm("Reject this submission?")) return;

    try {
        await updateDoc(doc(db, "coin_submissions", id), {
            status: 'rejected'
        });
    } catch (err) {
        console.error(err);
        alert("Failed to reject.");
    }
};
