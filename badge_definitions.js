// Helper Functions
export function getNetWorth(user, market = []) {
    // If user has a pre-calculated netWorth (from stockmarket.js updates), use it
    if (user.netWorth !== undefined) return user.netWorth;

    // Fallback calculation if market data is available
    let portfolioValue = 0;
    if (user.portfolio && market.length > 0) {
        for (const [symbol, shares] of Object.entries(user.portfolio)) {
            const stock = market.find(s => s.symbol === symbol);
            if (stock) {
                portfolioValue += shares * stock.price;
            }
        }
    }
    return (user.balance || 0) + portfolioValue;
}

export function hasStock(user, symbols) {
    if (!user.portfolio) return false;
    return symbols.some(s => user.portfolio[s] > 0);
}

// Badge Definitions
export const BADGES = [
    // Profile (4)
    { id: 'profile_nick', title: 'Identity', description: 'Set a custom nickname', icon: '🆔', check: (u) => u.nickname && u.nickname !== 'Student' },
    { id: 'profile_avatar', title: 'New Look', description: 'Change your avatar', icon: '😎', check: (u) => u.avatar && u.avatar !== '😊' },
    { id: 'profile_fact', title: 'Storyteller', description: 'Add a fun fact to your profile', icon: '🗣️', check: (u) => u.funFact && u.funFact.length > 0 },
    { id: 'role_admin', title: 'The Boss', description: 'Become an Admin', icon: '🛡️', check: (u) => u.role === 'admin' },

    // Wealth (6)
    { id: 'wealth_1500', title: 'Piggy Bank', description: 'Net Worth > $1,500', icon: '🐖', check: (u, m) => getNetWorth(u, m) >= 1500 },
    { id: 'wealth_2000', title: 'Stacking Paper', description: 'Net Worth > $2,000', icon: '💵', check: (u, m) => getNetWorth(u, m) >= 2000 },
    { id: 'wealth_5000', title: 'High Roller', description: 'Net Worth > $5,000', icon: '🎩', check: (u, m) => getNetWorth(u, m) >= 5000 },
    { id: 'wealth_10k', title: 'Five Figures', description: 'Net Worth > $10,000', icon: '💰', check: (u, m) => getNetWorth(u, m) >= 10000 },
    { id: 'wealth_50k', title: 'Tycoon', description: 'Net Worth > $50,000', icon: '🏰', check: (u, m) => getNetWorth(u, m) >= 50000 },
    { id: 'wealth_100k', title: 'Diamond Hands', description: 'Net Worth > $100,000', icon: '💎', check: (u, m) => getNetWorth(u, m) >= 100000 },

    // Trading Activity (5)
    { id: 'trade_1', title: 'First Steps', description: 'Make your first trade', icon: '👟', check: (u) => (u.transactions || []).length >= 1 },
    { id: 'trade_5', title: 'Trader', description: 'Make 5 trades', icon: '🤝', check: (u) => (u.transactions || []).length >= 5 },
    { id: 'trade_10', title: 'Frequent Flyer', description: 'Make 10 trades', icon: '✈️', check: (u) => (u.transactions || []).length >= 10 },
    { id: 'trade_25', title: 'Day Trader', description: 'Make 25 trades', icon: '📊', check: (u) => (u.transactions || []).length >= 25 },
    { id: 'trade_50', title: 'Wall Street Wolf', description: 'Make 50 trades', icon: '🐺', check: (u) => (u.transactions || []).length >= 50 },

    // Portfolio Diversity (5)
    { id: 'div_3', title: 'Starter Pack', description: 'Own 3 different stocks', icon: '📦', check: (u) => Object.keys(u.portfolio || {}).length >= 3 },
    { id: 'div_5', title: 'Diversified', description: 'Own 5 different stocks', icon: '🌈', check: (u) => Object.keys(u.portfolio || {}).length >= 5 },
    { id: 'div_10', title: 'Hedge Fund', description: 'Own 10 different stocks', icon: '🏦', check: (u) => Object.keys(u.portfolio || {}).length >= 10 },
    { id: 'div_20', title: 'Index Fund', description: 'Own 20 different stocks', icon: '🌐', check: (u) => Object.keys(u.portfolio || {}).length >= 20 },
    { id: 'one_basket', title: 'All In One', description: 'Own only 1 stock (value > $500)', icon: '🥚', check: (u, m) => {
        const keys = Object.keys(u.portfolio || {});
        if (keys.length !== 1) return false;
        const symbol = keys[0];
        if (!m || m.length === 0) return false; // Need market data
        const stock = m.find(s => s.symbol === symbol);
        return stock && (stock.price * u.portfolio[symbol]) > 500;
    }},

    // Sectors & Specifics (6)
    { id: 'tech_bro', title: 'Tech Bro', description: 'Own AAPL, MSFT, GOOG, or META', icon: '💻', check: (u) => hasStock(u, ['AAPL', 'MSFT', 'GOOG', 'GOOGL', 'META']) },
    { id: 'finance_bro', title: 'Finance Bro', description: 'Own JPM, BAC, or GS', icon: '💼', check: (u) => hasStock(u, ['JPM', 'BAC', 'GS', 'MS', 'C']) },
    { id: 'consumer_king', title: 'Consumer King', description: 'Own KO, PEP, or MCD', icon: '🥤', check: (u) => hasStock(u, ['KO', 'PEP', 'MCD', 'SBUX', 'WMT']) },
    { id: 'energy_sector', title: 'Power Player', description: 'Own XOM or CVX', icon: '⚡', check: (u) => hasStock(u, ['XOM', 'CVX', 'COP']) },
    { id: 'pharma_hero', title: 'Healthcare Hero', description: 'Own JNJ, PFE, or UNH', icon: '💊', check: (u) => hasStock(u, ['JNJ', 'PFE', 'UNH', 'LLY']) },
    { id: 'industrialist', title: 'Builder', description: 'Own GE, CAT, or BA', icon: '🏗️', check: (u) => hasStock(u, ['GE', 'CAT', 'BA', 'HON']) },

    // Fun / Misc (4)
    { id: 'cash_king', title: 'Liquid', description: 'Have > $2,000 in Cash', icon: '💸', check: (u) => (u.balance || 0) >= 2000 },
    { id: 'all_in', title: 'All In', description: 'Have < $10 in Cash (and own stocks)', icon: '🎰', check: (u) => (u.balance || 0) < 10 && Object.keys(u.portfolio || {}).length > 0 },
    { id: 'sniper', title: 'Sniper', description: 'Buy exactly 1 share in a transaction', icon: '🎯', check: (u) => (u.transactions || []).some(t => t.type === 'buy' && t.shares === 1) },
    { id: 'bulk_buyer', title: 'Wholesaler', description: 'Buy > 10 shares in one transaction', icon: '🚛', check: (u) => (u.transactions || []).some(t => t.type === 'buy' && t.shares > 10) },

    // Real Estate (8)
    { id: 'landlord', title: 'Landlord', description: 'Own your first plot of land', icon: '🚩', check: (u) => (u.realEstateStats?.plotsCount || 0) >= 1 },
    { id: 'mogul', title: 'Real Estate Mogul', description: 'Own 5 plots of land', icon: '🏘️', check: (u) => (u.realEstateStats?.plotsCount || 0) >= 5 },
    { id: 'empire', title: 'Empire Builder', description: 'Own 10 plots of land', icon: '🗺️', check: (u) => (u.realEstateStats?.plotsCount || 0) >= 10 },
    { id: 'slumlord', title: 'Slumlord', description: 'Own 5 Tents or Shacks', icon: '⛺', check: (u) => (u.realEstateStats?.buildings || []).filter(b => ['res_tent', 'res_shack'].includes(b)).length >= 5 },
    { id: 'high_society', title: 'High Society', description: 'Own a Mansion or Palace', icon: '🥂', check: (u) => (u.realEstateStats?.buildings || []).some(b => ['res_mansion', 'res_palace'].includes(b)) },
    { id: 'commercial_giant', title: 'Commercial Giant', description: 'Own a Tech Tower or Stadium', icon: '🏢', check: (u) => (u.realEstateStats?.buildings || []).some(b => ['com_tower', 'com_stadium'].includes(b)) },
    { id: 'passive_income', title: 'Passive Income', description: 'Daily Income > $500', icon: '📈', check: (u) => (u.dailyIncome || 0) >= 500 },
    { id: 'property_tycoon', title: 'Property Tycoon', description: 'Real Estate Value > $50,000', icon: '🏰', check: (u) => (u.realEstateStats?.totalValue || 0) >= 50000 }
];
