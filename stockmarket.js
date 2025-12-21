import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, onSnapshot, setDoc, collection, getDocs, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { generateLoot } from "./game_data.js";

// Configuration
const FINNHUB_API_KEY = "d52obe9r01qggm5t0gp0d52obe9r01qggm5t0gpg";
const STOCK_SYMBOLS = [
  "AAPL", "MSFT", "AMZN", "GOOG", "GOOGL", "META", "TSLA", "NVDA", "BRK.B", "JPM",
  "JNJ", "V", "UNH", "XOM", "HD", "PG", "MA", "LLY", "CVX", "ABBV",
  "MRK", "PEP", "KO", "BAC", "AVGO", "COST", "TMO", "MCD", "CSCO", "ACN",
  "ABT", "DHR", "LIN", "DIS", "NKE", "ADBE", "TXN", "VZ", "NEE", "PM",
  "CRM", "WFC", "UPS", "BMY", "RTX", "MS", "HON", "QCOM", "COP", "IBM",
  "UNP", "LOW", "INTC", "SPGI", "CAT", "GS", "AMGN", "GE", "DE", "PLD",
  "LMT", "BLK", "AXP", "SYK", "MDLZ", "CVS", "AMT", "GILD", "T", "ISRG",
  "BKNG", "ADI", "ADP", "TJX", "MMC", "VRTX", "C", "REGN", "PFE",
  "NOW", "ZTS", "SCHW", "LRCX", "CB", "MO", "CI", "BSX", "DUK", "SO",
  "SLB", "EOG", "BDX", "ITW", "CME", "CL", "APD", "MU", "USB", "PGR"
];

// DOM Elements
const stockListEl = document.getElementById("stock-list");
const portfolioListEl = document.getElementById("portfolio-list");
const userBalanceEl = document.getElementById("user-balance");
const portfolioValueEl = document.getElementById("portfolio-value");
const netWorthEl = document.getElementById("net-worth");
const modal = document.getElementById("trade-modal");
const closeModalBtn = document.querySelector(".close-modal");
const confirmTradeBtn = document.getElementById("confirm-trade-btn");
const shareInput = document.getElementById("share-input");
const tradeTotalEl = document.getElementById("trade-total");
const refreshBtn = document.getElementById("refresh-market-btn");
const autoRefreshToggle = document.getElementById("auto-refresh-toggle");
const adminControls = document.getElementById("admin-controls");
const lastUpdatedEl = document.getElementById("last-updated");

let currentUser = null;
let userData = null;
let marketData = []; // Stores current stock data
let selectedStock = null;
let tradeType = "buy";
let autoRefreshInterval = null;
let currentBatchIndex = 0;
const BATCH_SIZE = 50;
const REFRESH_RATE_MS = 120000; // 2 minutes

// Initialize
function init() {
    setupEventListeners();

    // Restore Auto-Refresh State
    const savedAutoRefresh = localStorage.getItem('marketAutoRefresh') === 'true';
    if (savedAutoRefresh && autoRefreshToggle) {
        autoRefreshToggle.checked = true;
        toggleAutoRefresh(true);
    }
}

// Auth & Data Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // 1. Check User Role for Admin Button
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            adminControls.style.display = "flex";
        }

        // 2. Listen for User Data (Balance/Portfolio)
        onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                userData = doc.data();
                if (userData.balance === undefined) userData.balance = 1000;
                if (!userData.portfolio) userData.portfolio = {};
                updateDashboard();
            }
        });

        // 3. Listen for Market Data (Stocks)
        const marketRef = doc(db, "system", "market");
        onSnapshot(marketRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                marketData = data.stocks || [];
                renderStockList();
                updateDashboard(); // Re-calc portfolio value with new prices
                
                if (data.lastUpdated) {
                    const date = new Date(data.lastUpdated.seconds * 1000);
                    lastUpdatedEl.textContent = `Last Updated: ${date.toLocaleString()}`;
                }
            } else {
                stockListEl.innerHTML = '<div style="padding:1rem; text-align:center;">Market data not initialized.</div>';
            }
        });

    } else {
        window.location.href = "index.html";
    }
});

// Render Market List
function renderStockList() {
    stockListEl.innerHTML = "";
    
    if (marketData.length === 0) {
        stockListEl.innerHTML = '<div class="loading-spinner">No market data available.</div>';
        return;
    }

    marketData.forEach(stock => {
        const changeClass = stock.change >= 0 ? "price-up" : "price-down";
        const changeSign = stock.change >= 0 ? "+" : "";
        
        const item = document.createElement("div");
        item.className = "stock-item";
        item.innerHTML = `
            <div>
                <span class="stock-symbol">${stock.symbol}</span>
                <span class="stock-name">${stock.name}</span>
            </div>
            <div>$${stock.price.toFixed(2)}</div>
            <div class="${changeClass}">${changeSign}${stock.change.toFixed(2)}%</div>
            <div>
                <button class="btn-sm btn-primary trade-btn" data-symbol="${stock.symbol}">Trade</button>
            </div>
        `;
        stockListEl.appendChild(item);
    });

    // Add click listeners
    document.querySelectorAll(".trade-btn").forEach(btn => {
        btn.addEventListener("click", (e) => openTradeModal(e.target.dataset.symbol));
    });
}

// Update Dashboard UI
function updateDashboard() {
    if (!userData || marketData.length === 0) return;

    // 1. Update Balance
    userBalanceEl.textContent = formatCurrency(userData.balance);

    // 2. Calculate Portfolio Value
    let totalPortfolioValue = 0;
    portfolioListEl.innerHTML = "";
    
    const portfolioItems = Object.entries(userData.portfolio);
    
    if (portfolioItems.length === 0) {
        document.getElementById("empty-portfolio-msg").style.display = "block";
    } else {
        document.getElementById("empty-portfolio-msg").style.display = "none";
        
        portfolioItems.forEach(([symbol, shares]) => {
            const stock = marketData.find(s => s.symbol === symbol);
            // If stock not in current market list, we might need to handle gracefully
            // For now, assume it exists or skip
            if (stock && shares > 0) {
                const currentValue = stock.price * shares;
                totalPortfolioValue += currentValue;
                
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${symbol}</td>
                    <td>${shares}</td>
                    <td>$${stock.price.toFixed(2)}</td>
                    <td>${formatCurrency(currentValue)}</td>
                    <td class="${stock.change >= 0 ? 'price-up' : 'price-down'}">${stock.change >= 0 ? '+' : ''}${stock.change}%</td> 
                    <td><button class="btn-sm btn-secondary sell-btn" data-symbol="${symbol}">Sell</button></td>
                `;
                portfolioListEl.appendChild(row);
            }
        });
        
        document.querySelectorAll(".sell-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                openTradeModal(e.target.dataset.symbol);
                document.querySelector('[data-type="sell"]').click();
            });
        });
    }

    portfolioValueEl.textContent = formatCurrency(totalPortfolioValue);
    const currentNetWorth = userData.balance + totalPortfolioValue;
    netWorthEl.textContent = formatCurrency(currentNetWorth);

    // Update Net Worth in Firestore (Debounced or just fire-and-forget)
    if (currentUser) {
        updateDoc(doc(db, "users", currentUser.uid), {
            netWorth: currentNetWorth
        }).catch(err => console.error("Error updating net worth:", err));
    }
}

// --- Finnhub Integration (Admin Only) ---
async function refreshMarketData(isAuto = false) {
    if (!isAuto) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "Updating...";
    }
    
    try {
        // Determine Batch
        // Load index from storage to persist across reloads
        currentBatchIndex = parseInt(localStorage.getItem('marketBatchIndex') || '0');
        
        const start = currentBatchIndex * BATCH_SIZE;
        const end = start + BATCH_SIZE;
        const batchSymbols = STOCK_SYMBOLS.slice(start, end);
        
        console.log(`Fetching batch ${currentBatchIndex + 1}: ${batchSymbols.length} stocks`);

        const promises = batchSymbols.map(async (symbol) => {
            try {
                const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
                const data = await response.json();
                
                // Finnhub returns: c (current), d (change), dp (percent change), etc.
                return {
                    symbol: symbol,
                    name: symbol, // Using symbol as name for now to save API calls
                    price: data.c,
                    change: data.dp, // Percent change
                    lastUpdated: new Date()
                };
            } catch (err) {
                console.error(`Failed to fetch ${symbol}`, err);
                return null;
            }
        });

        const results = (await Promise.all(promises)).filter(s => s !== null);
        
        // Merge with existing data
        // Ensure we have the latest data before merging to avoid overwriting with zeros
        if (marketData.length === 0) {
             const marketDoc = await getDoc(doc(db, "system", "market"));
             if (marketDoc.exists()) {
                 marketData = marketDoc.data().stocks || [];
             }
        }

        let updatedStocks = [...marketData];
        
        // If marketData is STILL empty (very first run ever), initialize it with placeholders
        if (updatedStocks.length === 0) {
             updatedStocks = STOCK_SYMBOLS.map(s => ({ symbol: s, name: s, price: 0, change: 0 }));
        }

        // Update the specific stocks in the array
        results.forEach(newStock => {
            const index = updatedStocks.findIndex(s => s.symbol === newStock.symbol);
            if (index !== -1) {
                updatedStocks[index] = newStock;
            } else {
                updatedStocks.push(newStock);
            }
        });

        // Save to Firestore
        const marketRef = doc(db, "system", "market");
        await setDoc(marketRef, {
            stocks: updatedStocks,
            lastUpdated: new Date()
        });

        if (!isAuto) alert("Market data updated successfully!");
        
        // Prepare next batch index
        currentBatchIndex++;
        if (currentBatchIndex * BATCH_SIZE >= STOCK_SYMBOLS.length) {
            currentBatchIndex = 0;
        }
        localStorage.setItem('marketBatchIndex', currentBatchIndex);

    } catch (error) {
        console.error("Error fetching market data:", error);
        if (!isAuto) alert("Failed to update market data. Check console.");
    } finally {
        if (!isAuto) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = "Manual Refresh";
        }
    }
}

function toggleAutoRefresh(enabled) {
    localStorage.setItem('marketAutoRefresh', enabled);
    if (enabled) {
        // Run immediately then interval
        refreshMarketData(true);
        autoRefreshInterval = setInterval(() => refreshMarketData(true), REFRESH_RATE_MS);
        console.log("Auto-Refresh Started");
    } else {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log("Auto-Refresh Stopped");
    }
}


const TRADING_FEE = 2.00;

// Trade Modal Logic
function openTradeModal(symbol) {
    selectedStock = marketData.find(s => s.symbol === symbol);
    if (!selectedStock) return;

    document.getElementById("modal-stock-symbol").textContent = selectedStock.symbol;
    document.getElementById("modal-stock-name").textContent = selectedStock.name;
    document.getElementById("modal-current-price").textContent = formatCurrency(selectedStock.price);
    document.getElementById("modal-user-cash").textContent = formatCurrency(userData.balance);
    
    document.querySelector('[data-type="buy"]').click();
    shareInput.value = 1;
    updateTradeTotal();
    
    modal.style.display = "flex";
}

function updateTradeTotal() {
    if (!selectedStock) return;
    const shares = parseInt(shareInput.value) || 0;
    const subtotal = shares * selectedStock.price;
    const total = subtotal + TRADING_FEE;
    
    document.getElementById("trade-subtotal").textContent = formatCurrency(subtotal);
    document.getElementById("trade-fee").textContent = formatCurrency(TRADING_FEE);
    tradeTotalEl.textContent = formatCurrency(total);
}

// Execute Trade
async function executeTrade() {
    if (!currentUser || !selectedStock) return;
    
    const shares = parseInt(shareInput.value);
    if (shares <= 0) {
        alert("Please enter a valid number of shares.");
        return;
    }

    const subtotal = shares * selectedStock.price;
    const totalCost = subtotal + TRADING_FEE;
    const userRef = doc(db, "users", currentUser.uid);

    try {
        if (tradeType === "buy") {
            if (userData.balance < totalCost) {
                alert("Insufficient funds!");
                return;
            }

            const newBalance = userData.balance - totalCost;
            const currentShares = userData.portfolio[selectedStock.symbol] || 0;
            const newPortfolio = { ...userData.portfolio, [selectedStock.symbol]: currentShares + shares };

            await updateDoc(userRef, {
                balance: newBalance,
                portfolio: newPortfolio
            });
            
            // Record Transaction
            await recordTransaction(tradeType, selectedStock.symbol, shares, selectedStock.price, totalCost);

            alert(`Successfully bought ${shares} shares of ${selectedStock.symbol} for ${formatCurrency(totalCost)} (incl. $2.00 fee)`);

        } else { // Sell
            const currentShares = userData.portfolio[selectedStock.symbol] || 0;
            if (currentShares < shares) {
                alert("You don't have enough shares to sell!");
                return;
            }

            // For selling, we deduct the fee from the proceeds
            const proceeds = subtotal - TRADING_FEE;
            const newBalance = userData.balance + proceeds;
            const newShares = currentShares - shares;
            const newPortfolio = { ...userData.portfolio };
            
            if (newShares > 0) {
                newPortfolio[selectedStock.symbol] = newShares;
            } else {
                delete newPortfolio[selectedStock.symbol];
            }

            await updateDoc(userRef, {
                balance: newBalance,
                portfolio: newPortfolio
            });
            
            // Record Transaction
            await recordTransaction(tradeType, selectedStock.symbol, shares, selectedStock.price, proceeds);
            
            alert(`Successfully sold ${shares} shares of ${selectedStock.symbol} for ${formatCurrency(proceeds)} (after $2.00 fee)`);
        }

        // --- Loot Drop Logic ---
        // 5% chance to find an item when trading
        if (Math.random() < 0.05) {
            const loot = generateLoot();
            if (loot) {
                await updateDoc(userRef, {
                    inventory: arrayUnion(loot)
                });
                // Small delay so the first alert doesn't block this one immediately (or just show it)
                alert(`🎁 SURPRISE! You found a hidden item: ${loot.name} (${loot.rarity.toUpperCase()})!`);
            }
        }
        
        modal.style.display = "none";

    } catch (error) {
        console.error("Trade failed:", error);
        alert("Trade failed: " + error.message);
    }
}

async function recordTransaction(type, symbol, shares, price, total) {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    
    // Get current transactions or init empty
    const currentTransactions = userData.transactions || [];
    
    const newTransaction = {
        date: new Date().toISOString(),
        type: type,
        symbol: symbol,
        shares: shares,
        price: price,
        total: total
    };
    
    await updateDoc(userRef, {
        transactions: [newTransaction, ...currentTransactions]
    });
}

// Event Listeners
function setupEventListeners() {
    closeModalBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };

    document.querySelectorAll(".trade-type-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".trade-type-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            tradeType = e.target.dataset.type;
            confirmTradeBtn.textContent = `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`;
            confirmTradeBtn.className = `btn btn-block ${tradeType === 'buy' ? 'btn-primary' : 'btn-secondary'}`;
        });
    });

    shareInput.addEventListener("input", updateTradeTotal);
    confirmTradeBtn.addEventListener("click", executeTrade);
    refreshBtn.addEventListener("click", () => refreshMarketData(false));
    
    if (autoRefreshToggle) {
        autoRefreshToggle.addEventListener("change", (e) => toggleAutoRefresh(e.target.checked));
    }

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            e.target.classList.add("active");
            document.getElementById(`${e.target.dataset.tab}-tab`).classList.add("active");
        });
    });

    // Sidebar Navigation
    document.querySelectorAll(".sidebar-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetBtn = e.currentTarget; // Use currentTarget to get the button element
            const viewId = targetBtn.dataset.view;

            // Update Active State
            document.querySelectorAll(".sidebar-btn").forEach(b => b.classList.remove("active"));
            targetBtn.classList.add("active");

            // Show Target View
            document.querySelectorAll(".market-view-content").forEach(v => v.style.display = "none");
            document.getElementById(`${viewId}-view`).style.display = "block";

            // Load Data if needed
            if (viewId === "leaders") loadLeaderboard();
            if (viewId === "stats") loadUserStatistics();
        });
    });
}

let performanceChart = null;

function loadUserStatistics() {
    // 1. Render Transaction History
    const historyBody = document.getElementById("transaction-history-list");
    const noTransMsg = document.getElementById("no-transactions-msg");
    const transactions = userData.transactions || [];

    if (transactions.length === 0) {
        historyBody.innerHTML = "";
        noTransMsg.style.display = "block";
    } else {
        noTransMsg.style.display = "none";
        historyBody.innerHTML = transactions.map(t => `
            <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td style="color: ${t.type === 'buy' ? 'green' : 'red'}; font-weight:bold;">${t.type.toUpperCase()}</td>
                <td>${t.symbol}</td>
                <td>${t.shares}</td>
                <td>${formatCurrency(t.price)}</td>
                <td>${formatCurrency(t.total)}</td>
            </tr>
        `).join('');
    }

    // 2. Render Performance Chart
    renderPerformanceChart(transactions);
}

function renderPerformanceChart(transactions) {
    const ctx = document.getElementById('performance-chart').getContext('2d');
    
    // Destroy existing chart if any
    if (performanceChart) {
        performanceChart.destroy();
    }

    // Generate Data Points for the Chart
    // Since we don't have historical snapshots, we will reconstruct "Net Worth" history 
    // based on transactions. This is an approximation.
    // Start with current balance + current portfolio value
    
    // For a better graph, we'll just plot the "Cash Balance" history for now as it's easier to reconstruct
    // Or we can just show a mock graph if no data exists.
    
    let dataPoints = [];
    let labels = [];
    
    if (transactions.length > 0) {
        // Reconstruct balance history backwards
        let currentBal = userData.balance;
        // Add "Now" point
        labels.unshift("Now");
        dataPoints.unshift(currentBal);

        transactions.forEach(t => {
            // Reverse the transaction to find previous balance
            if (t.type === 'buy') {
                currentBal += t.total;
            } else {
                currentBal -= t.total;
            }
            labels.unshift(new Date(t.date).toLocaleDateString());
            dataPoints.unshift(currentBal);
        });
    } else {
        // Default / Empty State
        labels = ["Start"];
        dataPoints = [1000]; // Default starting cash
    }

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cash Balance History',
                data: dataPoints,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
}

async function loadLeaderboard() {
    const tbody = document.getElementById("leaderboard-list");
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading Leaderboard...</td></tr>';

    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        let leaders = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            // Calculate Portfolio Value
            let portfolioValue = 0;
            if (data.portfolio) {
                for (const [symbol, shares] of Object.entries(data.portfolio)) {
                    const stock = marketData.find(s => s.symbol === symbol);
                    if (stock) {
                        portfolioValue += shares * stock.price;
                    }
                }
            }
            
            leaders.push({
                name: data.nickname || "Anonymous Trader",
                netWorth: (data.balance || 0) + portfolioValue,
                portfolioSize: Object.keys(data.portfolio || {}).length
            });
        });

        // Sort by Net Worth (High to Low)
        leaders.sort((a, b) => b.netWorth - a.netWorth);

        tbody.innerHTML = leaders.map((leader, index) => `
            <tr>
                <td><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
                <td>${leader.name}</td>
                <td style="font-weight:bold; color:var(--primary-color);">${formatCurrency(leader.netWorth)}</td>
                <td>${leader.portfolioSize} Stocks</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error("Error loading leaderboard:", error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Failed to load leaderboard.</td></tr>';
    }
}

function loadStatistics() {
    if (marketData.length === 0) {
        document.getElementById("stat-most-traded").textContent = "No Data";
        document.getElementById("stat-top-gainer").textContent = "No Data";
        document.getElementById("stat-top-loser").textContent = "No Data";
        return;
    }

    // Top Gainer
    const topGainer = [...marketData].sort((a, b) => b.change - a.change)[0];
    document.getElementById("stat-top-gainer").innerHTML = `
        <span style="color:green">${topGainer.symbol}</span><br>
        <span style="font-size:0.9rem">+${topGainer.change.toFixed(2)}%</span>
    `;

    // Top Loser
    const topLoser = [...marketData].sort((a, b) => a.change - b.change)[0];
    document.getElementById("stat-top-loser").innerHTML = `
        <span style="color:red">${topLoser.symbol}</span><br>
        <span style="font-size:0.9rem">${topLoser.change.toFixed(2)}%</span>
    `;

    // Most Traded (Mock logic for now since we don't track volume yet)
    // We'll just pick a random "Hot" stock or use the one with highest price for now
    const mostExpensive = [...marketData].sort((a, b) => b.price - a.price)[0];
    document.getElementById("stat-most-traded").innerHTML = `
        <span>${mostExpensive.symbol}</span><br>
        <span style="font-size:0.9rem">${formatCurrency(mostExpensive.price)}</span>
    `;
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

init();
