/**
 * Anime Card Game Module for WhatsApp Bot
 * Manages collectible anime character cards for gacha game
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const nodeSchedule = require('node-schedule');

// Data storage
let cardGameState = {
    playerCards: {},      // userId -> card collection
    cardHistory: {},      // userId -> history of card draws
    tradeLogs: [],        // History of trades between users
    dailyDraws: {},       // userId -> count of draws today + timestamp
    cardCollection: []    // Full collection of available cards
};

// File paths
const CARDS_FILE = config.animeCardsFile || path.join(config.databaseDir, 'animeCards.json');
const CARD_COLLECTION_FILE = path.join(config.databaseDir, 'animeCardCollection.json');

// Rarity weights for random drawing
const RARITY_WEIGHTS = {
    common: 60,     // 60% chance
    uncommon: 25,   // 25% chance
    rare: 10,       // 10% chance
    epic: 4,        // 4% chance
    legendary: 1    // 1% chance
};

// Card game settings
const cardSettings = config.animeGames.cards;

/**
 * Initialize the anime card game module
 */
function initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(config.databaseDir)) {
        fs.mkdirSync(config.databaseDir, { recursive: true });
    }

    // Load card game state
    try {
        if (fs.existsSync(CARDS_FILE)) {
            const data = fs.readFileSync(CARDS_FILE, 'utf8');
            cardGameState = JSON.parse(data);
            console.log('Anime Card Game: Loaded card game state data');
        } else {
            console.log('Anime Card Game: No existing card game state found, starting fresh');
            saveCardGameState();
        }
    } catch (error) {
        console.error('Anime Card Game: Error loading card game state data', error);
        cardGameState = {
            playerCards: {},
            cardHistory: {},
            tradeLogs: [],
            dailyDraws: {},
            cardCollection: []
        };
        saveCardGameState();
    }

    // Load card collection or generate default cards
    loadOrGenerateCardCollection();

    // Schedule reset of daily draws at midnight
    nodeSchedule.scheduleJob('0 0 * * *', () => {
        console.log('Anime Card Game: Resetting daily draw limits');
        cardGameState.dailyDraws = {};
        saveCardGameState();
    });
}

/**
 * Load existing card collection or generate default set
 */
function loadOrGenerateCardCollection() {
    try {
        if (fs.existsSync(CARD_COLLECTION_FILE)) {
            const data = fs.readFileSync(CARD_COLLECTION_FILE, 'utf8');
            cardGameState.cardCollection = JSON.parse(data);
            console.log(`Anime Card Game: Loaded ${cardGameState.cardCollection.length} cards from collection`);
        } else {
            console.log('Anime Card Game: No card collection found, generating default cards');
            cardGameState.cardCollection = generateDefaultCardCollection();
            fs.writeFileSync(CARD_COLLECTION_FILE, JSON.stringify(cardGameState.cardCollection, null, 2));
            console.log(`Anime Card Game: Generated ${cardGameState.cardCollection.length} default cards`);
        }
    } catch (error) {
        console.error('Anime Card Game: Error loading card collection', error);
        cardGameState.cardCollection = generateDefaultCardCollection();
        fs.writeFileSync(CARD_COLLECTION_FILE, JSON.stringify(cardGameState.cardCollection, null, 2));
    }
}

/**
 * Save card game state to file
 */
function saveCardGameState() {
    try {
        // Save a cleaner version without the full card collection to save space
        const stateToSave = { ...cardGameState };
        delete stateToSave.cardCollection; // Don't save full collection in state file
        
        fs.writeFileSync(CARDS_FILE, JSON.stringify(stateToSave, null, 2));
    } catch (error) {
        console.error('Anime Card Game: Error saving card game state', error);
    }
}

/**
 * Generate a default card collection
 * @returns {array} Array of card objects
 */
function generateDefaultCardCollection() {
    // A starter set of anime character cards with different rarities
    const collection = [
        // Common cards (60% chance)
        {
            id: 'c001',
            name: 'Sakura Haruno',
            anime: 'Naruto',
            rarity: 'common',
            description: 'A skilled medical ninja and member of Team 7',
            power: 25
        },
        {
            id: 'c002',
            name: 'Krillin',
            anime: 'Dragon Ball',
            rarity: 'common',
            description: 'A skilled martial artist and close friend of Goku',
            power: 20
        },
        {
            id: 'c003',
            name: 'Usopp',
            anime: 'One Piece',
            rarity: 'common',
            description: 'The sniper of the Straw Hat Pirates',
            power: 15
        },
        {
            id: 'c004',
            name: 'Armin Arlert',
            anime: 'Attack on Titan',
            rarity: 'common',
            description: 'A strategic genius and member of the Survey Corps',
            power: 18
        },
        {
            id: 'c005',
            name: 'Ochako Uraraka',
            anime: 'My Hero Academia',
            rarity: 'common',
            description: 'A student at U.A. High with Zero Gravity quirk',
            power: 22
        },
        
        // Uncommon cards (25% chance)
        {
            id: 'u001',
            name: 'Kakashi Hatake',
            anime: 'Naruto',
            rarity: 'uncommon',
            description: 'The Copy Ninja and leader of Team 7',
            power: 45
        },
        {
            id: 'u002',
            name: 'Vegeta',
            anime: 'Dragon Ball',
            rarity: 'uncommon',
            description: 'The proud prince of the Saiyan race',
            power: 50
        },
        {
            id: 'u003',
            name: 'Sanji',
            anime: 'One Piece',
            rarity: 'uncommon',
            description: 'The cook of the Straw Hat Pirates',
            power: 42
        },
        {
            id: 'u004',
            name: 'Mikasa Ackerman',
            anime: 'Attack on Titan',
            rarity: 'uncommon',
            description: 'An elite soldier and adoptive sister of Eren',
            power: 48
        },
        {
            id: 'u005',
            name: 'Shoto Todoroki',
            anime: 'My Hero Academia',
            rarity: 'uncommon',
            description: 'A student with powerful Half-Cold Half-Hot quirk',
            power: 46
        },
        
        // Rare cards (10% chance)
        {
            id: 'r001',
            name: 'Sasuke Uchiha',
            anime: 'Naruto',
            rarity: 'rare',
            description: 'Last of the Uchiha clan with Sharingan eyes',
            power: 75
        },
        {
            id: 'r002',
            name: 'Gohan',
            anime: 'Dragon Ball',
            rarity: 'rare',
            description: 'Son of Goku with immense hidden power',
            power: 78
        },
        {
            id: 'r003',
            name: 'Zoro',
            anime: 'One Piece',
            rarity: 'rare',
            description: 'Swordsman of the Straw Hat Pirates',
            power: 72
        },
        {
            id: 'r004',
            name: 'Levi Ackerman',
            anime: 'Attack on Titan',
            rarity: 'rare',
            description: "Humanity's strongest soldier",
            power: 80
        },
        {
            id: 'r005',
            name: 'All Might',
            anime: 'My Hero Academia',
            rarity: 'rare',
            description: 'The former #1 Hero and Symbol of Peace',
            power: 79
        },
        
        // Epic cards (4% chance)
        {
            id: 'e001',
            name: 'Naruto Uzumaki',
            anime: 'Naruto',
            rarity: 'epic',
            description: 'The Nine-Tails Jinchuriki and future Hokage',
            power: 90
        },
        {
            id: 'e002',
            name: 'Goku',
            anime: 'Dragon Ball',
            rarity: 'epic',
            description: 'The legendary Super Saiyan',
            power: 92
        },
        {
            id: 'e003',
            name: 'Luffy',
            anime: 'One Piece',
            rarity: 'epic',
            description: 'Captain of the Straw Hat Pirates',
            power: 88
        },
        {
            id: 'e004',
            name: 'Eren Yeager',
            anime: 'Attack on Titan',
            rarity: 'epic',
            description: 'The Attack Titan who seeks freedom',
            power: 86
        },
        {
            id: 'e005',
            name: 'Izuku Midoriya',
            anime: 'My Hero Academia',
            rarity: 'epic',
            description: 'Successor of One For All quirk',
            power: 85
        },
        
        // Legendary cards (1% chance)
        {
            id: 'l001',
            name: 'Madara Uchiha',
            anime: 'Naruto',
            rarity: 'legendary',
            description: 'Legendary Uchiha leader with godlike powers',
            power: 98
        },
        {
            id: 'l002',
            name: 'Ultra Instinct Goku',
            anime: 'Dragon Ball',
            rarity: 'legendary',
            description: 'Goku in his ultimate transformation',
            power: 99
        },
        {
            id: 'l003',
            name: 'Gol D. Roger',
            anime: 'One Piece',
            rarity: 'legendary',
            description: 'The Pirate King who conquered the Grand Line',
            power: 97
        },
        {
            id: 'l004',
            name: 'Founding Titan',
            anime: 'Attack on Titan',
            rarity: 'legendary',
            description: 'The most powerful of all Titans',
            power: 96
        },
        {
            id: 'l005',
            name: 'All For One',
            anime: 'My Hero Academia',
            rarity: 'legendary',
            description: 'The ultimate villain with power-stealing ability',
            power: 95
        }
    ];
    
    return collection;
}

/**
 * Draw a random card based on rarity weights
 * @returns {object} The drawn card
 */
function drawRandomCard() {
    // Calculate total weight
    let totalWeight = 0;
    for (const rarity in RARITY_WEIGHTS) {
        totalWeight += RARITY_WEIGHTS[rarity];
    }
    
    // Generate random number
    const random = Math.floor(Math.random() * totalWeight);
    
    // Determine rarity based on weights
    let selectedRarity;
    let currentWeight = 0;
    
    for (const rarity in RARITY_WEIGHTS) {
        currentWeight += RARITY_WEIGHTS[rarity];
        if (random < currentWeight) {
            selectedRarity = rarity;
            break;
        }
    }
    
    // Get available cards of the selected rarity
    const cardsOfRarity = cardGameState.cardCollection.filter(card => 
        card.rarity === selectedRarity
    );
    
    // If no cards found of this rarity, default to common
    if (cardsOfRarity.length === 0) {
        console.log(`No cards found with rarity: ${selectedRarity}, defaulting to common`);
        return drawRandomCard(); // retry
    }
    
    // Select random card from the filtered list
    const randomIndex = Math.floor(Math.random() * cardsOfRarity.length);
    return cardsOfRarity[randomIndex];
}

/**
 * Generate a new unique card instance from a card template
 * @param {object} card The card template
 * @returns {object} A new card instance with unique ID and timestamp
 */
function generateCardInstance(card) {
    return {
        ...card,
        instanceId: `${card.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        acquiredAt: Date.now()
    };
}

/**
 * Draw a card for a user
 * @param {string} userId User's ID
 * @returns {object} Result with drawn card
 */
function drawCard(userId) {
    // Normalize user ID
    userId = normalizeUserId(userId);
    
    // Check if user has reached daily draw limit
    if (!canDrawCard(userId)) {
        return {
            success: false,
            error: 'daily_limit',
            message: `You've reached your daily card draw limit (${cardSettings.dailyFreeCards}). Try again tomorrow!`
        };
    }
    
    // Draw a random card
    const drawnCard = drawRandomCard();
    const cardInstance = generateCardInstance(drawnCard);
    
    // Initialize user's card collection if it doesn't exist
    if (!cardGameState.playerCards[userId]) {
        cardGameState.playerCards[userId] = [];
    }
    
    // Add card to user's collection
    cardGameState.playerCards[userId].push(cardInstance);
    
    // Initialize user's card history if it doesn't exist
    if (!cardGameState.cardHistory[userId]) {
        cardGameState.cardHistory[userId] = [];
    }
    
    // Add to user's card history
    cardGameState.cardHistory[userId].push({
        cardId: cardInstance.id,
        instanceId: cardInstance.instanceId,
        name: cardInstance.name,
        rarity: cardInstance.rarity,
        timestamp: Date.now()
    });
    
    // Limit history size
    if (cardGameState.cardHistory[userId].length > 100) {
        cardGameState.cardHistory[userId] = cardGameState.cardHistory[userId].slice(-100);
    }
    
    // Update daily draw count
    trackDailyDraw(userId);
    
    // Save game state
    saveCardGameState();
    
    // Award points based on card rarity
    try {
        const pointsSystem = require('./pointsSystem');
        pointsSystem.awardCardPoints(userId, drawnCard.rarity);
    } catch (error) {
        console.error('Error awarding points for card:', error);
    }
    
    return {
        success: true,
        card: cardInstance,
        message: `You drew a ${drawnCard.rarity.toUpperCase()} card: ${drawnCard.name} from ${drawnCard.anime}!`
    };
}

/**
 * Check if a user can draw a card (hasn't reached daily limit)
 * @param {string} userId User's ID
 * @returns {boolean} Whether user can draw a card
 */
function canDrawCard(userId) {
    // Normalize user ID
    userId = normalizeUserId(userId);
    
    // Initialize if not exists
    if (!cardGameState.dailyDraws[userId]) {
        cardGameState.dailyDraws[userId] = {
            count: 0,
            lastDrawTime: 0
        };
        return true;
    }
    
    // Check daily limit
    return cardGameState.dailyDraws[userId].count < cardSettings.dailyFreeCards;
}

/**
 * Track a daily draw for a user
 * @param {string} userId User's ID
 */
function trackDailyDraw(userId) {
    // Normalize user ID
    userId = normalizeUserId(userId);
    
    // Initialize if not exists
    if (!cardGameState.dailyDraws[userId]) {
        cardGameState.dailyDraws[userId] = {
            count: 0,
            lastDrawTime: 0
        };
    }
    
    // Increment count and update timestamp
    cardGameState.dailyDraws[userId].count++;
    cardGameState.dailyDraws[userId].lastDrawTime = Date.now();
}

/**
 * Get a user's card collection
 * @param {string} userId User's ID
 * @returns {array} User's card collection
 */
function getUserCards(userId) {
    // Normalize user ID
    userId = normalizeUserId(userId);
    
    return cardGameState.playerCards[userId] || [];
}

/**
 * Get a user's card count by rarity
 * @param {string} userId User's ID
 * @returns {object} Card counts by rarity
 */
function getUserCardStats(userId) {
    // Normalize user ID
    userId = normalizeUserId(userId);
    
    const cards = getUserCards(userId);
    const stats = {
        total: cards.length,
        byRarity: {
            common: 0,
            uncommon: 0,
            rare: 0,
            epic: 0,
            legendary: 0
        }
    };
    
    // Count cards by rarity
    cards.forEach(card => {
        if (card.rarity in stats.byRarity) {
            stats.byRarity[card.rarity]++;
        }
    });
    
    return stats;
}

/**
 * Get a user's collection completion percentage
 * @param {string} userId User's ID
 * @returns {object} Collection completion stats
 */
function getCollectionCompletion(userId) {
    // Normalize user ID
    userId = normalizeUserId(userId);
    
    const cards = getUserCards(userId);
    const uniqueCardIds = new Set(cards.map(card => card.id));
    
    const totalUniqueCards = new Set(cardGameState.cardCollection.map(card => card.id)).size;
    const userUniqueCards = uniqueCardIds.size;
    
    return {
        uniqueCards: userUniqueCards,
        totalUniqueCards,
        percentage: Math.round((userUniqueCards / totalUniqueCards) * 100)
    };
}

/**
 * Trade a card between users
 * @param {string} fromUserId Sender user ID
 * @param {string} toUserId Receiver user ID
 * @param {string} cardInstanceId Card instance ID to trade
 * @returns {object} Result object with success/error info
 */
function tradeCard(fromUserId, toUserId, cardInstanceId) {
    // Normalize user IDs
    fromUserId = normalizeUserId(fromUserId);
    toUserId = normalizeUserId(toUserId);
    
    // Check if users are the same
    if (fromUserId === toUserId) {
        return {
            success: false,
            error: 'same_user',
            message: "You cannot trade cards with yourself."
        };
    }
    
    // Check if both users exist
    if (!cardGameState.playerCards[fromUserId]) {
        return {
            success: false,
            error: 'sender_no_cards',
            message: "You don't have any cards to trade."
        };
    }
    
    // Initialize receiver cards if needed
    if (!cardGameState.playerCards[toUserId]) {
        cardGameState.playerCards[toUserId] = [];
    }
    
    // Check if receiver has max inventory
    if (cardGameState.playerCards[toUserId].length >= cardSettings.maxInventorySize) {
        return {
            success: false,
            error: 'receiver_inventory_full',
            message: "The receiver's card inventory is full."
        };
    }
    
    // Find the card in sender's collection
    const cardIndex = cardGameState.playerCards[fromUserId].findIndex(
        card => card.instanceId === cardInstanceId
    );
    
    if (cardIndex === -1) {
        return {
            success: false,
            error: 'card_not_found',
            message: "The card you're trying to trade was not found in your collection."
        };
    }
    
    // Get the card
    const card = cardGameState.playerCards[fromUserId][cardIndex];
    
    // Remove from sender
    cardGameState.playerCards[fromUserId].splice(cardIndex, 1);
    
    // Add to receiver
    cardGameState.playerCards[toUserId].push({
        ...card,
        tradedAt: Date.now()
    });
    
    // Log the trade
    cardGameState.tradeLogs.push({
        fromUser: fromUserId,
        toUser: toUserId,
        cardId: card.id,
        cardInstanceId: card.instanceId,
        cardName: card.name,
        cardRarity: card.rarity,
        timestamp: Date.now()
    });
    
    // Limit trade logs size
    if (cardGameState.tradeLogs.length > 1000) {
        cardGameState.tradeLogs = cardGameState.tradeLogs.slice(-1000);
    }
    
    // Save state
    saveCardGameState();
    
    return {
        success: true,
        card,
        message: `Successfully traded ${card.rarity} card "${card.name}" from ${fromUserId.split('@')[0]} to ${toUserId.split('@')[0]}.`
    };
}

/**
 * Generate a card showcase message
 * @param {string} userId User ID
 * @returns {string} Formatted showcase message
 */
function generateCardShowcase(userId) {
    // Normalize user ID
    userId = normalizeUserId(userId);
    
    const cards = getUserCards(userId);
    const stats = getUserCardStats(userId);
    const completion = getCollectionCompletion(userId);
    
    // Create empty showcase if no cards
    if (cards.length === 0) {
        return `*@${userId.split('@')[0]}'s Card Collection*\n\nNo cards collected yet. Use .card draw to get your first card!`;
    }
    
    // Find rarest cards (up to 5)
    const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    const bestCards = [...cards].sort((a, b) => {
        return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
    }).slice(0, 5);
    
    // Create showcase message
    let message = `*@${userId.split('@')[0]}'s Card Collection*\n\n`;
    message += `*Collection stats:*\n`;
    message += `Total cards: ${stats.total}\n`;
    message += `Unique cards: ${completion.uniqueCards}/${completion.totalUniqueCards} (${completion.percentage}% complete)\n\n`;
    
    message += `*Cards by rarity:*\n`;
    message += `⭐ Common: ${stats.byRarity.common}\n`;
    message += `⭐⭐ Uncommon: ${stats.byRarity.uncommon}\n`;
    message += `⭐⭐⭐ Rare: ${stats.byRarity.rare}\n`;
    message += `⭐⭐⭐⭐ Epic: ${stats.byRarity.epic}\n`;
    message += `⭐⭐⭐⭐⭐ Legendary: ${stats.byRarity.legendary}\n\n`;
    
    message += `*Best cards:*\n`;
    bestCards.forEach((card, index) => {
        let rarityStars = '';
        switch (card.rarity) {
            case 'common': rarityStars = '⭐'; break;
            case 'uncommon': rarityStars = '⭐⭐'; break;
            case 'rare': rarityStars = '⭐⭐⭐'; break;
            case 'epic': rarityStars = '⭐⭐⭐⭐'; break;
            case 'legendary': rarityStars = '⭐⭐⭐⭐⭐'; break;
        }
        
        message += `${index + 1}. ${rarityStars} ${card.name} (${card.anime}) - Power: ${card.power}\n`;
    });
    
    return message;
}

/**
 * Normalize user ID to consistent format
 * @param {string} userId User ID or phone number
 * @returns {string} Normalized user ID
 */
function normalizeUserId(userId) {
    // Remove the WhatsApp suffix if present
    if (userId.includes('@')) {
        userId = userId.split('@')[0];
    }
    
    // Remove any + prefix if present
    if (userId.startsWith('+')) {
        userId = userId.substring(1);
    }
    
    return userId;
}

module.exports = {
    initialize,
    drawCard,
    getUserCards,
    getUserCardStats,
    getCollectionCompletion,
    tradeCard,
    generateCardShowcase,
    canDrawCard
};