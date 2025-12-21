import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { BADGES } from "./badge_definitions.js";

// We need to access SHOP_ITEMS from profile.js logic, but it's not exported.
// For now, I will duplicate the list or fetch it if I refactor.
// To avoid duplication issues, I'll assume we can access it if I attach it to window in profile.js, 
// but profile.js isn't loaded here. 
// I will define a subset or fetch from a shared config file in the future.
// For this task, I will copy the item definitions to a new file `game_data.js` and import it in both, 
// OR just define the catalog logic here by reading the same list.
// Since I can't easily refactor multiple files safely in one go without risk, I'll use a dynamic import or just copy the list for the catalog view.
// Actually, I'll create a simple shared file now.

// Wait, I can't create a new file and update imports in all files easily in one turn without breaking things.
// I will define the items here again for the catalog view. It's not ideal DRY but it's safe for this step.
// Actually, I'll just fetch the items from a global variable if I load profile.js? No, that's messy.
// I'll just copy the list. It's the safest way to ensure it works immediately.

const CATALOG_ITEMS = [
    // Backgrounds
    { id: 'bg_neon', name: 'Neon City', icon: '🌆' },
    { id: 'bg_space', name: 'Deep Space', icon: '🌌' },
    { id: 'bg_matrix', name: 'The Matrix', icon: '💻' },
    { id: 'bg_gold', name: 'Solid Gold', icon: '👑' },
    { id: 'bg_nature', name: 'Zen Garden', icon: '🎋' },
    
    // Titles
    { id: 'title_shark', name: 'Loan Shark', icon: '🦈' },
    { id: 'title_whale', name: 'Market Whale', icon: '🐋' },
    { id: 'title_diamond', name: 'Diamond Hands', icon: '💎' },
    { id: 'title_rocket', name: 'To The Moon', icon: '🚀' },
    { id: 'title_historian', name: 'Time Traveler', icon: '⏳' },

    // Decorations
    { id: 'dec_plant', name: 'Potted Plant', icon: '🪴' },
    { id: 'dec_lamp', name: 'Lava Lamp', icon: '💡' },
    { id: 'dec_map', name: 'Vintage Map', icon: '🗺️' },
    { id: 'dec_gaming', name: 'Gaming Setup', icon: '🎮' },
    { id: 'dec_books', name: 'Stack of Books', icon: '📚' },
    { id: 'dec_trophy', name: 'Gold Trophy', icon: '🏆' },
    { id: 'dec_globe', name: 'World Globe', icon: '🌍' },
    
    // Pets
    { id: 'pet_cat', name: 'Pixel Cat', icon: '🐱' },
    { id: 'pet_dog', name: 'Pixel Dog', icon: '🐶' },
    { id: 'pet_dragon', name: 'Tiny Dragon', icon: '🐲' },

    // New Collectibles
    { id: 'item_scroll', name: 'Ancient Scroll', icon: '📜' },
    { id: 'item_quill', name: 'Scribe\'s Quill', icon: '✒️' },
    { id: 'item_compass', name: 'Brass Compass', icon: '🧭' },
    { id: 'item_telescope', name: 'Star Telescope', icon: '🔭' },
    { id: 'item_hourglass', name: 'Hourglass', icon: '⏳' },
    { id: 'item_scales', name: 'Scales of Justice', icon: '⚖️' },
    { id: 'item_hammer', name: 'Builder\'s Hammer', icon: '🔨' },
    { id: 'item_shield', name: 'Shield of Faith', icon: '🛡️' },
    { id: 'item_sword', name: 'Sword of Spirit', icon: '⚔️' },
    { id: 'item_helmet', name: 'Helmet of Salvation', icon: '⛑️' },
    { id: 'item_crown', name: 'Royal Crown', icon: '👑' },
    { id: 'item_harp', name: 'Golden Harp', icon: '🎵' },
    { id: 'item_tablet', name: 'Stone Tablet', icon: '🗿' },
    { id: 'item_lamp_oil', name: 'Oil Lamp', icon: '🪔' },
    { id: 'item_bread', name: 'Loaf of Bread', icon: '🍞' },
    { id: 'item_fish', name: 'Fresh Fish', icon: '🐟' },
    { id: 'item_wheat', name: 'Bundle of Wheat', icon: '🌾' },
    { id: 'item_grapes', name: 'Cluster of Grapes', icon: '🍇' },
    { id: 'item_pottery', name: 'Clay Pot', icon: '🏺' },
    { id: 'item_key', name: 'Iron Key', icon: '🗝️' },
    { id: 'item_candle', name: 'Wax Candle', icon: '🕯️' },
    { id: 'item_bell', name: 'Church Bell', icon: '🔔' },
    { id: 'item_anchor', name: 'Ship Anchor', icon: '⚓' },
    { id: 'item_wheel', name: 'Ship Wheel', icon: '☸️' },
    { id: 'item_chest', name: 'Treasure Chest', icon: '🧳' }
];

const badgesGrid = document.getElementById("badges-grid");
const catalogGrid = document.getElementById("catalog-grid");
const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");
const itemProgressText = document.getElementById("item-progress-text");
const itemProgressFill = document.getElementById("item-progress-fill");

let currentUser = null;
let userData = null;
let marketData = [];

// Initialization
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadData();
    } else {
        window.location.href = "index.html";
    }
});

async function loadData() {
    try {
        // Fetch User Data
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
        }

        // Fetch Market Data
        const marketDoc = await getDoc(doc(db, "system", "market"));
        if (marketDoc.exists()) {
            marketData = marketDoc.data().stocks || [];
        }

        renderBadges();
        renderCatalog();

    } catch (error) {
        console.error("Error loading data:", error);
        badgesGrid.innerHTML = "<p>Error loading badges.</p>";
    }
}

function renderBadges() {
    badgesGrid.innerHTML = "";
    let earnedCount = 0;

    BADGES.forEach(badge => {
        const isEarned = badge.check(userData, marketData);
        if (isEarned) earnedCount++;

        const card = document.createElement("div");
        card.className = `badge-card ${isEarned ? 'earned' : 'locked'}`;
        
        card.innerHTML = `
            <div class="badge-icon-large">${badge.icon}</div>
            <div class="badge-info">
                <h3>${badge.title}</h3>
                <p>${badge.description}</p>
            </div>
            ${isEarned ? '<div class="badge-status">Earned</div>' : '<div class="badge-status">Locked</div>'}
        `;
        
        badgesGrid.appendChild(card);
    });

    // Update Progress
    progressText.textContent = `${earnedCount} / ${BADGES.length}`;
    const percent = (earnedCount / BADGES.length) * 100;
    progressFill.style.width = `${percent}%`;
}

function renderCatalog() {
    if (!catalogGrid) return;
    catalogGrid.innerHTML = "";
    
    const inventory = userData.inventory || [];
    let ownedCount = 0;

    CATALOG_ITEMS.forEach(item => {
        // Check if owned (supports both string IDs and object items)
        const isOwned = inventory.some(invItem => {
            if (typeof invItem === 'string') return invItem === item.id;
            return invItem.baseId === item.id;
        });

        if (isOwned) ownedCount++;

        const card = document.createElement("div");
        card.className = `catalog-item ${isOwned ? 'owned' : ''}`;
        
        card.innerHTML = `
            <span class="icon">${item.icon}</span>
            <div class="name">${item.name}</div>
        `;
        
        catalogGrid.appendChild(card);
    });

    // Update Item Progress
    if (itemProgressText && itemProgressFill) {
        itemProgressText.textContent = `${ownedCount} / ${CATALOG_ITEMS.length}`;
        const percent = (ownedCount / CATALOG_ITEMS.length) * 100;
        itemProgressFill.style.width = `${percent}%`;
    }
}
