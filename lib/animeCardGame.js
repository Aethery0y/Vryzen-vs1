/**
 * Anime Card Game Module
 * A simple card game featuring anime characters with stats
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const pointsSystem = require('./pointsSystem');

// File for storing card data
const CARDS_DATA_FILE = path.join(config.databaseDir, 'animeCards.json');
const USER_CARDS_FILE = path.join(config.databaseDir, 'userCards.json');

// Active card battles
const activeBattles = new Map();

// Card rarities
const RARITIES = {
    COMMON: { id: 'common', name: 'Common', chance: 0.60, color: '⚪', boost: 1.0 },
    UNCOMMON: { id: 'uncommon', name: 'Uncommon', chance: 0.25, color: '🟢', boost: 1.2 },
    RARE: { id: 'rare', name: 'Rare', chance: 0.10, color: '🔵', boost: 1.5 },
    EPIC: { id: 'epic', name: 'Epic', chance: 0.04, color: '🟣', boost: 2.0 },
    LEGENDARY: { id: 'legendary', name: 'Legendary', chance: 0.01, color: '🟡', boost: 3.0 }
};

// Card stats
const STATS = {
    POWER: 'power',
    SPEED: 'speed',
    INTELLIGENCE: 'intelligence',
    SPECIAL: 'special'
};

// Default anime cards
const DEFAULT_CARDS = [
    // COMMON cards
    {
        id: 'c001',
        name: 'Naruto Uzumaki',
        anime: 'Naruto',
        rarity: RARITIES.COMMON.id,
        stats: {
            [STATS.POWER]: 75,
            [STATS.SPEED]: 70,
            [STATS.INTELLIGENCE]: 45,
            [STATS.SPECIAL]: 85
        }
    },
    {
        id: 'c002',
        name: 'Monkey D. Luffy',
        anime: 'One Piece',
        rarity: RARITIES.COMMON.id,
        stats: {
            [STATS.POWER]: 85,
            [STATS.SPEED]: 75,
            [STATS.INTELLIGENCE]: 40,
            [STATS.SPECIAL]: 80
        }
    },
    {
        id: 'c003',
        name: 'Goku',
        anime: 'Dragon Ball',
        rarity: RARITIES.COMMON.id,
        stats: {
            [STATS.POWER]: 90,
            [STATS.SPEED]: 85,
            [STATS.INTELLIGENCE]: 50,
            [STATS.SPECIAL]: 90
        }
    },
    
    // UNCOMMON cards
    {
        id: 'u001',
        name: 'Kakashi Hatake',
        anime: 'Naruto',
        rarity: RARITIES.UNCOMMON.id,
        stats: {
            [STATS.POWER]: 70,
            [STATS.SPEED]: 80,
            [STATS.INTELLIGENCE]: 90,
            [STATS.SPECIAL]: 85
        }
    },
    {
        id: 'u002',
        name: 'Roronoa Zoro',
        anime: 'One Piece',
        rarity: RARITIES.UNCOMMON.id,
        stats: {
            [STATS.POWER]: 85,
            [STATS.SPEED]: 75,
            [STATS.INTELLIGENCE]: 60,
            [STATS.SPECIAL]: 80
        }
    },
    {
        id: 'u003',
        name: 'Vegeta',
        anime: 'Dragon Ball',
        rarity: RARITIES.UNCOMMON.id,
        stats: {
            [STATS.POWER]: 85,
            [STATS.SPEED]: 80,
            [STATS.INTELLIGENCE]: 75,
            [STATS.SPECIAL]: 80
        }
    },
    
    // RARE cards
    {
        id: 'r001',
        name: 'Itachi Uchiha',
        anime: 'Naruto',
        rarity: RARITIES.RARE.id,
        stats: {
            [STATS.POWER]: 85,
            [STATS.SPEED]: 80,
            [STATS.INTELLIGENCE]: 95,
            [STATS.SPECIAL]: 90
        }
    },
    {
        id: 'r002',
        name: 'Trafalgar Law',
        anime: 'One Piece',
        rarity: RARITIES.RARE.id,
        stats: {
            [STATS.POWER]: 75,
            [STATS.SPEED]: 80,
            [STATS.INTELLIGENCE]: 90,
            [STATS.SPECIAL]: 90
        }
    },
    {
        id: 'r003',
        name: 'Piccolo',
        anime: 'Dragon Ball',
        rarity: RARITIES.RARE.id,
        stats: {
            [STATS.POWER]: 75,
            [STATS.SPEED]: 70,
            [STATS.INTELLIGENCE]: 95,
            [STATS.SPECIAL]: 85
        }
    },
    
    // EPIC cards
    {
        id: 'e001',
        name: 'Madara Uchiha',
        anime: 'Naruto',
        rarity: RARITIES.EPIC.id,
        stats: {
            [STATS.POWER]: 95,
            [STATS.SPEED]: 90,
            [STATS.INTELLIGENCE]: 95,
            [STATS.SPECIAL]: 98
        }
    },
    {
        id: 'e002',
        name: 'Shanks',
        anime: 'One Piece',
        rarity: RARITIES.EPIC.id,
        stats: {
            [STATS.POWER]: 95,
            [STATS.SPEED]: 90,
            [STATS.INTELLIGENCE]: 90,
            [STATS.SPECIAL]: 95
        }
    },
    {
        id: 'e003',
        name: 'Beerus',
        anime: 'Dragon Ball',
        rarity: RARITIES.EPIC.id,
        stats: {
            [STATS.POWER]: 95,
            [STATS.SPEED]: 90,
            [STATS.INTELLIGENCE]: 90,
            [STATS.SPECIAL]: 95
        }
    },
    
    // LEGENDARY cards
    {
        id: 'l001',
        name: 'Six Paths Sage Naruto',
        anime: 'Naruto',
        rarity: RARITIES.LEGENDARY.id,
        stats: {
            [STATS.POWER]: 99,
            [STATS.SPEED]: 95,
            [STATS.INTELLIGENCE]: 90,
            [STATS.SPECIAL]: 99
        }
    },
    {
        id: 'l002',
        name: 'Gol D. Roger',
        anime: 'One Piece',
        rarity: RARITIES.LEGENDARY.id,
        stats: {
            [STATS.POWER]: 99,
            [STATS.SPEED]: 90,
            [STATS.INTELLIGENCE]: 95,
            [STATS.SPECIAL]: 99
        }
    },
    {
        id: 'l003',
        name: 'Ultra Instinct Goku',
        anime: 'Dragon Ball',
        rarity: RARITIES.LEGENDARY.id,
        stats: {
            [STATS.POWER]: 99,
            [STATS.SPEED]: 99,
            [STATS.INTELLIGENCE]: 90,
            [STATS.SPECIAL]: 99
        }
    },
    
    // More characters from other anime
    {
        id: 'c004',
        name: 'Tanjiro Kamado',
        anime: 'Demon Slayer',
        rarity: RARITIES.COMMON.id,
        stats: {
            [STATS.POWER]: 75,
            [STATS.SPEED]: 80,
            [STATS.INTELLIGENCE]: 70,
            [STATS.SPECIAL]: 75
        }
    },
    {
        id: 'u004',
        name: 'Zenitsu Agatsuma',
        anime: 'Demon Slayer',
        rarity: RARITIES.UNCOMMON.id,
        stats: {
            [STATS.POWER]: 65,
            [STATS.SPEED]: 95,
            [STATS.INTELLIGENCE]: 60,
            [STATS.SPECIAL]: 80
        }
    },
    {
        id: 'r004',
        name: 'Kyojuro Rengoku',
        anime: 'Demon Slayer',
        rarity: RARITIES.RARE.id,
        stats: {
            [STATS.POWER]: 90,
            [STATS.SPEED]: 85,
            [STATS.INTELLIGENCE]: 80,
            [STATS.SPECIAL]: 90
        }
    },
    {
        id: 'e004',
        name: 'Yorichi Tsugikuni',
        anime: 'Demon Slayer',
        rarity: RARITIES.EPIC.id,
        stats: {
            [STATS.POWER]: 95,
            [STATS.SPEED]: 95,
            [STATS.INTELLIGENCE]: 90,
            [STATS.SPECIAL]: 98
        }
    },
    {
        id: 'c005',
        name: 'Izuku Midoriya',
        anime: 'My Hero Academia',
        rarity: RARITIES.COMMON.id,
        stats: {
            [STATS.POWER]: 75,
            [STATS.SPEED]: 70,
            [STATS.INTELLIGENCE]: 80,
            [STATS.SPECIAL]: 70
        }
    },
    {
        id: 'u005',
        name: 'Shoto Todoroki',
        anime: 'My Hero Academia',
        rarity: RARITIES.UNCOMMON.id,
        stats: {
            [STATS.POWER]: 85,
            [STATS.SPEED]: 75,
            [STATS.INTELLIGENCE]: 80,
            [STATS.SPECIAL]: 85
        }
    },
    {
        id: 'r005',
        name: 'All Might',
        anime: 'My Hero Academia',
        rarity: RARITIES.RARE.id,
        stats: {
            [STATS.POWER]: 95,
            [STATS.SPEED]: 85,
            [STATS.INTELLIGENCE]: 80,
            [STATS.SPECIAL]: 90
        }
    },
    {
        id: 'l004',
        name: 'Muzan Kibutsuji',
        anime: 'Demon Slayer',
        rarity: RARITIES.LEGENDARY.id,
        stats: {
            [STATS.POWER]: 98,
            [STATS.SPEED]: 95,
            [STATS.INTELLIGENCE]: 99,
            [STATS.SPECIAL]: 99
        }
    }
];

// In-memory data
let allCards = [...DEFAULT_CARDS];
let userCards = {};

/**
 * Initialize the anime card game module
 */
function initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(config.databaseDir)) {
        fs.mkdirSync(config.databaseDir, { recursive: true });
    }
    
    // Load cards data
    if (fs.existsSync(CARDS_DATA_FILE)) {
        try {
            allCards = JSON.parse(fs.readFileSync(CARDS_DATA_FILE, 'utf8'));
            console.log('Anime Card Game: Cards loaded successfully');
        } catch (error) {
            console.error('Anime Card Game: Error loading cards:', error);
            allCards = [...DEFAULT_CARDS];
        }
    } else {
        // First time, save default cards
        saveCardsData();
        console.log('Anime Card Game: Created default cards');
    }
    
    // Load user cards
    if (fs.existsSync(USER_CARDS_FILE)) {
        try {
            userCards = JSON.parse(fs.readFileSync(USER_CARDS_FILE, 'utf8'));
            console.log('Anime Card Game: User cards loaded successfully');
        } catch (error) {
            console.error('Anime Card Game: Error loading user cards:', error);
            userCards = {};
        }
    }
    
    return true;
}

/**
 * Save cards data to file
 */
function saveCardsData() {
    try {
        fs.writeFileSync(CARDS_DATA_FILE, JSON.stringify(allCards, null, 2));
    } catch (error) {
        console.error('Anime Card Game: Error saving cards data:', error);
    }
}

/**
 * Save user cards to file
 */
function saveUserCards() {
    try {
        fs.writeFileSync(USER_CARDS_FILE, JSON.stringify(userCards, null, 2));
    } catch (error) {
        console.error('Anime Card Game: Error saving user cards:', error);
    }
}

/**
 * Get a random card based on rarity chances
 * @returns {object} A random card
 */
function getRandomCard() {
    // Determine rarity based on chances
    const rarityRoll = Math.random();
    let selectedRarity;
    
    let cumulativeChance = 0;
    for (const rarity of Object.values(RARITIES)) {
        cumulativeChance += rarity.chance;
        if (rarityRoll <= cumulativeChance) {
            selectedRarity = rarity.id;
            break;
        }
    }
    
    // Fallback to common if somehow no rarity was selected
    if (!selectedRarity) {
        selectedRarity = RARITIES.COMMON.id;
    }
    
    // Get all cards of the selected rarity
    const cardsOfRarity = allCards.filter(card => card.rarity === selectedRarity);
    
    // If no cards of this rarity exist, get a common card
    if (cardsOfRarity.length === 0) {
        return getRandomCard(); // Try again
    }
    
    // Return a random card of the selected rarity
    return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
}

/**
 * Draw a card for a user
 * @param {string} userId - The user ID
 * @returns {object} Draw result with the card
 */
function drawCard(userId) {
    // Clean userId
    const cleanUserId = userId.split('@')[0];
    
    // Initialize user cards collection if not exists
    if (!userCards[cleanUserId]) {
        userCards[cleanUserId] = {
            cards: [],
            lastDraw: 0,
            drawCount: 0
        };
    }
    
    const user = userCards[cleanUserId];
    
    // Check if user can draw (cooldown: 1 hour)
    const now = Date.now();
    const cooldown = 60 * 60 * 1000; // 1 hour
    
    if (now - user.lastDraw < cooldown) {
        const timeLeft = cooldown - (now - user.lastDraw);
        const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
        
        return {
            success: false,
            error: `You can draw a new card in ${minutesLeft} minutes.`,
            nextDrawTime: new Date(user.lastDraw + cooldown).toLocaleString()
        };
    }
    
    // Draw a random card
    const drawnCard = getRandomCard();
    
    // Add the card to user's collection
    user.cards.push({
        id: drawnCard.id,
        obtainedAt: now
    });
    
    // Update user's draw stats
    user.lastDraw = now;
    user.drawCount++;
    
    // Save user cards data
    saveUserCards();
    
    // Get rarity info
    const rarityInfo = Object.values(RARITIES).find(r => r.id === drawnCard.rarity);
    
    // Award points based on card rarity
    let pointsAwarded = 0;
    switch (drawnCard.rarity) {
        case RARITIES.COMMON.id:
            pointsAwarded = 5;
            break;
        case RARITIES.UNCOMMON.id:
            pointsAwarded = 10;
            break;
        case RARITIES.RARE.id:
            pointsAwarded = 20;
            break;
        case RARITIES.EPIC.id:
            pointsAwarded = 50;
            break;
        case RARITIES.LEGENDARY.id:
            pointsAwarded = 100;
            break;
    }
    
    // Award points for getting this card
    if (pointsAwarded > 0) {
        pointsSystem.awardPoints(cleanUserId, 'COMMAND', null);
        // Add bonus points based on rarity
        userCards[cleanUserId].total += pointsAwarded;
    }
    
    return {
        success: true,
        card: drawnCard,
        newCard: true,
        rarity: rarityInfo,
        collectionSize: user.cards.length,
        drawCount: user.drawCount,
        pointsAwarded: pointsAwarded
    };
}

/**
 * Format a card for display
 * @param {object} card - The card object
 * @returns {string} Formatted card text
 */
function formatCard(card) {
    // Get rarity info
    const rarityInfo = Object.values(RARITIES).find(r => r.id === card.rarity);
    
    // Format the card stats
    let statsText = '';
    for (const [stat, value] of Object.entries(card.stats)) {
        const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
        statsText += `• ${statName}: ${value}\n`;
    }
    
    return `${rarityInfo.color} *${rarityInfo.name}* ${rarityInfo.color}\n*${card.name}*\nFrom: ${card.anime}\n\n${statsText}`;
}

/**
 * Get a user's card collection
 * @param {string} userId - The user ID
 * @returns {object} User's card collection
 */
function getUserCards(userId) {
    // Clean userId
    const cleanUserId = userId.split('@')[0];
    
    // If user doesn't exist, return empty collection
    if (!userCards[cleanUserId]) {
        return {
            success: true,
            userId: cleanUserId,
            cards: [],
            drawCount: 0,
            lastDraw: null,
            nextDraw: null,
            stats: { total: 0, common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
        };
    }
    
    const user = userCards[cleanUserId];
    
    // Get full card details for each card in collection
    const userCardDetails = user.cards.map(userCard => {
        return allCards.find(c => c.id === userCard.id);
    }).filter(Boolean); // Remove any undefined (in case a card was removed from allCards)
    
    // Calculate rarity stats
    const stats = {
        total: userCardDetails.length,
        common: userCardDetails.filter(c => c.rarity === RARITIES.COMMON.id).length,
        uncommon: userCardDetails.filter(c => c.rarity === RARITIES.UNCOMMON.id).length,
        rare: userCardDetails.filter(c => c.rarity === RARITIES.RARE.id).length,
        epic: userCardDetails.filter(c => c.rarity === RARITIES.EPIC.id).length,
        legendary: userCardDetails.filter(c => c.rarity === RARITIES.LEGENDARY.id).length
    };
    
    // Calculate next draw time
    const cooldown = 60 * 60 * 1000; // 1 hour
    const nextDraw = user.lastDraw ? new Date(user.lastDraw + cooldown) : new Date();
    
    return {
        success: true,
        userId: cleanUserId,
        cards: userCardDetails,
        drawCount: user.drawCount || 0,
        lastDraw: user.lastDraw ? new Date(user.lastDraw) : null,
        nextDraw: nextDraw,
        canDraw: Date.now() >= (user.lastDraw + cooldown),
        stats: stats
    };
}

/**
 * Start a card battle between two users
 * @param {string} chatId - The chat ID
 * @param {string} challengerId - User ID of the challenger
 * @param {string} opponentId - User ID of the opponent
 * @returns {object} Battle initialization result
 */
function startBattle(chatId, challengerId, opponentId) {
    // Clean user IDs
    const cleanChallengerId = challengerId.split('@')[0];
    const cleanOpponentId = opponentId.split('@')[0];
    
    // Check if there's already an active battle in this chat
    if (activeBattles.has(chatId)) {
        return { 
            success: false, 
            error: 'There is already an active battle in this chat.'
        };
    }
    
    // Check if both users have cards
    const challengerCollection = getUserCards(cleanChallengerId);
    const opponentCollection = getUserCards(cleanOpponentId);
    
    if (challengerCollection.cards.length === 0) {
        return { 
            success: false, 
            error: 'You don\'t have any cards to battle with. Draw some cards first with .drawcard'
        };
    }
    
    if (opponentCollection.cards.length === 0) {
        return { 
            success: false, 
            error: 'Your opponent doesn\'t have any cards to battle with.'
        };
    }
    
    // Create a new battle session
    const battleSession = {
        chatId: chatId,
        challenger: cleanChallengerId,
        opponent: cleanOpponentId,
        status: 'pending', // pending, accepted, complete
        startTime: Date.now(),
        expireTime: Date.now() + (5 * 60 * 1000), // 5 minutes to accept
        challengerCard: null,
        opponentCard: null,
        selectedStat: null,
        winner: null
    };
    
    // Store the battle session
    activeBattles.set(chatId, battleSession);
    
    // Set a timeout to expire the battle if not accepted
    setTimeout(() => {
        const session = activeBattles.get(chatId);
        if (session && session.status === 'pending') {
            activeBattles.delete(chatId);
        }
    }, 5 * 60 * 1000);
    
    return {
        success: true,
        challenger: cleanChallengerId,
        opponent: cleanOpponentId,
        challengerCardCount: challengerCollection.cards.length,
        opponentCardCount: opponentCollection.cards.length,
        expireTime: new Date(battleSession.expireTime).toLocaleString()
    };
}

/**
 * Accept a card battle
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user ID accepting the battle
 * @returns {object} Battle acceptance result
 */
function acceptBattle(chatId, userId) {
    // Clean user ID
    const cleanUserId = userId.split('@')[0];
    
    // Check if there's an active battle in this chat
    if (!activeBattles.has(chatId)) {
        return { 
            success: false, 
            error: 'There is no active battle to accept in this chat.'
        };
    }
    
    const battle = activeBattles.get(chatId);
    
    // Check if the user is the opponent
    if (battle.opponent !== cleanUserId) {
        return { 
            success: false, 
            error: 'Only the challenged player can accept this battle.'
        };
    }
    
    // Check if the battle is still pending
    if (battle.status !== 'pending') {
        return { 
            success: false, 
            error: 'This battle has already been accepted or is complete.'
        };
    }
    
    // Check if the battle has expired
    if (Date.now() > battle.expireTime) {
        activeBattles.delete(chatId);
        return { 
            success: false, 
            error: 'This battle challenge has expired. Start a new one.'
        };
    }
    
    // Get random cards for both players
    const challengerCollection = getUserCards(battle.challenger);
    const opponentCollection = getUserCards(battle.opponent);
    
    const challengerCard = challengerCollection.cards[Math.floor(Math.random() * challengerCollection.cards.length)];
    const opponentCard = opponentCollection.cards[Math.floor(Math.random() * opponentCollection.cards.length)];
    
    // Update battle status
    battle.status = 'accepted';
    battle.challengerCard = challengerCard;
    battle.opponentCard = opponentCard;
    
    // The challenger gets to select the stat to battle with
    
    return {
        success: true,
        challengerCard: challengerCard,
        opponentCard: opponentCard
    };
}

/**
 * Select a stat for battle
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user ID selecting the stat
 * @param {string} stat - The stat to battle with
 * @returns {object} Battle result
 */
function selectBattleStat(chatId, userId, stat) {
    // Clean user ID
    const cleanUserId = userId.split('@')[0];
    
    // Check if there's an active battle in this chat
    if (!activeBattles.has(chatId)) {
        return { 
            success: false, 
            error: 'There is no active battle in this chat.'
        };
    }
    
    const battle = activeBattles.get(chatId);
    
    // Check if the user is the challenger
    if (battle.challenger !== cleanUserId) {
        return { 
            success: false, 
            error: 'Only the challenger can select the battle stat.'
        };
    }
    
    // Check if the battle is in the right status
    if (battle.status !== 'accepted') {
        return { 
            success: false, 
            error: 'This battle is not ready for stat selection.'
        };
    }
    
    // Validate the stat
    if (!Object.values(STATS).includes(stat.toLowerCase())) {
        return { 
            success: false, 
            error: 'Invalid stat. Choose from: power, speed, intelligence, special.'
        };
    }
    
    // Get the cards
    const challengerCard = battle.challengerCard;
    const opponentCard = battle.opponentCard;
    
    // Get the rarity boosts
    const challengerRarity = Object.values(RARITIES).find(r => r.id === challengerCard.rarity);
    const opponentRarity = Object.values(RARITIES).find(r => r.id === opponentCard.rarity);
    
    // Calculate the stat values with rarity boosts
    const statKey = stat.toLowerCase();
    const challengerStatValue = challengerCard.stats[statKey] * challengerRarity.boost;
    const opponentStatValue = opponentCard.stats[statKey] * opponentRarity.boost;
    
    // Determine the winner
    let winnerId = null;
    if (challengerStatValue > opponentStatValue) {
        winnerId = battle.challenger;
    } else if (opponentStatValue > challengerStatValue) {
        winnerId = battle.opponent;
    }
    // If tie, no winner
    
    // Update battle status
    battle.status = 'complete';
    battle.selectedStat = statKey;
    battle.winner = winnerId;
    
    // Award points to the winner
    if (winnerId) {
        pointsSystem.awardPoints(winnerId, 'GROUP_GAME', chatId);
    }
    
    // Remove the battle after completion
    setTimeout(() => {
        activeBattles.delete(chatId);
    }, 60 * 1000);
    
    return {
        success: true,
        challengerCard: challengerCard,
        opponentCard: opponentCard,
        selectedStat: statKey,
        challengerStatValue: Math.round(challengerStatValue),
        opponentStatValue: Math.round(opponentStatValue),
        winner: winnerId,
        isDraw: !winnerId
    };
}

module.exports = {
    initialize,
    drawCard,
    getUserCards,
    formatCard,
    startBattle,
    acceptBattle,
    selectBattleStat,
    RARITIES,
    STATS
};