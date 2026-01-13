import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const els = {
    grid: document.getElementById('market-grid'),
    refreshBtn: document.getElementById('refresh-market'),
    searchInput: document.getElementById('market-search'),
    sortSelect: document.getElementById('market-sort')
};

let allListings = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role === 'guest') {
            alert("Your account is pending approval. Please contact your teacher.");
            window.location.href = "index.html";
            return;
        }
        loadMarketplace();
    } else {
        // Allow viewing but not buying? User said "do anything", so implied viewing is okay? 
        // User said "have to change to user to be able to do anything".
        // Let's assume Guests/Logged Out = View Only is safer, or Block All.
        // Given other pages redirect to index, let's Redirect if Guest.
        // If not logged in at all, we might want to redirect too, OR let them see marketplace as teaser.
        // Existing logic in other files redirects to index if no user.
        // Let's redirect if no user or guest for consistency.
        window.location.href = "index.html";
    }
});

async function loadMarketplace() {
    els.grid.innerHTML = '<p>Loading listings...</p>';
    try {
        const q = query(collection(db, "market_listings"), orderBy("createdAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        
        allListings = [];
        snapshot.forEach(doc => {
            allListings.push({ id: doc.id, ...doc.data() });
        });

        renderListings();
    } catch (err) {
        console.error("Error loading market:", err);
        els.grid.innerHTML = '<p>Error loading marketplace. Try again later.</p>';
    }
}

function renderListings() {
    els.grid.innerHTML = '';
    
    let listings = [...allListings];
    
    // Filter
    const searchTerm = els.searchInput.value.toLowerCase();
    if (searchTerm) {
        listings = listings.filter(l => l.item.name.toLowerCase().includes(searchTerm));
    }

    // Sort
    const sort = els.sortSelect.value;
    if (sort === 'price_asc') listings.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') listings.sort((a, b) => b.price - a.price);
    // newest is default from query

    if (listings.length === 0) {
        els.grid.innerHTML = '<p>No items found.</p>';
        return;
    }

    listings.forEach(listing => {
        const item = listing.item;
        const isMyListing = auth.currentUser && auth.currentUser.uid === listing.sellerUid;

        const card = document.createElement('div');
        card.className = `shop-item ${item.rarity ? 'rarity-' + item.rarity : ''}`;
        
        card.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <div class="item-info">
                <h4>${item.name}</h4>
                ${item.rarity ? `<p class="rarity-tag ${item.rarity}">${item.rarity}</p>` : ''}
                <p class="seller-info">Seller: ${listing.sellerName}</p>
            </div>
            <button class="buy-btn" onclick="buyListing('${listing.id}')" ${isMyListing ? 'disabled' : ''}>
                ${isMyListing ? 'Your Listing' : '$' + listing.price.toLocaleString()}
            </button>
        `;
        els.grid.appendChild(card);
    });
}

window.buyListing = async (listingId) => {
    if (!auth.currentUser) {
        alert("Please log in to buy items.");
        return;
    }

    const listing = allListings.find(l => l.id === listingId);
    if (!listing) return;

    if (!confirm(`Buy ${listing.item.name} from ${listing.sellerName} for $${listing.price}?`)) return;

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Get Listing
            const listingRef = doc(db, "market_listings", listingId);
            const listingDoc = await transaction.get(listingRef);
            if (!listingDoc.exists()) throw "This item has already been sold!";

            const listingData = listingDoc.data();

            // 2. Get Buyer
            const buyerRef = doc(db, "users", auth.currentUser.uid);
            const buyerDoc = await transaction.get(buyerRef);
            const buyerData = buyerDoc.data();

            if ((buyerData.balance || 0) < listingData.price) throw "Insufficient funds!";

            // 3. Get Seller
            const sellerRef = doc(db, "users", listingData.sellerUid);
            const sellerDoc = await transaction.get(sellerRef);
            
            // Execute Transaction
            // Deduct from Buyer
            const newBuyerBalance = (buyerData.balance || 0) - listingData.price;
            const buyerInventory = buyerData.inventory || [];
            buyerInventory.push(listingData.item);

            transaction.update(buyerRef, {
                balance: newBuyerBalance,
                inventory: buyerInventory
            });

            // Add to Seller (if exists)
            if (sellerDoc.exists()) {
                const sellerData = sellerDoc.data();
                const newSellerBalance = (sellerData.balance || 0) + listingData.price;
                transaction.update(sellerRef, { balance: newSellerBalance });
            }

            // Delete Listing
            transaction.delete(listingRef);
        });

        alert("Purchase successful!");
        loadMarketplace();
    } catch (err) {
        console.error(err);
        alert("Transaction failed: " + err);
    }
};

els.refreshBtn.addEventListener('click', loadMarketplace);
els.searchInput.addEventListener('input', renderListings);
els.sortSelect.addEventListener('change', renderListings);

// Initial load handled by Auth Change
// loadMarketplace();