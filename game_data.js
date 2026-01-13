// --- Configuration ---
export const RARITIES = {
    common: { name: 'Common', color: '#b0b0b0', multiplier: 1, chance: 0.6 },
    uncommon: { name: 'Uncommon', color: '#4caf50', multiplier: 1.5, chance: 0.3 },
    rare: { name: 'Rare', color: '#2196f3', multiplier: 3, chance: 0.09 },
    epic: { name: 'Epic', color: '#9c27b0', multiplier: 10, chance: 0.009 },
    legendary: { name: 'Legendary', color: '#ff9800', multiplier: 50, chance: 0.001 }
};

export const SUFFIXES = [
    // Common
    { name: "of Old", adj: "Ancient", rarity: 'common' },
    { name: "of Stone", adj: "Stone", rarity: 'common' },
    { name: "of Wood", adj: "Wooden", rarity: 'common' },
    { name: "of Clay", adj: "Clay", rarity: 'common' },
    // Uncommon
    { name: "of Iron", adj: "Iron", rarity: 'uncommon' },
    { name: "of the Forest", adj: "Forest", rarity: 'uncommon' },
    { name: "of Bronze", adj: "Bronze", rarity: 'uncommon' },
    { name: "of the Hills", adj: "Highland", rarity: 'uncommon' },
    // Rare
    { name: "of Gold", adj: "Golden", rarity: 'rare' },
    { name: "of the Ocean", adj: "Oceanic", rarity: 'rare' },
    { name: "of Silver", adj: "Silver", rarity: 'rare' },
    { name: "of the Sky", adj: "Celestial", rarity: 'rare' },
    // Epic
    { name: "of Diamond", adj: "Diamond", rarity: 'epic' },
    { name: "of the Ancients", adj: "Primeval", rarity: 'epic' },
    { name: "of Crystal", adj: "Crystalline", rarity: 'epic' },
    { name: "of the Depths", adj: "Abyssal", rarity: 'epic' },
    // Legendary
    { name: "of the Cosmos", adj: "Cosmic", rarity: 'legendary' },
    { name: "of Eternity", adj: "Eternal", rarity: 'legendary' },
    { name: "of Truth", adj: "True", rarity: 'legendary' },
    { name: "of Light", adj: "Radiant", rarity: 'legendary' }
];

export const SHOP_ITEMS = [
    // Special
    { id: 'loot_box', name: 'Mystery Crate', type: 'special', price: 500, icon: '🎁', desc: "Contains a random decoration with a rarity suffix!" },

    // Backgrounds
    { id: 'bg_neon', name: 'Neon City', type: 'background', price: 500, cssClass: 'bg-neon', icon: '🌆' },
    { id: 'bg_space', name: 'Deep Space', type: 'background', price: 1000, cssClass: 'bg-space', icon: '🌌' },
    { id: 'bg_matrix', name: 'The Matrix', type: 'background', price: 2500, cssClass: 'bg-matrix', icon: '💻' },
    { id: 'bg_gold', name: 'Solid Gold', type: 'background', price: 10000, cssClass: 'bg-gold', icon: '👑' },
    { id: 'bg_nature', name: 'Zen Garden', type: 'background', price: 750, cssClass: 'bg-nature', icon: '🎋' },
    
    // Titles
    { id: 'title_shark', name: 'Loan Shark', type: 'title', price: 1000, value: 'Loan Shark', icon: '🦈' },
    { id: 'title_whale', name: 'Market Whale', type: 'title', price: 5000, value: 'Market Whale', icon: '🐋' },
    { id: 'title_diamond', name: 'Diamond Hands', type: 'title', price: 2000, value: 'Diamond Hands', icon: '💎' },
    { id: 'title_rocket', name: 'To The Moon', type: 'title', price: 500, value: 'To The Moon', icon: '🚀' },
    { id: 'title_historian', name: 'Time Traveler', type: 'title', price: 1500, value: 'Time Traveler', icon: '⏳' },

    // Decorations (Furniture & Items)
    { id: 'dec_plant', name: 'Potted Plant', type: 'decoration', price: 150, icon: '🪴', obtainable: ['shop', 'drop'] },
    { id: 'dec_lamp', name: 'Lava Lamp', type: 'decoration', price: 300, icon: '💡', obtainable: ['shop', 'drop'] },
    { id: 'dec_map', name: 'Vintage Map', type: 'decoration', price: 500, icon: '🗺️', obtainable: ['shop', 'drop'] },
    { id: 'dec_gaming', name: 'Gaming Setup', type: 'decoration', price: 2500, icon: '🎮', obtainable: ['shop', 'drop'] },
    { id: 'dec_books', name: 'Stack of Books', type: 'decoration', price: 200, icon: '📚', obtainable: ['shop', 'drop'] },
    { id: 'dec_trophy', name: 'Gold Trophy', type: 'decoration', price: 1000, icon: '🏆', obtainable: ['shop', 'drop'] },
    { id: 'dec_globe', name: 'World Globe', type: 'decoration', price: 400, icon: '🌍', obtainable: ['shop', 'drop'] },
    
    // Pets
    { id: 'pet_cat', name: 'Pixel Cat', type: 'decoration', price: 1200, icon: '🐱', obtainable: ['shop', 'drop'] },
    { id: 'pet_dog', name: 'Pixel Dog', type: 'decoration', price: 1200, icon: '🐶', obtainable: ['shop', 'drop'] },
    { id: 'pet_dragon', name: 'Tiny Dragon', type: 'decoration', price: 5000, icon: '🐲', obtainable: ['shop', 'drop'] },

    // New Collectible Items (Drop Only or Rare Shop)
    { id: 'item_scroll', name: 'Ancient Scroll', type: 'decoration', price: 800, icon: '📜', obtainable: ['drop'] },
    { id: 'item_quill', name: 'Scribe\'s Quill', type: 'decoration', price: 400, icon: '✒️', obtainable: ['drop'] },
    { id: 'item_compass', name: 'Brass Compass', type: 'decoration', price: 600, icon: '🧭', obtainable: ['drop'] },
    { id: 'item_telescope', name: 'Star Telescope', type: 'decoration', price: 1200, icon: '🔭', obtainable: ['drop'] },
    { id: 'item_hourglass', name: 'Hourglass', type: 'decoration', price: 500, icon: '⏳', obtainable: ['drop'] },
    { id: 'item_scales', name: 'Scales of Justice', type: 'decoration', price: 1500, icon: '⚖️', obtainable: ['drop'] },
    { id: 'item_hammer', name: 'Builder\'s Hammer', type: 'decoration', price: 300, icon: '🔨', obtainable: ['drop'] },
    { id: 'item_shield', name: 'Shield of Faith', type: 'decoration', price: 2000, icon: '🛡️', obtainable: ['drop'] },
    { id: 'item_sword', name: 'Sword of Spirit', type: 'decoration', price: 2500, icon: '⚔️', obtainable: ['drop'] },
    { id: 'item_helmet', name: 'Helmet of Salvation', type: 'decoration', price: 2200, icon: '⛑️', obtainable: ['drop'] },
    { id: 'item_crown', name: 'Royal Crown', type: 'decoration', price: 5000, icon: '👑', obtainable: ['drop'] },
    { id: 'item_harp', name: 'Golden Harp', type: 'decoration', price: 1800, icon: '🎵', obtainable: ['drop'] },
    { id: 'item_tablet', name: 'Stone Tablet', type: 'decoration', price: 1000, icon: '🗿', obtainable: ['drop'] },
    { id: 'item_lamp_oil', name: 'Oil Lamp', type: 'decoration', price: 400, icon: '🪔', obtainable: ['drop'] },
    { id: 'item_bread', name: 'Loaf of Bread', type: 'decoration', price: 100, icon: '🍞', obtainable: ['drop'] },
    { id: 'item_fish', name: 'Fresh Fish', type: 'decoration', price: 100, icon: '🐟', obtainable: ['drop'] },
    { id: 'item_wheat', name: 'Bundle of Wheat', type: 'decoration', price: 150, icon: '🌾', obtainable: ['drop'] },
    { id: 'item_grapes', name: 'Cluster of Grapes', type: 'decoration', price: 200, icon: '🍇', obtainable: ['drop'] },
    { id: 'item_pottery', name: 'Clay Pot', type: 'decoration', price: 300, icon: '🏺', obtainable: ['drop'] },
    { id: 'item_key', name: 'Iron Key', type: 'decoration', price: 500, icon: '🗝️', obtainable: ['drop'] },
    { id: 'item_candle', name: 'Wax Candle', type: 'decoration', price: 100, icon: '🕯️', obtainable: ['drop'] },
    { id: 'item_bell', name: 'Church Bell', type: 'decoration', price: 800, icon: '🔔', obtainable: ['drop'] },
    { id: 'item_anchor', name: 'Ship Anchor', type: 'decoration', price: 1200, icon: '⚓', obtainable: ['drop'] },
    { id: 'item_wheel', name: 'Ship Wheel', type: 'decoration', price: 1500, icon: '☸️', obtainable: ['drop'] },
    { id: 'item_chest', name: 'Treasure Chest', type: 'decoration', price: 3000, icon: '🧳', obtainable: ['drop'] },

    // Lesson Rewards (Knowledge Themed)
    { id: 'item_book_wisdom', name: 'Book of Wisdom', type: 'decoration', price: 1000, icon: '📖', obtainable: ['lesson'] },
    { id: 'item_scroll_truth', name: 'Scroll of Truth', type: 'decoration', price: 1200, icon: '📜', obtainable: ['lesson'] },
    { id: 'item_pen_knowledge', name: 'Pen of Knowledge', type: 'decoration', price: 800, icon: '🖊️', obtainable: ['lesson'] },
    { id: 'item_glasses_insight', name: 'Glasses of Insight', type: 'decoration', price: 1500, icon: '👓', obtainable: ['lesson'] },
    { id: 'item_globe_discovery', name: 'Globe of Discovery', type: 'decoration', price: 2000, icon: '🌎', obtainable: ['lesson'] },
    { id: 'item_torch_enlightenment', name: 'Torch of Enlightenment', type: 'decoration', price: 2500, icon: '🔥', obtainable: ['lesson'] },
    { id: 'item_medal_honor', name: 'Medal of Honor', type: 'decoration', price: 3000, icon: '🎖️', obtainable: ['lesson'] },
    { id: 'item_diploma', name: 'Ancient Diploma', type: 'decoration', price: 5000, icon: '🎓', obtainable: ['lesson'] }
];

export function generateLoot(forceRarity = null, source = 'drop') {
    // 1. Pick a base item based on source
    // If source is 'lesson', look for 'lesson' tag. If 'drop', look for 'drop'.
    // Fallback to 'drop' if nothing found for source.
    let pool = SHOP_ITEMS.filter(i => i.obtainable && i.obtainable.includes(source));
    
    if (pool.length === 0) {
        // Fallback to generic drops if specific pool is empty
        pool = SHOP_ITEMS.filter(i => i.obtainable && i.obtainable.includes('drop'));
    }
    
    if (pool.length === 0) return null;
    
    const baseItem = pool[Math.floor(Math.random() * pool.length)];

    // 2. Roll Rarity
    // Probabilities: Common (60%), Uncommon (30%), Rare (9%), Epic (0.9%), Legendary (0.1%)
    const roll = Math.random();
    let rarity = 'common';
    
    if (forceRarity) {
        rarity = forceRarity;
    } else {
        if (roll < RARITIES.legendary.chance) rarity = 'legendary'; // < 0.001
        else if (roll < RARITIES.legendary.chance + RARITIES.epic.chance) rarity = 'epic'; // < 0.01
        else if (roll < RARITIES.legendary.chance + RARITIES.epic.chance + RARITIES.rare.chance) rarity = 'rare'; // < 0.10
        else if (roll < RARITIES.legendary.chance + RARITIES.epic.chance + RARITIES.rare.chance + RARITIES.uncommon.chance) rarity = 'uncommon'; // < 0.40
        else rarity = 'common';
    }

    // 3. Get Suffix
    const possibleSuffixes = SUFFIXES.filter(s => s.rarity === rarity);
    const suffix = possibleSuffixes.length > 0 
        ? possibleSuffixes[Math.floor(Math.random() * possibleSuffixes.length)]
        : { name: "", adj: "" };

    // 4. Construct Name
    // Avoid double "of" by using adjective prefix if base name already has "of"
    let finalName = baseItem.name;
    if (suffix.name) {
        if (baseItem.name.includes(' of ') && suffix.adj) {
            finalName = `${suffix.adj} ${baseItem.name}`;
        } else {
            finalName = `${baseItem.name} ${suffix.name}`;
        }
    }

    // 5. Construct Item
    return {
        uuid: crypto.randomUUID(),
        baseId: baseItem.id,
        name: finalName,
        rarity: rarity,
        type: baseItem.type,
        icon: baseItem.icon,
        value: Math.floor(baseItem.price * RARITIES[rarity].multiplier)
    };
}

export const BUILDINGS = {
    // Residential (XP Buffs & Profile Themes)
    'res_tent': { name: 'Tent', type: 'residential', cost: 100, xpMult: 0.05, icon: '⛺', desc: "Better than sleeping on the ground.", slots: 4, theme: 'theme-tent' },
    'res_shack': { name: 'Wooden Shack', type: 'residential', cost: 500, xpMult: 0.10, icon: '🏚️', desc: "It has a roof!", slots: 6, theme: 'theme-shack' },
    'res_cabin': { name: 'Log Cabin', type: 'residential', cost: 1500, xpMult: 0.15, icon: '🛖', desc: "Rustic living in the woods.", slots: 8, theme: 'theme-cabin' },
    'res_house': { name: 'Brick House', type: 'residential', cost: 2500, xpMult: 0.25, icon: '🏡', desc: "Solid and cozy.", slots: 12, theme: 'theme-house' },
    'res_villa': { name: 'Modern Villa', type: 'residential', cost: 5000, xpMult: 0.35, icon: '🏘️', desc: "Stylish and spacious.", slots: 16, theme: 'theme-villa' },
    'res_mansion': { name: 'Neon Mansion', type: 'residential', cost: 10000, xpMult: 0.50, icon: '🏰', desc: "The envy of the neighborhood.", slots: 24, theme: 'theme-mansion' },
    'res_palace': { name: 'Crystal Palace', type: 'residential', cost: 50000, xpMult: 1.00, icon: '🏯', desc: "Fit for a king or queen.", slots: 32, theme: 'theme-palace' },

    // Commercial (Income)
    'com_stand': { name: 'Lemonade Stand', type: 'commercial', cost: 200, income: 10, visitFee: 2, icon: '🍋', desc: "Fresh squeezed profits." },
    'com_store': { name: 'Corner Store', type: 'commercial', cost: 1000, income: 50, visitFee: 10, icon: '🏪', desc: "Snacks for everyone." },
    'com_cafe': { name: 'Cyber Cafe', type: 'commercial', cost: 2500, income: 100, visitFee: 25, icon: '☕', desc: "Coffee and high-speed net." },
    'com_arcade': { name: 'Cyber Arcade', type: 'commercial', cost: 5000, income: 200, visitFee: 50, icon: '🕹️', desc: "High scores, high profits." },
    'com_cinema': { name: 'Holo-Cinema', type: 'commercial', cost: 10000, income: 500, visitFee: 100, icon: '🍿', desc: "The future of entertainment." },
    'com_tower': { name: 'Tech Tower', type: 'commercial', cost: 20000, income: 1000, visitFee: 200, icon: '🏢', desc: "Corporate domination." },
    'com_stadium': { name: 'Mega Stadium', type: 'commercial', cost: 100000, income: 5000, visitFee: 1000, icon: '🏟️', desc: "Massive events, massive cash." }
};