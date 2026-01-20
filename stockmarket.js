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
const REFRESH_RATE_MS = 60000; // 60 seconds (safe for API limits)

const fetchedMissingSymbols = new Set(); // Track which symbols we've already tried to fetch

// Initialize
function init() {
    setupEventListeners();
    
    // Start "Community Maintenance" Loop
    // Every 10 seconds, check if market data is stale.
    // If stale, attempt to become the updater.
    setInterval(checkMarketStaleness, 10000);
}

// Auth & Data Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // 1. Get User Data
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().role === 'guest') {
            alert("Your account is pending approval. Please contact your teacher.");
            window.location.href = "index.html";
            return;
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

// Calculate weighted average cost basis
function calculateAverageCost(symbol, transactions) {
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) return 0;

    // Filter for symbol and sort by date ascending (oldest first)
    const stockTrans = transactions
        .filter(t => t.symbol === symbol)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    let totalShares = 0;
    let totalCost = 0;

    stockTrans.forEach(t => {
        const tShares = Number(t.shares);
        const tTotal = Number(t.total);
        
        if (t.type === 'buy') {
            // Add new lot
            totalShares += tShares;
            totalCost += tTotal; // Total includes fees
        } else if (t.type === 'sell') {
            // Reduce shares, keep average cost same
            // To do this, we reduce totalCost proportional to shares sold
            if (totalShares > 0) {
                const avgCost = totalCost / totalShares;
                totalShares -= tShares;
                totalCost = totalShares * avgCost;
            }
        }
    });

    return totalShares > 0 ? totalCost / totalShares : 0;
}

// Helper to find last price from transaction history
function getLastKnownPrice(symbol, transactions) {
    if (!transactions || !Array.isArray(transactions)) return 0;
    
    // Sort buy/sell transactions descending by date
    const relevant = transactions
        .filter(t => t.symbol === symbol && t.price > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (relevant.length > 0) {
        return relevant[0].price;
    }
    return 0;
}

// Update Dashboard UI
function updateDashboard() {
    if (!userData || !marketData) return;

    // 1. Update Balance
    userBalanceEl.textContent = formatCurrency(userData.balance || 0);

    // 2. Calculate Portfolio Value
    let totalPortfolioValue = 0;
    portfolioListEl.innerHTML = "";
    
    // Ensure portfolio is valid
    const portfolioItems = userData.portfolio ? Object.entries(userData.portfolio) : [];
    
    // Check for missing stocks
    const missingSymbols = [];

    if (portfolioItems.length === 0) {
        document.getElementById("empty-portfolio-msg").style.display = "block";
    } else {
        document.getElementById("empty-portfolio-msg").style.display = "none";
        
        portfolioItems.forEach(([symbol, sharesVal]) => {
            const shares = Number(sharesVal);
            if (shares <= 0) return;

            let stock = marketData.find(s => s.symbol === symbol);
            let isEstimated = false;
            
            if (!stock) {
                missingSymbols.push(symbol);
                // Fallback mechanism: Try to find last known price from transaction history
                const lastPrice = getLastKnownPrice(symbol, userData.transactions);
                if (lastPrice > 0) {
                    stock = { symbol: symbol, price: lastPrice, change: 0 };
                    isEstimated = true;
                }
            }

            // Calculate Cost Basis
            const avgCost = calculateAverageCost(symbol, userData.transactions);
            const totalCost = avgCost * shares;

            let currentValue = 0;
            let gainLossAmt = 0;
            let gainLossPct = 0;
            let glClass = "";
            let glSign = "";

            if (stock) {
                currentValue = stock.price * shares;
                totalPortfolioValue += currentValue;
                
                // Gain/Loss Calculations
                gainLossAmt = currentValue - totalCost;
                gainLossPct = totalCost > 0 ? (gainLossAmt / totalCost) * 100 : 0;
                
                glClass = gainLossAmt >= 0 ? "price-up" : "price-down";
                glSign = gainLossAmt >= 0 ? "+" : "";
            }

            const currentPriceDisplay = stock ? formatCurrency(stock.price) + (isEstimated ? " (Est)" : "") : "Updating...";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${symbol}</td>
                <td>${shares}</td>
                <td>${formatCurrency(avgCost)}</td>
                <td>${currentPriceDisplay}</td>
                <td>${stock ? formatCurrency(currentValue) : "Updating..."}</td>
                <td class="${glClass}">${stock ? (glSign + formatCurrency(Math.abs(gainLossAmt))) : "..."}</td>
                <td class="${glClass}">${stock ? (glSign + gainLossPct.toFixed(2) + "%") : "..."}</td>
                <td><button class="btn-sm btn-secondary sell-btn" data-symbol="${symbol}">Sell</button></td>
            `;
            portfolioListEl.appendChild(row);
        });
        
        document.querySelectorAll(".sell-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                openTradeModal(e.target.dataset.symbol);
                document.querySelector('[data-type="sell"]').click();
            });
        });
    }

    // Trigger fetch for missing symbols if not already fetched
    if (missingSymbols.length > 0) {
        const toFetch = missingSymbols.filter(s => !fetchedMissingSymbols.has(s));
        if (toFetch.length > 0) {
            toFetch.forEach(s => fetchedMissingSymbols.add(s));
            // Only fetch if not using estimated price, OR always fetch to get live? 
            // Better to always fetch to try and get live data.
            fetchSpecificStocks(toFetch);
        }
    }

    portfolioValueEl.textContent = formatCurrency(totalPortfolioValue);
    const currentNetWorth = (userData.balance || 0) + totalPortfolioValue;
    netWorthEl.textContent = formatCurrency(currentNetWorth);

    // Calculate Total All-Time Profit (Net Worth - Start Balance 1000)
    const initialBalance = 1000;
    const totalProfit = currentNetWorth - initialBalance;
    const profitEl = document.getElementById("total-profit");
    if (profitEl) {
        profitEl.textContent = (totalProfit >= 0 ? "+" : "-") + formatCurrency(Math.abs(totalProfit));
        profitEl.className = "stat-value " + (totalProfit >= 0 ? "price-up" : "price-down");
    }

    // Update Net Worth in Firestore (Debounced or just fire-and-forget)
    if (currentUser) {
        updateDoc(doc(db, "users", currentUser.uid), {
            netWorth: currentNetWorth
        }).catch(err => console.error("Error updating net worth:", err));
    }
}

// Fetch specific symbols that are missing from marketData
async function fetchSpecificStocks(symbols) {
    console.log("Fetching missing stocks:", symbols);
    
    // Limit to prevent API abuse (max 10 at a time)
    const symbolsToFetch = symbols.slice(0, 10);
    
    const promises = symbolsToFetch.map(async (symbol) => {
        try {
            const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
            const data = await response.json();
            return {
                symbol: symbol,
                name: symbol, // Fallback name
                price: data.c || 0,
                change: data.dp || 0,
                lastUpdated: new Date()
            };
        } catch (err) {
            console.error(`Failed to fetch missing stock ${symbol}`, err);
            return null;
        }
    });

    const results = (await Promise.all(promises)).filter(s => s !== null && s.price > 0);
    
    if (results.length > 0 && marketData) {
        // Optimistically update local marketData first
        results.forEach(newStock => {
            const index = marketData.findIndex(s => s.symbol === newStock.symbol);
            if (index !== -1) {
                marketData[index] = newStock;
            } else {
                marketData.push(newStock);
            }
        });
        
        // Re-render immediately
        renderStockList();
        updateDashboard();

        // Persist to Firestore (Try to merge into system market)
        try {
            const marketRef = doc(db, "system", "market");
            const marketSnap = await getDoc(marketRef);
            let currentStocks = [];
            if (marketSnap.exists()) {
                currentStocks = marketSnap.data().stocks || [];
            }
            
            // Merge results into currentStocks
            results.forEach(newStock => {
                const index = currentStocks.findIndex(s => s.symbol === newStock.symbol);
                if (index !== -1) {
                    currentStocks[index] = newStock;
                } else {
                    currentStocks.push(newStock);
                }
            });

            await setDoc(marketRef, { stocks: currentStocks }, { merge: true });
            
        } catch (err) {
            console.error("Failed to persist missing stocks:", err);
        }
    }
}

async function checkMarketStaleness() {
    if (!currentUser) return;

    try {
        const marketRef = doc(db, "system", "market");
        const snap = await getDoc(marketRef);
        
        if (!snap.exists()) {
             // Init if needed
             refreshMarketData(true);
             return;
        }

        const data = snap.data();
        const lastUpdated = data.lastUpdated ? data.lastUpdated.toDate() : new Date(0);
        const now = new Date();
        const diffMs = now - lastUpdated;

        // If data is older than Refresh Rate (60s), initiate update protocol
        if (diffMs > REFRESH_RATE_MS) {
            console.log(`Market data stale (${Math.round(diffMs/1000)}s old). Attempting community update...`);
            
            // Random delay (0-10s) to minimize collision between students
            const delay = Math.random() * 10000;
            setTimeout(() => refreshMarketData(true), delay);
        }
    } catch (err) {
        console.error("Staleness check failed:", err);
    }
}

// --- Finnhub Integration (Community Maintenance) ---
async function refreshMarketData(isAuto = false) {
    if (!isAuto && refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "Updating...";
    }
    
    try {
        const marketRef = doc(db, "system", "market");
        
        // 1. Double-Check Staleness & Lock (Simple check)
        const marketSnap = await getDoc(marketRef);
        let currentStocks = [];
        let nextBatch = 0;
        
        if (marketSnap.exists()) {
            const data = marketSnap.data();
            currentStocks = data.stocks || [];
            nextBatch = data.nextBatchIndex || 0;
            
            // If someone updated it while we were waiting in the random delay
            if (data.lastUpdated) {
                 const justNow = new Date();
                 if ((justNow - data.lastUpdated.toDate()) < REFRESH_RATE_MS) {
                     console.log("Update aborted: Data was refreshed by another user.");
                     return;
                 }
            }
        }

        // 2. Fetch Batch
        currentBatchIndex = nextBatch;
        const start = currentBatchIndex * BATCH_SIZE;
        const end = start + BATCH_SIZE;
        const batchSymbols = STOCK_SYMBOLS.slice(start, end);
        
        console.log(`Fetching batch ${currentBatchIndex + 1}: ${batchSymbols.length} stocks`);

        const promises = batchSymbols.map(async (symbol) => {
            try {
                const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
                const data = await response.json();
                
                return {
                    symbol: symbol,
                    name: symbol, 
                    price: data.c,
                    change: data.dp, 
                    lastUpdated: new Date()
                };
            } catch (err) {
                console.error(`Failed to fetch ${symbol}`, err);
                return null;
            }
        });

        const results = (await Promise.all(promises)).filter(s => s !== null);
        
        // 3. Merge Data
        let updatedStocks = [...currentStocks];
        
        if (updatedStocks.length === 0) {
             updatedStocks = STOCK_SYMBOLS.map(s => ({ symbol: s, name: s, price: 0, change: 0 }));
        }

        results.forEach(newStock => {
            const index = updatedStocks.findIndex(s => s.symbol === newStock.symbol);
            if (index !== -1) {
                updatedStocks[index] = newStock;
            } else {
                updatedStocks.push(newStock);
            }
        });

        // 4. Calculate Next Batch Index
        let newNextBatch = currentBatchIndex + 1;
        if (newNextBatch * BATCH_SIZE >= STOCK_SYMBOLS.length) {
            newNextBatch = 0;
        }

        // 5. Save to Firestore (Atomic Update for everyone)
        await setDoc(marketRef, {
            stocks: updatedStocks,
            lastUpdated: new Date(),
            nextBatchIndex: newNextBatch
        });

        if (!isAuto) alert("Market data updated successfully!");

    } catch (error) {
        console.error("Error fetching market data:", error);
        if (!isAuto) alert("Failed to update market data. Check console.");
    } finally {
        if (!isAuto && refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = "Manual Refresh";
        }
    }
}

function toggleAutoRefresh(enabled) {
   // Deprecated: Logic moved to "Community Maintenance"
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
    
    // Reset button state
    confirmTradeBtn.disabled = false;
    
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
    
    // Disable button to prevent double-clicks
    confirmTradeBtn.disabled = true;
    confirmTradeBtn.textContent = "Verifying Price...";

    const shares = parseInt(shareInput.value);
    if (shares <= 0 || isNaN(shares)) {
        alert("Please enter a valid number of shares.");
        confirmTradeBtn.disabled = false;
        confirmTradeBtn.textContent = `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`;
        return;
    }

    // 1. Fetch Authoritative Price from Firestore (instead of API)
    try {
        const marketRef = doc(db, "system", "market");
        const marketSnap = await getDoc(marketRef);
        
        if (marketSnap.exists()) {
            const systemStocks = marketSnap.data().stocks || [];
            const freshStockData = systemStocks.find(s => s.symbol === selectedStock.symbol);
            
            if (freshStockData) {
                // Update local selected stock with authoritative data
                selectedStock.price = freshStockData.price;
                selectedStock.change = freshStockData.change;
                
                // Update local marketData array to stay in sync
                const stockIndex = marketData.findIndex(s => s.symbol === selectedStock.symbol);
                if (stockIndex !== -1) {
                    marketData[stockIndex] = freshStockData;
                }
            } else {
                console.warn("Stock not found in system record, using local cached price.");
            }
        }
    } catch (err) {
        console.error("Error fetching system price, using cached:", err);
        // Continue with cached price if fetch fails
    }

    const subtotal = shares * selectedStock.price;
    const totalCost = subtotal + TRADING_FEE;
    const userRef = doc(db, "users", currentUser.uid);

    try {
        if (tradeType === "buy") {
            if (userData.balance < totalCost) {
                alert(`Insufficient funds! Price is now $${selectedStock.price.toFixed(2)}.`);
                confirmTradeBtn.disabled = false;
                confirmTradeBtn.textContent = `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`;
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

            alert(`Successfully bought ${shares} shares of ${selectedStock.symbol} at $${selectedStock.price.toFixed(2)} for total ${formatCurrency(totalCost)}`);

        } else { // Sell
            const currentShares = userData.portfolio[selectedStock.symbol] || 0;
            if (currentShares < shares) {
                alert("You don't have enough shares to sell!");
                confirmTradeBtn.disabled = false;
                confirmTradeBtn.textContent = `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`;
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
            
            alert(`Successfully sold ${shares} shares of ${selectedStock.symbol} at $${selectedStock.price.toFixed(2)} for ${formatCurrency(proceeds)}`);
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
        confirmTradeBtn.disabled = false;
        confirmTradeBtn.textContent = `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`;
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
    if (refreshBtn) refreshBtn.addEventListener("click", () => refreshMarketData(false));
    
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

    const chartSelector = document.getElementById("chart-view-selector");
    if (chartSelector) {
        chartSelector.addEventListener("change", (e) => {
            if (userData) {
                 const transactions = userData.transactions || [];
                 renderPerformanceChart(transactions, e.target.value);
            }
        });
    }
}

let performanceChart = null;

function calculatePerformance(data) {
    const transactions = data.transactions || [];
    const portfolio = data.portfolio || {};

    let totalInvested = 0; // Cash Outflow (Buys + Fees)
    let totalReturned = 0; // Cash Inflow (Sells)

    transactions.forEach(t => {
        // Assuming t.total is always positive cost/proceeds
        if (t.type === 'buy') {
            totalInvested += t.total;
        } else if (t.type === 'sell') {
            totalReturned += t.total;
        }
    });

    // Current Portfolio Value
    let currentPortfolioValue = 0;
    Object.entries(portfolio).forEach(([symbol, shares]) => {
        const stock = marketData.find(s => s.symbol === symbol);
        if (stock) {
            currentPortfolioValue += stock.price * shares;
        }
    });

    const totalEquity = totalReturned + currentPortfolioValue;
    const netProfit = totalEquity - totalInvested;
    
    // ROI %
    // If user never invested, ROI is 0.
    const roi = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;

    return {
        invested: totalInvested,
        returned: totalReturned,
        currentValue: currentPortfolioValue,
        profit: netProfit,
        roi: roi
    };
}

function loadUserStatistics() {
    if (!userData) return; 

    // 0. Update Summary Stats
    const perf = calculatePerformance(userData);
    
    const investedEl = document.getElementById("stats-total-invested");
    const profitEl = document.getElementById("stats-total-profit");
    const roiEl = document.getElementById("stats-roi");

    if(investedEl) investedEl.textContent = formatCurrency(perf.invested);
    
    if(profitEl) {
        profitEl.textContent = (perf.profit >= 0 ? "+" : "") + formatCurrency(perf.profit);
        profitEl.className = "stat-value " + (perf.profit >= 0 ? "price-up" : "price-down");
    }
    
    if(roiEl) {
        roiEl.textContent = (perf.roi >= 0 ? "+" : "") + perf.roi.toFixed(2) + "%";
        roiEl.className = "stat-value " + (perf.roi >= 0 ? "price-up" : "price-down");
    }

    // 1. Render Transaction History
    const historyBody = document.getElementById("transaction-history-list");
    const noTransMsg = document.getElementById("no-transactions-msg");
    const transactions = userData.transactions || [];

    // Sort transactions by date (descending for list)
    const sortedTransForList = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedTransForList.length === 0) {
        historyBody.innerHTML = "";
        noTransMsg.style.display = "block";
    } else {
        noTransMsg.style.display = "none";
        historyBody.innerHTML = sortedTransForList.map(t => `
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
    const currentMode = document.getElementById("chart-view-selector") ? document.getElementById("chart-view-selector").value : "netWorth";
    renderPerformanceChart(transactions, currentMode);
}

function renderPerformanceChart(transactions, mode = "netWorth") {
    const ctx = document.getElementById('performance-chart').getContext('2d');
    
    // Destroy existing chart if any
    if (performanceChart) {
        performanceChart.destroy();
    }

    let labels = [];
    let dataPoints = [];
    let labelText = "Net Worth";
    let color = "#3498db";

    if (transactions.length === 0) {
        labels = ["Start"];
        dataPoints = [1000];
    } else {
        // Sort transactions by date (ascending for graph)
        const sortedTrans = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

        // State Tracking
        let currentCash = 1000; // Starting cash
        let portfolio = {}; // symbol -> shares
        let lastKnownPrices = {}; // symbol -> price

        // Add Start Point
        labels.push("Start");
        if (mode === "netWorth" || mode === "cash") dataPoints.push(1000);
        else dataPoints.push(0);

        sortedTrans.forEach(t => {
            // Update Price
            lastKnownPrices[t.symbol] = t.price;

            // Update Cash and Portfolio
            if (t.type === 'buy') {
                currentCash -= t.total;
                portfolio[t.symbol] = (portfolio[t.symbol] || 0) + t.shares;
            } else {
                currentCash += t.total;
                portfolio[t.symbol] = (portfolio[t.symbol] || 0) - t.shares;
            }

            // Calculate Metric
            let value = 0;
            if (mode === "cash") {
                value = currentCash;
            } else {
                let investmentsValue = 0;
                for (const symbol in portfolio) {
                    const shares = portfolio[symbol];
                    const price = lastKnownPrices[symbol] || 0; // Use last transaction price
                    if (shares > 0) {
                         investmentsValue += shares * price;
                    }
                }
                
                if (mode === "investments") {
                    value = investmentsValue;
                } else { // netWorth
                    value = currentCash + investmentsValue;
                }
            }

            labels.push(new Date(t.date).toLocaleDateString());
            dataPoints.push(value);
        });

        // Add "Current" Point (Real-time update)
        // Use userData.balance and actual marketData prices
        if (userData && marketData.length > 0) {
             const nowValues = calculatePerformance(userData); // Reuse calculation logic
             labels.push("Now");
             
             if (mode === "cash") dataPoints.push(userData.balance);
             else if (mode === "investments") dataPoints.push(nowValues.currentValue);
             else dataPoints.push(userData.balance + nowValues.currentValue);
        }
    }

    // Colors
    if (mode === "cash") {
        labelText = "Cash on Hand";
        color = "#2ecc71";
    } else if (mode === "investments") {
        labelText = "Investments Value";
        color = "#e74c3c";
    }

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: labelText,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color + '1A', // 10% opacity
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return labelText + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
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
        let admins = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const perf = calculatePerformance(data);
            const nickname = data.nickname || "Anonymous Trader";

            // Filter out users with no stocks (invested < 10) AND no profit (inactive)
            // Or better: Filter out those who have never invested.
            // Check if they have 0 invested and a standard balance of 1000 (meaning they did nothing)
            // Or we check performace transactions length? 
            const txCount = (data.transactions || []).length;
            
            // Only list users who have made at least one transaction
            if (txCount > 0) {
                const userEntry = {
                    name: nickname,
                    role: data.role || 'student',
                    roi: perf.roi,
                    profit: perf.profit
                };

                if (data.role === 'admin' || data.email === 'admin@example.com' || (data.claims && data.claims.admin)) {
                    admins.push(userEntry);
                } else {
                    leaders.push(userEntry);
                }
            }
        });

        // Sort Regular Leaders by ROI (High to Low)
        leaders.sort((a, b) => b.roi - a.roi);

        // Render Leaders
        let html = leaders.map((leader, index) => {
            const roiClass = leader.roi >= 0 ? "price-up" : "price-down";
            const profitClass = leader.profit >= 0 ? "price-up" : "price-down";
            const roiSign = leader.roi >= 0 ? "+" : "";
            
            return `
            <tr>
                <td><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
                <td>${leader.name}</td>
                <td class="${roiClass}" style="font-weight:bold;">${roiSign}${leader.roi.toFixed(2)}%</td>
                <td class="${profitClass}">${formatCurrency(leader.profit)}</td>
            </tr>
        `}).join('');

        // Append Admins at the bottom (Unranked)
        if (admins.length > 0) {
            html += `<tr><td colspan="4" style="padding: 1rem; text-align: center; font-weight: bold; background: #f8f9fa;">--- Administrators ---</td></tr>`;
            
            html += admins.map(admin => {
                const roiClass = admin.roi >= 0 ? "price-up" : "price-down";
                const profitClass = admin.profit >= 0 ? "price-up" : "price-down";
                const roiSign = admin.roi >= 0 ? "+" : "";
                
                return `
                <tr style="opacity: 0.7; background: #fffbe6;">
                    <td><span class="rank-badge" style="background:#555;">ADMIN</span></td>
                    <td>${admin.name}</td>
                    <td class="${roiClass}" style="font-weight:bold;">${roiSign}${admin.roi.toFixed(2)}%</td>
                    <td class="${profitClass}">${formatCurrency(admin.profit)}</td>
                </tr>
            `}).join('');
        }
        
        if (leaders.length === 0 && admins.length === 0) {
             html = '<tr><td colspan="4" style="text-align:center;">No active traders found.</td></tr>';
        }

        tbody.innerHTML = html;

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
