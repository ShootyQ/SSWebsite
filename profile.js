import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, increment, runTransaction, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { BADGES } from "./badge_definitions.js";
import { SHOP_ITEMS, RARITIES, SUFFIXES, generateLoot, BUILDINGS } from "./game_data.js";

// Make generateLoot global for debugging if needed
window.generateLoot = generateLoot;

const EMOJIS = ["😀", "😎", "🤓", "🤠", "👽", "🤖", "👻", "🐱", "🐶", "🦁", "⚽", "🎮", "📚", "🚀", "🎨", "🍕", "🍔", "🎸", "👑", "🕵️"];


// --- DOM Elements ---
const els = {
    // Profile Display
    displayName: document.getElementById('display-name'),
    displayTitle: document.getElementById('equipped-title'),
    netWorth: document.getElementById('profile-networth'),
    cash: document.getElementById('profile-cash'),
    avatar: document.getElementById('current-avatar'),
    badgeShelf: document.getElementById('badges-display'),
    funFact: document.getElementById('display-fun-fact'),
    eraTag: document.getElementById('display-era'),
    
    // Home Selector
    homeSelector: document.getElementById('home-selector'),
    profileContainer: document.getElementById('profile-main-container'),

    // Buttons
    shopBtn: document.getElementById('open-shop-btn'),
    inventoryBtn: document.getElementById('open-inventory-btn'),
    editProfileBtn: document.getElementById('edit-profile-btn'),
    
    // Modals
    shopModal: document.getElementById('shop-modal'),
    inventoryModal: document.getElementById('inventory-modal'),
    editModal: document.getElementById('edit-profile-modal'),
    
    // Close Buttons
    closeShop: document.getElementById('close-shop-modal'),
    closeInventory: document.getElementById('close-inventory-modal'),
    closeEdit: document.getElementById('close-edit-modal'),
    
    // Grids & Forms
    shopGrid: document.getElementById('shop-grid'),
    inventoryGrid: document.getElementById('inventory-grid'),
    shopBalance: document.getElementById('shop-user-balance'),
    profileForm: document.getElementById('profile-form'),
    emojiPicker: document.getElementById('emoji-picker'),
    selectedAvatarInput: document.getElementById('selected-avatar'),
    
    // Form Inputs
    inputNickname: document.getElementById('nickname'),
    inputEra: document.getElementById('favorite-era'),
    inputFunFact: document.getElementById('fun-fact')
};

let currentUserData = null;
let currentUserRef = null;

// --- Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserRef = doc(db, "users", user.uid);
        await loadUserProfile();
        initEmojiPicker();
    } else {
        window.location.href = "index.html";
    }
});

async function loadUserProfile() {
    const snap = await getDoc(currentUserRef);
    if (snap.exists()) {
        currentUserData = snap.data();
        if (currentUserData.role === 'guest') {
            alert("Your account is pending approval. Please contact your teacher.");
            window.location.href = "index.html";
            return;
        }
        renderProfile(currentUserData);
        applyEquippedItems(currentUserData.equipped);
    }
}

function initEmojiPicker() {
    els.emojiPicker.innerHTML = '';
    EMOJIS.forEach(emoji => {
        const span = document.createElement("span");
        span.textContent = emoji;
        span.classList.add("emoji-option");
        span.onclick = () => selectEmoji(emoji);
        els.emojiPicker.appendChild(span);
    });
}

function selectEmoji(emoji) {
    els.selectedAvatarInput.value = emoji;
    // Update visual selection
    document.querySelectorAll(".emoji-option").forEach(el => {
        el.classList.remove("selected");
        if (el.textContent === emoji) el.classList.add("selected");
    });
}

// --- Rendering ---
function renderProfile(data) {
    // Basic Info
    els.displayName.textContent = data.nickname || "Anonymous Trader";
    els.avatar.textContent = data.avatar || "😐";
    els.funFact.textContent = data.funFact || "No fun fact shared yet.";
    els.eraTag.textContent = data.favoriteEra || "Unknown Era";
    
    // Financials
    const cash = data.balance || 0;
    const netWorth = data.netWorth || cash;
    els.cash.textContent = `$${cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    els.netWorth.textContent = `$${netWorth.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    // Update Shop Balance
    if (els.shopBalance) els.shopBalance.textContent = `$${cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    // Badges
    els.badgeShelf.innerHTML = '';
    let earnedBadges = [];
    
    // Calculate badges on the fly (since we have the definitions now)
    BADGES.forEach(badge => {
        // Note: We pass empty array for market data as we don't have it here.
        // Most badges rely on user data or netWorth which is now in user data.
        if (badge.check(data, [])) {
            earnedBadges.push(badge);
        }
    });

    if (earnedBadges.length > 0) {
        earnedBadges.forEach(badge => {
            const badgeEl = document.createElement('div');
            badgeEl.className = 'badge-item';
            badgeEl.title = badge.title + ": " + badge.description;
            badgeEl.textContent = badge.icon;
            els.badgeShelf.appendChild(badgeEl);
        });
    } else {
        els.badgeShelf.innerHTML = '<p class="empty-shelf-text">Earn badges to display them here!</p>';
    }

    // Equipped Title
    if (data.equipped && data.equipped.title) {
        els.displayTitle.textContent = data.equipped.title;
    } else {
        els.displayTitle.textContent = "Novice Trader";
    }

    // Render Collection (My Room)
    renderCollectionPreview(data.equipped ? (data.equipped.decorations || []) : []);

    // Home Selector Logic
    updateHomeSelector(data);
}

function updateHomeSelector(data) {
    const selector = els.homeSelector;
    if (!selector) return;

    selector.innerHTML = '<option value="none">Homeless (Default)</option>';
    
    // Get owned residential buildings
    const ownedBuildings = data.realEstateStats ? (data.realEstateStats.buildings || []) : [];
    const uniqueBuildings = [...new Set(ownedBuildings)]; // Remove duplicates

    uniqueBuildings.forEach(bId => {
        const building = BUILDINGS[bId];
        if (building && building.type === 'residential') {
            const option = document.createElement('option');
            option.value = bId;
            option.textContent = `${building.name} (${building.slots} Slots)`;
            selector.appendChild(option);
        }
    });

    // Set current selection
    if (data.equipped && data.equipped.home) {
        selector.value = data.equipped.home;
        applyHomeTheme(data.equipped.home);
    } else {
        selector.value = "none";
        applyHomeTheme("none");
    }

    // Add event listener if not already added (simple check)
    selector.onchange = async (e) => {
        const newHome = e.target.value;
        applyHomeTheme(newHome);
        
        // Save to DB
        try {
            await updateDoc(currentUserRef, {
                "equipped.home": newHome
            });
            // Reload profile to update slots
            await loadUserProfile();
        } catch (err) {
            console.error("Error saving home:", err);
        }
    };
}

function applyHomeTheme(homeId) {
    const container = els.profileContainer;
    if (!container) return;

    // Remove old themes
    container.classList.remove('theme-tent', 'theme-shack', 'theme-cabin', 'theme-house', 'theme-villa', 'theme-mansion', 'theme-palace');
    
    if (homeId && homeId !== 'none') {
        const building = BUILDINGS[homeId];
        if (building && building.theme) {
            container.classList.add(building.theme);
        }
    }
}

function renderCollectionPreview(equippedDecorations) {
    const container = document.getElementById('decorations-display');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Determine Max Slots based on Equipped Home
    let maxSlots = 4; // Default
    if (currentUserData && currentUserData.equipped && currentUserData.equipped.home && currentUserData.equipped.home !== 'none') {
        const home = BUILDINGS[currentUserData.equipped.home];
        if (home) maxSlots = home.slots;
    }
    
    equippedDecorations.forEach(itemId => {
        let item = SHOP_ITEMS.find(i => i.id === itemId);
        
        // If not found in shop items, it might be a unique item in inventory
        if (!item && currentUserData.inventory) {
             const invItem = currentUserData.inventory.find(i => typeof i === 'object' && i.uuid === itemId);
             if (invItem) {
                 // It's a unique item. We need to reconstruct its display info.
                 const base = SHOP_ITEMS.find(b => b.id === invItem.baseId);
                 if (base) {
                     item = { ...base, ...invItem };
                 }
             }
        }

        if (item) {
            const slot = document.createElement('div');
            slot.className = `decoration-slot filled ${item.rarity ? 'rarity-' + item.rarity : ''}`;
            slot.innerHTML = `<span class="deco-icon">${item.icon}</span>`;
            slot.title = item.name;
            container.appendChild(slot);
        }
    });

    // Fill remaining with empty slots
    for (let i = equippedDecorations.length; i < maxSlots; i++) {
        const slot = document.createElement('div');
        slot.className = 'decoration-slot empty';
        container.appendChild(slot);
    }
}

function applyEquippedItems(equipped) {
    if (!equipped) return;

    // Apply Background
    if (equipped.background) {
        const item = SHOP_ITEMS.find(i => i.id === equipped.background);
        if (item) {
            document.body.className = ''; 
            document.body.classList.add(item.cssClass);
        }
    }
}


// --- Shop Logic ---
function renderShop(category = 'all') {
    els.shopGrid.innerHTML = '';
    const inventory = currentUserData.inventory || [];

    // Only show items obtainable via 'shop'
    const shopItems = SHOP_ITEMS.filter(i => i.obtainable && i.obtainable.includes('shop'));

    const itemsToRender = category === 'all' 
        ? shopItems 
        : shopItems.filter(i => i.type === category);

    itemsToRender.forEach(item => {
        // Check if owned (only for unique items that don't stack, but for now we allow duplicates of unique items)
        // For simple items (backgrounds/titles), check if owned.
        let isOwned = false;
        if (item.type === 'background' || item.type === 'title') {
             isOwned = inventory.some(i => (typeof i === 'string' ? i === item.id : i.baseId === item.id));
        }

        const card = document.createElement('div');
        card.className = `shop-item ${isOwned ? 'owned' : ''}`;
        
        card.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <div class="item-info">
                <h4>${item.name}</h4>
                <p>${item.type.toUpperCase()}</p>
            </div>
            <button class="buy-btn" ${isOwned ? 'disabled' : ''} onclick="buyItem('${item.id}')">
                ${isOwned ? 'Owned' : '$' + item.price.toLocaleString()}
            </button>
        `;
        els.shopGrid.appendChild(card);
    });
}

window.buyItem = async (itemId) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    // Optimistic check
    if ((currentUserData.balance || 0) < item.price) {
        alert("Not enough cash!");
        return;
    }

    if (confirm(`Buy ${item.name} for $${item.price}?`)) {
        const btn = document.querySelector(`button[onclick="buyItem('${itemId}')"]`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Buying...";
        }

        try {
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(currentUserRef);
                if (!userDoc.exists()) throw "User does not exist!";

                const userData = userDoc.data();
                const currentBalance = userData.balance || 0;
                const inventory = userData.inventory || [];

                if (currentBalance < item.price) {
                    throw "Insufficient funds!";
                }

                let newItem = null;
                let alertMsg = "";

                if (item.id === 'loot_box') {
                    // Generate Loot using new function
                    newItem = generateLoot(); // Uses weighted probabilities
                    if (!newItem) throw "Loot generation failed.";
                    
                    alertMsg = `You opened the crate and found: ${newItem.name} (${newItem.rarity.toUpperCase()})!`;
                } else {
                    // Normal Item
                    if (item.type === 'background' || item.type === 'title') {
                        if (inventory.some(i => (typeof i === 'string' ? i === item.id : i.baseId === item.id))) {
                            throw "You already own this item!";
                        }
                        newItem = item.id; // Store as string for legacy/simple items
                    } else {
                        // It's a decoration bought directly (e.g. Potted Plant)
                        // It's Common by default if bought directly? Or should we generate a unique one?
                        // Let's make shop items "Common" by default.
                        newItem = {
                            uuid: crypto.randomUUID(),
                            baseId: item.id,
                            name: item.name,
                            rarity: 'common',
                            type: item.type,
                            value: item.price // Resell value is purchase price? Or lower? Let's keep it simple.
                        };
                    }
                    alertMsg = `You bought ${item.name}!`;
                }

                transaction.update(currentUserRef, {
                    balance: currentBalance - item.price,
                    inventory: arrayUnion(newItem)
                });
            });
            
            await loadUserProfile();
            renderShop(); // Refresh shop UI
            alert("Purchase Successful!");
        } catch (err) {
            console.error("Purchase failed", err);
            alert(err.toString().replace("Error: ", "")); // Show clean error message
            
            // Re-enable button if failed (though renderShop usually resets it)
            if (btn) {
                btn.disabled = false;
                btn.textContent = `$${item.price.toLocaleString()}`;
            }
        }
    }
};

// --- Inventory Logic ---
function renderInventory() {
    els.inventoryGrid.innerHTML = '';
    const inventory = currentUserData.inventory || [];
    const equipped = currentUserData.equipped || {};
    const equippedDecos = equipped.decorations || [];

    if (inventory.length === 0) {
        els.inventoryGrid.innerHTML = '<p>Your inventory is empty. Visit the shop!</p>';
        return;
    }

    inventory.forEach(invItem => {
        let itemDef = null;
        let isUnique = false;
        let uniqueId = null;

        if (typeof invItem === 'string') {
            // Legacy/Simple Item
            itemDef = SHOP_ITEMS.find(i => i.id === invItem);
            uniqueId = invItem;
        } else {
            // Unique/Rare Item
            const base = SHOP_ITEMS.find(i => i.id === invItem.baseId);
            if (base) {
                itemDef = { ...base, ...invItem }; // Merge base stats with unique stats
                isUnique = true;
                uniqueId = invItem.uuid;
            }
        }

        if (!itemDef) return;

        let isEquipped = false;
        if (itemDef.type === 'background') isEquipped = equipped.background === itemDef.id;
        if (itemDef.type === 'title') isEquipped = equipped.title === itemDef.value;
        if (itemDef.type === 'decoration') isEquipped = equippedDecos.includes(uniqueId);

        const card = document.createElement('div');
        card.className = `inventory-item ${isEquipped ? 'equipped' : ''} rarity-${itemDef.rarity || 'common'}`;
        
        card.innerHTML = `
            <div class="item-icon">${itemDef.icon}</div>
            <h4>${itemDef.name}</h4>
            ${isUnique ? `<p class="rarity-tag ${itemDef.rarity}">${itemDef.rarity.toUpperCase()}</p>` : ''}
            <button class="equip-btn" onclick="equipItem('${uniqueId}')">
                ${isEquipped ? 'Unequip' : 'Equip'}
            </button>
            ${isUnique ? `<button class="list-btn" onclick="listItem('${uniqueId}')" style="margin-top:5px; background-color:#673ab7; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer; width:100%;">List on Market</button>` : ''}
        `;
        els.inventoryGrid.appendChild(card);
    });
}

window.listItem = async (uuid) => {
    const priceStr = prompt("Enter the price you want to sell this item for:");
    if (!priceStr) return;
    const price = parseInt(priceStr);
    if (isNaN(price) || price <= 0) {
        alert("Please enter a valid price.");
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", auth.currentUser.uid);
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.data();
            const inventory = userData.inventory || [];
            
            const itemIndex = inventory.findIndex(i => i.uuid === uuid);
            if (itemIndex === -1) throw "Item not found";
            
            const item = inventory[itemIndex];
            
            // Remove from inventory
            const newInventory = [...inventory];
            newInventory.splice(itemIndex, 1);
            
            // Remove from equipped if needed
            let equipped = userData.equipped || {};
            if (equipped.decorations && equipped.decorations.includes(uuid)) {
                equipped.decorations = equipped.decorations.filter(id => id !== uuid);
            }

            // Create Listing
            const newListingRef = doc(collection(db, "market_listings"));
            transaction.set(newListingRef, {
                sellerUid: auth.currentUser.uid,
                sellerName: userData.displayName || "Unknown Student",
                price: price,
                item: item,
                createdAt: new Date().toISOString()
            });

            // Update User
            transaction.update(userRef, {
                inventory: newInventory,
                equipped: equipped
            });
        });
        
        await loadUserProfile();
        renderInventory();
        alert("Item listed on the marketplace!");
    } catch (err) {
        console.error(err);
        alert("Error listing item: " + err);
    }
};

window.sellItem = async (uuid) => {
    if (!confirm("Are you sure you want to sell this item?")) return;
    
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(currentUserRef);
            const data = userDoc.data();
            const inventory = data.inventory || [];
            
            const itemIndex = inventory.findIndex(i => i.uuid === uuid);
            if (itemIndex === -1) throw "Item not found";
            
            const item = inventory[itemIndex];
            
            // Remove from inventory
            const newInventory = [...inventory];
            newInventory.splice(itemIndex, 1);
            
            // Remove from equipped if needed
            let equipped = data.equipped || {};
            if (equipped.decorations && equipped.decorations.includes(uuid)) {
                equipped.decorations = equipped.decorations.filter(id => id !== uuid);
            }

            transaction.update(currentUserRef, {
                inventory: newInventory,
                equipped: equipped,
                balance: (data.balance || 0) + (item.value || 0)
            });
        });
        await loadUserProfile();
        renderInventory();
        alert("Item sold!");
    } catch (err) {
        console.error(err);
        alert("Error selling item.");
    }
};

window.equipItem = async (itemId) => {
    // Find item in inventory (could be string or object)
    const inventory = currentUserData.inventory || [];
    const invItem = inventory.find(i => (typeof i === 'string' ? i === itemId : i.uuid === itemId));
    
    if (!invItem) return;

    let itemDef = null;
    if (typeof invItem === 'string') {
        itemDef = SHOP_ITEMS.find(i => i.id === invItem);
    } else {
        const base = SHOP_ITEMS.find(i => i.id === invItem.baseId);
        if (base) itemDef = { ...base, ...invItem };
    }

    if (!itemDef) return;

    const equipped = currentUserData.equipped || {};
    let updates = {};

    if (itemDef.type === 'background') {
        updates['equipped.background'] = (equipped.background === itemDef.id) ? null : itemDef.id;
    } else if (itemDef.type === 'title') {
        updates['equipped.title'] = (equipped.title === itemDef.value) ? null : itemDef.value;
    } else if (itemDef.type === 'decoration') {
        let currentDecos = equipped.decorations || [];
        const targetId = itemDef.uuid || itemDef.id;
        
        if (currentDecos.includes(targetId)) {
            // Unequip
            updates['equipped.decorations'] = currentDecos.filter(id => id !== targetId);
        } else {
            // Equip
            if (currentDecos.length >= 6) {
                alert("Your room is full! Unequip something first.");
                return;
            }
            updates['equipped.decorations'] = [...currentDecos, targetId];
        }
    }

    try {
        await updateDoc(currentUserRef, updates);
        await loadUserProfile();
        renderInventory();
    } catch (err) {
        console.error("Equip failed", err);
        alert("Failed to equip item.");
    }
};

// --- Event Listeners ---

// Modals
els.shopBtn.addEventListener('click', () => {
    renderShop();
    els.shopModal.style.display = 'flex';
});

els.inventoryBtn.addEventListener('click', () => {
    renderInventory();
    els.inventoryModal.style.display = 'flex';
});

els.editProfileBtn.addEventListener('click', () => {
    // Populate form
    els.inputNickname.value = currentUserData.nickname || "";
    els.inputEra.value = currentUserData.favoriteEra || "";
    els.inputFunFact.value = currentUserData.funFact || "";
    selectEmoji(currentUserData.avatar || "😀");
    
    els.editModal.style.display = 'flex';
});

// Close Buttons
els.closeShop.addEventListener('click', () => els.shopModal.style.display = 'none');
els.closeInventory.addEventListener('click', () => els.inventoryModal.style.display = 'none');
els.closeEdit.addEventListener('click', () => els.editModal.style.display = 'none');

// Outside Click
window.onclick = (event) => {
    if (event.target === els.shopModal) els.shopModal.style.display = "none";
    if (event.target === els.inventoryModal) els.inventoryModal.style.display = "none";
    if (event.target === els.editModal) els.editModal.style.display = "none";
};

// Shop Tabs
document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        // Remove active class from all
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        // Add to clicked
        e.target.classList.add('active');
        // Filter
        renderShop(e.target.dataset.category);
    });
});

// Profile Form Submit
els.profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const updates = {
        nickname: els.inputNickname.value,
        favoriteEra: els.inputEra.value,
        funFact: els.inputFunFact.value,
        avatar: els.selectedAvatarInput.value
    };

    try {
        await updateDoc(currentUserRef, updates);
        await loadUserProfile();
        els.editModal.style.display = 'none';
        alert("Profile updated!");
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile.");
    }
});

