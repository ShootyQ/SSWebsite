import { auth, provider, db } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginBtn = document.getElementById("login-btn");

// Definitions for Economy Check (Must match realestate.js)
const HOUSING_RENT = {
    'h_box': 0, 'h_tent': 10, 'h_studio': 50, 'h_house': 150, 'h_mansion': 500, 'h_castle': 2000
};
const COMMERCIAL_INCOME = {
    'c_lemonade': 10, 'c_vending': 40, 'c_laundromat': 150, 'c_arcade': 400, 'c_cinema': 1200, 'c_hotel': 5000
};

// Login Function
export async function login() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("User logged in:", user);
        await checkAndCreateUser(user);
    } catch (error) {
        console.error("Login failed:", error);
        alert("Login failed: " + error.message);
    }
}

// Logout Function
export async function logout() {
    try {
        await signOut(auth);
        console.log("User logged out");
        // Optional: Reload page or clear UI
        window.location.reload();
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

// Check and Create User in Firestore
async function checkAndCreateUser(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        // Create new user document with default role 'guest'
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: "guest", // Default role
            balance: 1000, // Initial currency
            portfolio: {}, // Empty portfolio map { symbol: quantity }
            createdAt: new Date(),
            lastEconomyUpdate: new Date().toISOString() // Init economy timer
        });
        console.log("New user created in Firestore");
    } else {
        console.log("User already exists in Firestore");
        await processDailyEconomy(userRef, userSnap.data());
    }
}

async function processDailyEconomy(userRef, userData) {
    const lastUpdate = new Date(userData.lastEconomyUpdate || userData.createdAt || new Date());
    const now = new Date();
    
    // Calculate difference in days (floored)
    const diffTime = Math.abs(now - lastUpdate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays >= 1) {
        console.log(`Processing economy for ${diffDays} days...`);
        
        // 1. Calculate Rent
        let dailyRent = 0;
        if (userData.residence && !userData.residence.isOwned) {
            dailyRent = HOUSING_RENT[userData.residence.id] || 0;
        }
        const totalRent = dailyRent * diffDays;

        // 2. Calculate Income
        let dailyIncome = 0;
        const properties = userData.properties || [];
        properties.forEach(pid => {
            dailyIncome += (COMMERCIAL_INCOME[pid] || 0);
        });
        const totalIncome = dailyIncome * diffDays;

        // 3. Update Balance
        const netChange = totalIncome - totalRent;
        
        if (netChange !== 0) {
            await updateDoc(userRef, {
                balance: increment(netChange),
                lastEconomyUpdate: now.toISOString()
            });
            
            // Notify User
            setTimeout(() => {
                alert(`Welcome back! While you were away (${diffDays} days):\n\nIncome: +$${totalIncome}\nRent: -$${totalRent}\n\nNet Change: $${netChange}`);
                window.location.reload(); // Refresh to show new balance
            }, 1000);
        } else {
            // Just update the timestamp so we don't check again today
            await updateDoc(userRef, { lastEconomyUpdate: now.toISOString() });
        }
    }
}

// Monitor Auth State
onAuthStateChanged(auth, async (user) => {
    const profileLink = document.getElementById("profile-link");
    
    if (user) {
        // User is signed in
        if (loginBtn) {
            loginBtn.textContent = "Logout";
            loginBtn.onclick = logout;
        }

        // Show Profile Link
        if (profileLink) {
            profileLink.style.display = "block";
        }
        
        // Fetch user role to display or use
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            // Check economy on every page load if logged in (in case they didn't just login via popup)
            // Optimization: Store a session flag to avoid checking every single reload? 
            // For now, checking every load is safer to ensure they pay rent.
            processDailyEconomy(userRef, userData);

            if (userData.role === 'admin') {
                console.log("Admin access granted");
            }
        }

    } else {
        // User is signed out
        if (loginBtn) {
            loginBtn.textContent = "Login with Google";
            loginBtn.onclick = login;
        }
        
        // Hide Profile Link
        if (profileLink) {
            profileLink.style.display = "none";
        }
    }
});
