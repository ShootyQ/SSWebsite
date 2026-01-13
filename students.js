import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const studentsGrid = document.getElementById("students-grid");
const modal = document.getElementById("student-modal");
const closeModalBtn = document.querySelector(".close-modal");

// Modal Elements
const modalAvatar = document.getElementById("modal-avatar");
const modalNickname = document.getElementById("modal-nickname");
const modalBadges = document.getElementById("modal-badges");
const modalFunFact = document.getElementById("modal-fun-fact");
const modalNetWorth = document.getElementById("modal-net-worth");
const modalPortfolioCount = document.getElementById("modal-portfolio-count");

// Market Data Cache (for calculating net worth)
let marketDataCache = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role === 'guest') {
            alert("Your account is pending approval. Please contact your teacher.");
            window.location.href = "index.html";
            return;
        }
        init();
    } else {
        window.location.href = "index.html";
    }
});

async function init() {
    setupEventListeners();
    await fetchMarketData(); // Need prices to calc net worth
    loadStudents();
}
// Init called by Auth
// init();

function setupEventListeners() {
    closeModalBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };
}

async function fetchMarketData() {
    try {
        const marketDoc = await getDoc(doc(db, "system", "market"));
        if (marketDoc.exists()) {
            marketDataCache = marketDoc.data().stocks || [];
        }
    } catch (error) {
        console.error("Error fetching market data:", error);
    }
}

async function loadStudents() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        studentsGrid.innerHTML = "";

        const students = [];
        querySnapshot.forEach((doc) => {
            students.push({ id: doc.id, ...doc.data() });
        });

        // Sort by Net Worth (optional, or just alphabetical)
        // Let's sort by nickname for now
        students.sort((a, b) => (a.nickname || "Anonymous").localeCompare(b.nickname || "Anonymous"));

        if (students.length === 0) {
            studentsGrid.innerHTML = "<p>No students found.</p>";
            return;
        }

        students.forEach(student => {
            const card = createStudentCard(student);
            studentsGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading students:", error);
        studentsGrid.innerHTML = "<p>Failed to load community data.</p>";
    }
}

function createStudentCard(student) {
    const card = document.createElement("div");
    card.className = "student-card";
    
    const netWorth = calculateNetWorth(student);
    const badges = getBadges(student, netWorth);

    card.innerHTML = `
        <div class="card-avatar">${student.avatar || '😊'}</div>
        <div class="card-info">
            <h3>${student.nickname || 'Anonymous'}</h3>
            <div class="card-badges">
                ${badges.slice(0, 3).map(b => `<span class="badge-icon" title="${b.title}">${b.icon}</span>`).join('')}
            </div>
        </div>
    `;

    card.addEventListener("click", () => openStudentModal(student, netWorth, badges));
    return card;
}

function calculateNetWorth(student) {
    let portfolioValue = 0;
    if (student.portfolio) {
        for (const [symbol, shares] of Object.entries(student.portfolio)) {
            const stock = marketDataCache.find(s => s.symbol === symbol);
            if (stock) {
                portfolioValue += shares * stock.price;
            }
        }
    }
    return (student.balance || 0) + portfolioValue;
}

function getBadges(student, netWorth) {
    const badges = [];

    // Role Badges
    if (student.role === 'admin') {
        badges.push({ icon: '🛡️', title: 'Admin' });
    }

    // Wealth Badges
    if (netWorth > 100000) {
        badges.push({ icon: '💎', title: 'Diamond Hands (>$100k)' });
    } else if (netWorth > 50000) {
        badges.push({ icon: '💰', title: 'Whale (>$50k)' });
    } else if (netWorth > 10000) {
        badges.push({ icon: '💵', title: 'Investor (>$10k)' });
    }

    // Portfolio Badges
    const stockCount = student.portfolio ? Object.keys(student.portfolio).length : 0;
    if (stockCount >= 10) {
        badges.push({ icon: '📊', title: 'Diversified (10+ Stocks)' });
    } else if (stockCount > 0) {
        badges.push({ icon: '📈', title: 'Trader' });
    } else {
        badges.push({ icon: '🌱', title: 'Newbie' });
    }

    // Profile Badges
    if (student.funFact) {
        badges.push({ icon: '🗣️', title: 'Socialite' });
    }

    return badges;
}

function openStudentModal(student, netWorth, badges) {
    modalAvatar.textContent = student.avatar || '😊';
    modalNickname.textContent = student.nickname || 'Anonymous';
    modalFunFact.textContent = student.funFact || "This student hasn't shared a fun fact yet.";
    modalNetWorth.textContent = formatCurrency(netWorth);
    
    const stockCount = student.portfolio ? Object.keys(student.portfolio).length : 0;
    modalPortfolioCount.textContent = `${stockCount} Stocks`;

    modalBadges.innerHTML = badges.map(b => `
        <span class="badge-pill" title="${b.title}">${b.icon} ${b.title}</span>
    `).join('');

    modal.style.display = "flex";
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

init();
