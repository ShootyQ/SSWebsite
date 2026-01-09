import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Definitions ---
const HOUSING = [
    { id: 'h_box', name: 'Cardboard Box', type: 'housing', rent: 0, price: 0, multiplier: 1.0, desc: "It's free, but it's soggy.", image: '📦' },
    { id: 'h_tent', name: 'Backyard Tent', type: 'housing', rent: 10, price: 500, multiplier: 1.05, desc: "Fresh air! Watch out for bugs.", image: '⛺' },
    { id: 'h_studio', name: 'Studio Apartment', type: 'housing', rent: 50, price: 5000, multiplier: 1.1, desc: "Cozy. Includes running water.", image: '🏢' },
    { id: 'h_house', name: 'Suburban House', type: 'housing', rent: 150, price: 25000, multiplier: 1.25, desc: "White picket fence included.", image: '🏡' },
    { id: 'h_mansion', name: 'Luxury Mansion', type: 'housing', rent: 500, price: 100000, multiplier: 1.5, desc: "Live like a king.", image: '🏰' },
    { id: 'h_castle', name: 'Historic Castle', type: 'housing', rent: 2000, price: 1000000, multiplier: 2.0, desc: "Comes with a ghost.", image: '🏯' }
];

const COMMERCIAL = [
    { id: 'c_lemonade', name: 'Lemonade Stand', type: 'commercial', price: 200, income: 10, desc: "Classic starter business.", image: '🍋' },
    { id: 'c_vending', name: 'Vending Machine', type: 'commercial', price: 1000, income: 40, desc: "Passive income at its finest.", image: '🍫' },
    { id: 'c_laundromat', name: 'Laundromat', type: 'commercial', price: 5000, income: 150, desc: "Everyone needs clean clothes.", image: '👕' },
    { id: 'c_arcade', name: 'Retro Arcade', type: 'commercial', price: 15000, income: 400, desc: "Insert coin to play.", image: '🕹️' },
    { id: 'c_cinema', name: 'Movie Theater', type: 'commercial', price: 50000, income: 1200, desc: "Popcorn sales are booming.", image: '🍿' },
    { id: 'c_hotel', name: 'Grand Hotel', type: 'commercial', price: 250000, income: 5000, desc: "5-star service only.", image: '🏨' }
];

// --- DOM Elements ---
const els = {
    housingGrid: document.getElementById('housing-grid'),
    commercialGrid: document.getElementById('commercial-grid'),
    userCash: document.getElementById('user-cash'),
    userIncome: document.getElementById('user-income'),
    userRent: document.getElementById('user-rent'),
    tabs: document.querySelectorAll('.tab-btn'),
    contents: document.querySelectorAll('.tab-content')
};

let currentUser = null;
let userData = null;

// --- Init ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        renderAll();
    } else {
        window.location.href = "index.html";
    }
});

async function loadUserData() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (docSnap.exists()) {
        userData = docSnap.data();
        updateHeaderStats();
    }
}

function updateHeaderStats() {
    const cash = userData.balance || 0;
    els.userCash.textContent = `$${cash.toLocaleString()}`;

    // Calculate Daily Stats
    let dailyRent = 0;
    if (userData.residence) {
        const house = HOUSING.find(h => h.id === userData.residence.id);
        // If they own it (isOwned flag), rent is 0. If they rent it, use rent price.
        if (house && !userData.residence.isOwned) {
            dailyRent = house.rent;
        }
    }
    els.userRent.textContent = `-$${dailyRent.toLocaleString()}`;

    let dailyIncome = 0;
    const properties = userData.properties || []; // Array of property IDs
    properties.forEach(pid => {
        const prop = COMMERCIAL.find(c => c.id === pid);
        if (prop) dailyIncome += prop.income;
    });
    els.userIncome.textContent = `+$${dailyIncome.toLocaleString()}`;
}

// --- Rendering ---
function renderAll() {
    renderHousing();
    renderCommercial();
}

function renderHousing() {
    els.housingGrid.innerHTML = '';
    const currentRes = userData.residence || { id: 'h_box', isOwned: false };

    HOUSING.forEach(house => {
        const isCurrent = currentRes.id === house.id;
        const isOwned = isCurrent && currentRes.isOwned;
        
        const card = document.createElement('div');
        card.className = `real-estate-card ${isCurrent ? 'active-home' : ''}`;
        
        let actionButtons = '';
        
        if (isCurrent) {
            if (isOwned) {
                actionButtons = `<button class="btn-disabled" disabled>Owned & Occupied</button>`;
            } else {
                if (house.price > 0) {
                    actionButtons = `
                        <button class="btn-disabled" disabled>Currently Renting</button>
                        <button class="btn-buy" onclick="buyHouse('${house.id}')">Buy for $${house.price.toLocaleString()}</button>
                    `;
                } else {
                    actionButtons = `<button class="btn-disabled" disabled>Current Home</button>`;
                }
            }
        } else {
            // Not current home
            if (house.rent > 0) {
                actionButtons = `
                    <button class="btn-rent" onclick="rentHouse('${house.id}')">Rent ($${house.rent}/day)</button>
                    <button class="btn-buy" onclick="buyHouse('${house.id}')">Buy for $${house.price.toLocaleString()}</button>
                `;
            } else {
                // Free box
                actionButtons = `<button class="btn-rent" onclick="rentHouse('${house.id}')">Move In (Free)</button>`;
            }
        }

        card.innerHTML = `
            <div class="re-icon">${house.image}</div>
            <div class="re-info">
                <h3>${house.name}</h3>
                <p class="re-desc">${house.desc}</p>
                <div class="re-stats">
                    <span class="stat-badge xp">XP x${house.multiplier}</span>
                    ${house.rent > 0 ? `<span class="stat-badge rent">Rent: $${house.rent}/day</span>` : ''}
                </div>
            </div>
            <div class="re-actions">
                ${actionButtons}
            </div>
        `;
        els.housingGrid.appendChild(card);
    });
}

function renderCommercial() {
    els.commercialGrid.innerHTML = '';
    const ownedProps = userData.properties || [];

    COMMERCIAL.forEach(prop => {
        // Count how many of this type owned (if we allow multiples? Let's say unique for now for simplicity, or multiples allowed)
        // Let's allow multiples for "Monopoly" feel!
        const count = ownedProps.filter(id => id === prop.id).length;

        const card = document.createElement('div');
        card.className = 'real-estate-card commercial';
        
        card.innerHTML = `
            <div class="re-icon">${prop.image}</div>
            <div class="re-info">
                <h3>${prop.name}</h3>
                <p class="re-desc">${prop.desc}</p>
                <div class="re-stats">
                    <span class="stat-badge income">+$${prop.income}/day</span>
                    <span class="stat-badge owned">Owned: ${count}</span>
                </div>
            </div>
            <div class="re-actions">
                <button class="btn-buy" onclick="buyCommercial('${prop.id}')">Buy ($${prop.price.toLocaleString()})</button>
            </div>
        `;
        els.commercialGrid.appendChild(card);
    });
}

// --- Actions ---

window.rentHouse = async (houseId) => {
    const house = HOUSING.find(h => h.id === houseId);
    if (!house) return;

    if (!confirm(`Move into ${house.name}? Rent of $${house.rent} will be deducted daily.`)) return;

    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            residence: {
                id: house.id,
                isOwned: false,
                movedInAt: new Date().toISOString()
            }
        });
        await loadUserData();
        renderAll();
        alert(`Moved into ${house.name}!`);
    } catch (err) {
        console.error(err);
        alert("Error moving in.");
    }
};

window.buyHouse = async (houseId) => {
    const house = HOUSING.find(h => h.id === houseId);
    if (!house) return;

    if (userData.balance < house.price) {
        alert("Insufficient funds!");
        return;
    }

    if (!confirm(`Buy ${house.name} for $${house.price.toLocaleString()}? You will no longer pay rent.`)) return;

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", currentUser.uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User error";
            
            const data = userDoc.data();
            if (data.balance < house.price) throw "Insufficient funds";

            transaction.update(userRef, {
                balance: data.balance - house.price,
                residence: {
                    id: house.id,
                    isOwned: true, // Ownership flag
                    boughtAt: new Date().toISOString()
                }
            });
        });
        
        await loadUserData();
        renderAll();
        alert(`Congratulations! You bought the ${house.name}!`);
    } catch (err) {
        console.error(err);
        alert("Transaction failed: " + err);
    }
};

window.buyCommercial = async (propId) => {
    const prop = COMMERCIAL.find(c => c.id === propId);
    if (!prop) return;

    if (userData.balance < prop.price) {
        alert("Insufficient funds!");
        return;
    }

    if (!confirm(`Invest in ${prop.name} for $${prop.price.toLocaleString()}?`)) return;

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", currentUser.uid);
            const userDoc = await transaction.get(userRef);
            const data = userDoc.data();
            
            if (data.balance < prop.price) throw "Insufficient funds";

            transaction.update(userRef, {
                balance: data.balance - prop.price,
                properties: arrayUnion(prop.id) // Allows duplicates? No, arrayUnion unique. 
                // Wait, arrayUnion only adds unique. If we want multiples, we need a map or array with duplicates.
                // Let's use a map { 'c_lemonade': 2 } or just a simple array update without arrayUnion for duplicates.
            });
            
            // Since arrayUnion doesn't support duplicates, let's do a manual array push
            const currentProps = data.properties || [];
            currentProps.push(prop.id);
            transaction.update(userRef, { properties: currentProps });
        });

        await loadUserData();
        renderAll();
        alert(`You acquired a ${prop.name}!`);
    } catch (err) {
        console.error(err);
        alert("Transaction failed: " + err);
    }
};

// --- Tabs ---
els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        els.tabs.forEach(t => t.classList.remove('active'));
        els.contents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});
