import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, addDoc, query, where, onSnapshot, orderBy, runTransaction, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const goalFill = document.getElementById('goal-fill');
const goalStatus = document.getElementById('goal-status');
const coinForm = document.getElementById('coin-form');
const suggestionForm = document.getElementById('suggestion-form');
const historyList = document.getElementById('history-list');
const adminPanel = document.getElementById('admin-panel');
const adminList = document.getElementById('admin-list');
const adminSuggestionsList = document.getElementById('admin-suggestions-list');
const leaderboardBody = document.getElementById('coin-leaderboard');
const rewardsContainer = document.getElementById('rewards-container');

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
                subscribeToPendingSuggestions();
            }
        }

        // Load Data
        subscribeToGoal();
        subscribeToHistory();
        loadLeaderboard();
        loadApprovedRewards();
        
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
    const dateEarned = document.getElementById('coin-date').value;

    if (!amount || amount < 1) return alert("Invalid amount");
    if (!dateEarned) return alert("Please select a date");

    const submitBtn = coinForm.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        await addDoc(collection(db, "coin_submissions"), {
            userId: currentUser.uid,
            userEmail: currentUser.email, // Store email for admin visibility
            nickname: currentUser.displayName || "Student", // Ideally fetch nickname
            amount: amount,
            dateEarned: dateEarned,
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

suggestionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textInput = document.getElementById('suggestion-text');
    const text = textInput.value.trim();
    if (!text) return;

    const lowerText = text.toLowerCase();
    
    // Check duplicates
    if (approvedSuggestions.includes(lowerText)) {
        alert("This reward has already been approved!");
        return;
    }
    if (pendingSuggestions.includes(lowerText)) {
        alert("This suggestion is already pending approval!");
        return;
    }

    try {
        await addDoc(collection(db, "reward_suggestions"), {
            userId: currentUser.uid,
            nickname: currentUser.displayName || "Student",
            suggestion: text,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        textInput.value = '';
        alert("Suggestion submitted!");
    } catch (err) {
        console.error(err);
        alert("Failed to submit suggestion.");
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
                    <span style="color:#666; font-size:0.9rem;"> - ${sub.dateEarned || 'Unknown Date'}</span>
                    <div style="font-size:0.8rem; color:#999;">Submitted: ${new Date(sub.createdAt).toLocaleDateString()}</div>
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
                    <span style="font-style:italic;">Date Earned: ${sub.dateEarned || 'Unknown'}</span>
                </div>
                <div class="admin-actions">
                    <button class="btn-sm" style="background:#2ecc71; color:white; border:none; padding:5px 10px; cursor:pointer;" onclick="approveCoin('${sub.id}', ${sub.amount}, '${sub.userId}')">✔</button>
                    <button class="btn-sm" style="background:#e74c3c; color:white; border:none; padding:5px 10px; cursor:pointer;" onclick="rejectCoin('${sub.id}')">✖</button>
                </div>
            </li>
        `).join('');
    });
}

function subscribeToPendingSuggestions() {
    const q = query(
        collection(db, "reward_suggestions"), 
        where("status", "==", "pending")
    );

    onSnapshot(q, (snapshot) => {
        const pending = [];
        snapshot.forEach(doc => pending.push({id: doc.id, ...doc.data()}));

        if (pending.length === 0) {
            adminSuggestionsList.innerHTML = '<li>No pending suggestions.</li>';
            return;
        }

        adminSuggestionsList.innerHTML = pending.map(sub => `
            <li class="admin-item">
                <div>
                    <strong>${sub.nickname}</strong> suggested:
                    <strong>${sub.suggestion}</strong>
                </div>
                <div class="admin-actions">
                    <button class="btn-sm" style="background:#2ecc71; color:white; border:none; padding:5px 10px; cursor:pointer;" onclick="approveSuggestion('${sub.id}')">✔</button>
                    <button class="btn-sm" style="background:#e74c3c; color:white; border:none; padding:5px 10px; cursor:pointer;" onclick="rejectSuggestion('${sub.id}')">✖</button>
                </div>
            </li>
        `).join('');
    });
}

// Global functions for HTML onclick
window.approveCoin = async (id, amount, userId) => {
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

            // 3. Update User Total
            const userRef = doc(db, "users", userId);
            transaction.update(userRef, { coinsCollected: increment(amount) });
        });
    } catch (err) {
        console.error("Approval failed", err);
        alert("Failed to approve. Check console."); 
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

window.approveSuggestion = async (id) => {
    if (!isAdmin) return;
    try {
        await updateDoc(doc(db, "reward_suggestions", id), { status: 'approved' });
    } catch(e) { alert("Error"); }
};

window.rejectSuggestion = async (id) => {
    if (!isAdmin) return;
    try {
        await updateDoc(doc(db, "reward_suggestions", id), { status: 'rejected' });
    } catch(e) { alert("Error"); }
};

let approvedSuggestions = []; // Cache for validation
let pendingSuggestions = []; // Cache for validation

// --- Rewards Logic ---
async function loadApprovedRewards() {
    const q = query(collection(db, "reward_suggestions"), where("status", "==", "approved"));
    onSnapshot(q, (snap) => {
        let html = `
            <div class="reward-tag">🚌 Field Trip</div>
            <div class="reward-tag">🏃 Extra Recess</div>
        `;
        
        approvedSuggestions = ["field trip", "extra recess"]; // Reset local cache

        snap.forEach(doc => {
            const data = doc.data();
            html += `<div class="reward-tag">✨ ${data.suggestion}</div>`;
            approvedSuggestions.push(data.suggestion.toLowerCase());
        });
        
        rewardsContainer.innerHTML = html;
    });

    // Also fetch pending for duplicates check
    const qPending = query(collection(db, "reward_suggestions"), where("status", "==", "pending"));
    onSnapshot(qPending, (snap) => {
        pendingSuggestions = [];
        snap.forEach(doc => {
            pendingSuggestions.push(doc.data().suggestion.toLowerCase());
        });
    });
}

// --- Leaderboard Logic ---
async function loadLeaderboard() {
    const q = query(collection(db, "users"));
    
    onSnapshot(q, (snap) => {
        const users = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.role !== 'admin' && d.email !== 'admin@example.com') {
                users.push({
                    id: doc.id,
                    name: d.nickname || "Student",
                    coins: d.coinsCollected || 0
                });
            }
        });

        users.sort((a, b) => b.coins - a.coins);

        if (users.length === 0) {
            leaderboardBody.innerHTML = '<tr><td colspan="4">No coins collected yet.</td></tr>';
            return;
        }

        leaderboardBody.innerHTML = users.map((u, i) => `
            <tr>
                <td style="padding: 0.5rem; text-align:center;">${i + 1}</td>
                <td style="padding: 0.5rem;">${u.name}</td>
                <td style="padding: 0.5rem; text-align:center;">${u.coins}</td>
                <td style="padding: 0.5rem;">
                    ${isAdmin ? `<button class="btn-sm" style="font-size:0.7rem; padding:2px 5px; cursor:pointer;" onclick="editCoins('${u.id}', ${u.coins})">✏️</button>` : ''}
                </td>
            </tr>
        `).join('');
    });
}

// Global Edit Function
window.editCoins = async (uid, current) => {
    if (!isAdmin) return;
    const newVal = prompt("Set new coin total for this student:", current);
    if (newVal === null) return;
    const num = parseInt(newVal);
    if (isNaN(num)) return alert("Invalid number");

    try {
        await updateDoc(doc(db, "users", uid), {
            coinsCollected: num
        });
    } catch (e) {
        console.error(e);
        alert("Update failed");
    }
};
