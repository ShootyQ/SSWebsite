import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, increment, runTransaction, collection, getDocs, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { BUILDINGS } from "./game_data.js";

// --- Game Constants ---
const GRID_SIZE = 8; // 8x8 Grid (64 plots total for now)
const LAND_BASE_PRICE = 500;
const PRICE_INCREMENT = 50; // Price goes up by $50 for every plot sold globally

// --- State ---
let currentUser = null;
let userData = null;
let allPlots = {}; // { "x_y": { ownerId, ownerName, buildingId, ... } }
let selectedHex = null; // { x, y }

// --- DOM Elements ---
const els = {
    grid: document.getElementById('hex-grid'),
    viewport: document.getElementById('map-viewport'),
    
    // Sidebar
    userCash: document.getElementById('user-cash'),
    userIncome: document.getElementById('user-income'),
    userXp: document.getElementById('user-xp'),
    
    // Plot Details
    plotCard: document.getElementById('plot-details'),
    plotCoords: document.getElementById('selected-coords'),
    plotOwner: document.getElementById('selected-owner'),
    plotBuilding: document.getElementById('selected-building'),
    plotActions: document.getElementById('plot-actions'),
    
    // Modal
    buildModal: document.getElementById('build-modal'),
    buildOptions: document.getElementById('building-options'),
    closeBuild: document.getElementById('close-build-modal'),
    
    // Info Modal
    infoBtn: document.getElementById('info-btn'),
    infoModal: document.getElementById('info-modal'),
    closeInfo: document.getElementById('close-info-modal'),

    leaderboard: document.getElementById('leaderboard-list')
};

// --- Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        initGrid();
        subscribeToGrid(); // Real-time updates
        
        // Setup Modal Close
        els.closeBuild.onclick = () => els.buildModal.style.display = "none";
        // Info Modal Events
        if(els.infoBtn) els.infoBtn.onclick = () => els.infoModal.style.display = "flex";
        if(els.closeInfo) els.closeInfo.onclick = () => els.infoModal.style.display = "none";

        window.onclick = (e) => {
            if (e.target == els.buildModal) els.buildModal.style.display = "none";
            if (e.target == els.infoModal) els.infoModal.style.display = "none";
        };
    } else {
        window.location.href = "index.html";
    }
});

async function loadUserData() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (docSnap.exists()) {
        userData = docSnap.data();
        if (userData.role === 'guest') {
            alert("Your account is pending approval. Please contact your teacher.");
            window.location.href = "index.html";
            return;
        }
        updateStatsUI();
    }
}

function updateStatsUI() {
    if (!userData) return;
    els.userCash.textContent = `$${(userData.balance || 0).toLocaleString()}`;
    
    // Calculate Income & XP from owned plots
    let totalIncome = 0;
    let totalXp = 1.0;

    // We need to iterate our owned plots from the global state (once loaded)
    // For now, just use what's in userData if we stored it there, but better to calculate from grid state
    // to ensure sync. We'll update this inside renderGrid() or when allPlots updates.
}

// --- Grid System ---
function initGrid() {
    els.grid.innerHTML = '';
    
    // Create Hex Rows
    for (let r = 0; r < GRID_SIZE; r++) {
        const row = document.createElement('div');
        row.className = 'hex-row';
        
        for (let q = 0; q < GRID_SIZE; q++) {
            // Offset coordinates logic can be complex, let's stick to simple x,y grid for storage
            // but render as staggered rows.
            const hex = document.createElement('div');
            hex.className = 'hex';
            hex.dataset.x = q;
            hex.dataset.y = r;
            hex.onclick = () => selectPlot(q, r);
            
            // Inner content
            const content = document.createElement('div');
            content.className = 'hex-content';
            hex.appendChild(content);
            
            row.appendChild(hex);
        }
        els.grid.appendChild(row);
    }
    
    // Enable Pan/Zoom (Basic Dragging)
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;

    els.viewport.addEventListener('mousedown', (e) => {
        isDown = true;
        els.viewport.classList.add('active');
        startX = e.pageX - els.viewport.offsetLeft;
        startY = e.pageY - els.viewport.offsetTop;
        scrollLeft = els.viewport.scrollLeft;
        scrollTop = els.viewport.scrollTop;
    });
    els.viewport.addEventListener('mouseleave', () => { isDown = false; });
    els.viewport.addEventListener('mouseup', () => { isDown = false; });
    els.viewport.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - els.viewport.offsetLeft;
        const y = e.pageY - els.viewport.offsetTop;
        const walkX = (x - startX) * 1.5; // Scroll speed
        const walkY = (y - startY) * 1.5;
        els.viewport.scrollLeft = scrollLeft - walkX;
        els.viewport.scrollTop = scrollTop - walkY;
    });
    
    // Center the view initially
    setTimeout(() => {
        els.viewport.scrollLeft = (els.grid.offsetWidth - els.viewport.offsetWidth) / 2;
        els.viewport.scrollTop = (els.grid.offsetHeight - els.viewport.offsetHeight) / 2;
    }, 100);
}

// --- Real-time Data ---
function subscribeToGrid() {
    const q = collection(db, "land_plots");
    onSnapshot(q, (snapshot) => {
        allPlots = {};
        let ownedPlotsCount = 0;
        let myIncome = 0;
        let myXp = 1.0;
        let myPlotsCount = 0;
        let myBuildings = [];
        let myValue = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            allPlots[doc.id] = data;
            ownedPlotsCount++;
            
            if (data.ownerId === currentUser.uid) {
                myPlotsCount++;
                myValue += 500; // Base land value approximation

                if (data.buildingId) {
                    myBuildings.push(data.buildingId);
                    const b = BUILDINGS[data.buildingId];
                    if (b) {
                        myValue += b.cost;
                        if (b.type === 'commercial') myIncome += b.income;
                        if (b.type === 'residential') myXp += b.xpMult;
                    }
                }
            }
        });
        
        // Update Global Stats
        els.userIncome.textContent = `+$${myIncome.toLocaleString()}`;
        els.userXp.textContent = `${myXp.toFixed(2)}x`;
        
        // Sync Stats to User Profile (for other pages to use)
        if (userData) {
            // Only update if changed significantly to avoid write loops
            const currentMult = userData.xpMultiplier || 1.0;
            const currentInc = userData.dailyIncome || 0;
            const currentStats = userData.realEstateStats || { plotsCount: 0, totalValue: 0 };
            
            if (Math.abs(currentMult - myXp) > 0.01 || 
                currentInc !== myIncome || 
                currentStats.plotsCount !== myPlotsCount ||
                currentStats.totalValue !== myValue) {
                
                updateDoc(doc(db, "users", currentUser.uid), {
                    xpMultiplier: Number(myXp.toFixed(2)),
                    dailyIncome: myIncome,
                    realEstateStats: {
                        plotsCount: myPlotsCount,
                        buildings: myBuildings,
                        totalValue: myValue
                    }
                }).then(() => {
                    console.log("Stats synced to profile");
                    userData.xpMultiplier = Number(myXp.toFixed(2));
                    userData.dailyIncome = myIncome;
                    userData.realEstateStats = {
                        plotsCount: myPlotsCount,
                        buildings: myBuildings,
                        totalValue: myValue
                    };
                }).catch(e => console.error("Sync failed", e));
            }
        }

        // Update Grid Visuals
        renderGridData();
        
        // Update Leaderboard
        updateLeaderboard(snapshot);
        
        // Refresh selected view if open
        if (selectedHex) {
            selectPlot(selectedHex.x, selectedHex.y);
        }
    });
}

function renderGridData() {
    document.querySelectorAll('.hex').forEach(hex => {
        const x = hex.dataset.x;
        const y = hex.dataset.y;
        const key = `${x}_${y}`;
        const plot = allPlots[key];
        const content = hex.querySelector('.hex-content');
        
        // Reset classes
        hex.className = 'hex';
        content.innerHTML = '';
        
        if (plot) {
            // Owned
            if (plot.ownerId === currentUser.uid) {
                hex.classList.add('owned-by-me');
            } else {
                hex.classList.add('owned-by-others');
            }
            
            // Show Building Icon
            if (plot.buildingId) {
                const b = BUILDINGS[plot.buildingId];
                if (b) {
                    content.innerHTML = `<span class="hex-icon">${b.icon}</span>`;
                }
            } else {
                // Just land
                content.innerHTML = `<span class="hex-icon">🚩</span>`;
            }
        } else {
            // For Sale
            hex.classList.add('for-sale');
            // content.innerHTML = `<span style="font-size:0.8rem; opacity:0.3;">$</span>`;
        }
    });
}

function updateLeaderboard(snapshot) {
    const owners = {};
    snapshot.forEach(doc => {
        const d = doc.data();
        if (!owners[d.ownerId]) owners[d.ownerId] = { name: d.ownerName, count: 0, value: 0 };
        owners[d.ownerId].count++;
        // Simple value calc: Land Price + Building Cost
        let val = LAND_BASE_PRICE; // Simplified, doesn't account for dynamic price paid
        if (d.buildingId && BUILDINGS[d.buildingId]) val += BUILDINGS[d.buildingId].cost;
        owners[d.ownerId].value += val;
    });
    
    const sorted = Object.values(owners).sort((a, b) => b.value - a.value).slice(0, 5);
    
    els.leaderboard.innerHTML = sorted.map((p, i) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.9rem;">
            <span>${i+1}. ${p.name}</span>
            <span style="color:#4ade80">$${p.value.toLocaleString()}</span>
        </div>
    `).join('');
}

// --- Interaction ---
function selectPlot(x, y) {
    selectedHex = { x, y };
    const key = `${x}_${y}`;
    const plot = allPlots[key];
    
    els.plotCard.style.display = 'block';
    els.plotCoords.textContent = `${x}, ${y}`;
    els.plotActions.innerHTML = ''; // Clear buttons
    
    if (plot) {
        // Owned Plot
        els.plotOwner.textContent = plot.ownerName;
        
        let buildingName = "Empty Lot";
        if (plot.buildingId && BUILDINGS[plot.buildingId]) {
            buildingName = BUILDINGS[plot.buildingId].name;
        }
        els.plotBuilding.textContent = buildingName;
        
        if (plot.ownerId === currentUser.uid) {
            // My Plot
            const buildBtn = document.createElement('button');
            buildBtn.className = 'action-btn btn-build';
            buildBtn.textContent = plot.buildingId ? "Replace Building" : "Construct Building";
            buildBtn.onclick = () => openBuildMenu(key);
            els.plotActions.appendChild(buildBtn);
        } else {
            // Someone else's plot
            if (plot.buildingId) {
                const b = BUILDINGS[plot.buildingId];
                if (b.type === 'commercial') {
                    const visitBtn = document.createElement('button');
                    visitBtn.className = 'action-btn btn-visit';
                    visitBtn.textContent = `Visit ${b.name} ($${b.visitFee})`;
                    visitBtn.onclick = () => visitPlot(plot, b);
                    els.plotActions.appendChild(visitBtn);
                } else {
                    els.plotActions.innerHTML = `<p style="color:#888; text-align:center;">Private Residence</p>`;
                }
            } else {
                els.plotActions.innerHTML = `<p style="color:#888; text-align:center;">Undeveloped Land</p>`;
            }
        }
        
    } else {
        // Unclaimed Plot
        els.plotOwner.textContent = "Unclaimed Land";
        els.plotBuilding.textContent = "Wilderness";
        
        // Calculate Dynamic Price
        const totalSold = Object.keys(allPlots).length;
        const currentPrice = LAND_BASE_PRICE + (totalSold * PRICE_INCREMENT);
        
        const buyBtn = document.createElement('button');
        buyBtn.className = 'action-btn btn-buy';
        buyBtn.textContent = `Buy Land ($${currentPrice.toLocaleString()})`;
        buyBtn.onclick = () => buyLand(x, y, currentPrice);
        els.plotActions.appendChild(buyBtn);
    }
}

// --- Actions ---
async function buyLand(x, y, price) {
    if (userData.balance < price) {
        alert("Insufficient funds!");
        return;
    }
    
    if (!confirm(`Purchase plot at ${x},${y} for $${price}?`)) return;
    
    const key = `${x}_${y}`;
    const plotRef = doc(db, "land_plots", key);
    const userRef = doc(db, "users", currentUser.uid);
    
    try {
        await runTransaction(db, async (transaction) => {
            const pDoc = await transaction.get(plotRef);
            if (pDoc.exists()) throw "Plot already taken!";
            
            const uDoc = await transaction.get(userRef);
            if (uDoc.data().balance < price) throw "Insufficient funds!";
            
            transaction.update(userRef, { 
                balance: increment(-price) 
            });
            
            transaction.set(plotRef, {
                ownerId: currentUser.uid,
                ownerName: userData.nickname || "Anonymous",
                purchasedAt: new Date().toISOString(),
                pricePaid: price,
                x: x,
                y: y
            });
        });
        
        // Local update will happen via snapshot listener
        alert("Land purchased! Time to build.");
        
    } catch (e) {
        console.error(e);
        alert("Transaction failed: " + e);
    }
}

function openBuildMenu(plotKey) {
    els.buildModal.style.display = 'block';
    els.buildOptions.innerHTML = '';
    
    Object.entries(BUILDINGS).forEach(([id, b]) => {
        const div = document.createElement('div');
        div.className = 'building-option';
        div.innerHTML = `
            <span class="building-icon">${b.icon}</span>
            <div class="building-details">
                <h4>${b.name}</h4>
                <p>${b.desc}</p>
                <p style="font-size:0.75rem; color:${b.type === 'commercial' ? '#4ade80' : '#bc13fe'}">
                    ${b.type === 'commercial' ? `Income: $${b.income}/day` : `XP: +${(b.xpMult*100).toFixed(0)}%`}
                </p>
            </div>
            <span class="building-cost">$${b.cost.toLocaleString()}</span>
        `;
        div.onclick = () => buildStructure(plotKey, id, b.cost);
        els.buildOptions.appendChild(div);
    });
}

async function buildStructure(plotKey, buildingId, cost) {
    if (userData.balance < cost) {
        alert("Too expensive!");
        return;
    }
    
    if (!confirm(`Construct this building for $${cost}?`)) return;
    
    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", currentUser.uid);
            const plotRef = doc(db, "land_plots", plotKey);
            
            const uDoc = await transaction.get(userRef);
            if (uDoc.data().balance < cost) throw "Insufficient funds!";
            
            transaction.update(userRef, { balance: increment(-cost) });
            transaction.update(plotRef, { buildingId: buildingId });
        });
        
        els.buildModal.style.display = 'none';
        
    } catch (e) {
        alert("Build failed: " + e);
    }
}

async function visitPlot(plot, building) {
    if (userData.balance < building.visitFee) {
        alert("You can't afford the entry fee!");
        return;
    }
    
    try {
        await runTransaction(db, async (transaction) => {
            const visitorRef = doc(db, "users", currentUser.uid);
            const ownerRef = doc(db, "users", plot.ownerId);
            
            const vDoc = await transaction.get(visitorRef);
            if (vDoc.data().balance < building.visitFee) throw "Insufficient funds!";
            
            // Transfer money
            transaction.update(visitorRef, { balance: increment(-building.visitFee) });
            transaction.update(ownerRef, { balance: increment(building.visitFee) });
        });
        
        alert(`You visited ${plot.ownerName}'s ${building.name}!`);
        // Here we could add a temporary buff effect
        
    } catch (e) {
        alert("Visit failed: " + e);
    }
}
