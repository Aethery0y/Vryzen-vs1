/**
 * Anime Betting System Module for WhatsApp Bot
 * Allows users to create and participate in anime-themed betting games
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const pointsSystem = require('./pointsSystem');
const { v4: uuidv4 } = require('uuid');

// Data storage
let bettingGames = {}; // Stores all active betting games
let userBets = {}; // Stores individual user bets
let userStats = {}; // Stores user betting statistics

// File paths
const BETTING_GAMES_FILE = path.join(config.databaseDir, 'bettingGames.json');
const USER_BETS_FILE = path.join(config.databaseDir, 'userBets.json');
const USER_STATS_FILE = path.join(config.databaseDir, 'bettingStats.json');

// Bet types with their options and descriptions
const BET_TYPES = {
    'character_death': {
        description: 'Bet on whether a character will die in the next episode',
        options: ['yes', 'no']
    },
    'battle_winner': {
        description: 'Bet on which character will win an upcoming battle',
        options: [] // Dynamic options based on the characters specified when creating the bet
    },
    'plot_twist': {
        description: 'Bet on whether a major plot twist will happen',
        options: ['yes', 'no']
    },
    'ship': {
        description: 'Bet on whether two characters will become a couple',
        options: ['yes', 'no']
    },
    'power_up': {
        description: 'Bet on whether a character will get a power up',
        options: ['yes', 'no']
    },
    'new_villain': {
        description: 'Bet on whether a new villain will appear',
        options: ['yes', 'no']
    },
    'tournament': {
        description: 'Bet on which character will win a tournament',
        options: [] // Dynamic options
    },
    'custom': {
        description: 'Custom betting scenario with user-defined options',
        options: [] // Dynamic options
    }
};

/**
 * Initialize the betting system
 */
function initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(config.databaseDir)) {
        fs.mkdirSync(config.databaseDir, { recursive: true });
    }

    // Load betting games data
    try {
        if (fs.existsSync(BETTING_GAMES_FILE)) {
            const data = fs.readFileSync(BETTING_GAMES_FILE, 'utf8');
            bettingGames = JSON.parse(data);
            console.log('Betting system: Loaded betting games data');
        } else {
            console.log('Betting system: No existing betting games data found, starting fresh');
            saveBettingGamesData();
        }
    } catch (error) {
        console.error('Betting system: Error loading betting games data', error);
        bettingGames = {};
        saveBettingGamesData();
    }

    // Load user bets data
    try {
        if (fs.existsSync(USER_BETS_FILE)) {
            const data = fs.readFileSync(USER_BETS_FILE, 'utf8');
            userBets = JSON.parse(data);
            console.log('Betting system: Loaded user bets data');
        } else {
            console.log('Betting system: No existing user bets data found, starting fresh');
            saveUserBetsData();
        }
    } catch (error) {
        console.error('Betting system: Error loading user bets data', error);
        userBets = {};
        saveUserBetsData();
    }

    // Load user stats data
    try {
        if (fs.existsSync(USER_STATS_FILE)) {
            const data = fs.readFileSync(USER_STATS_FILE, 'utf8');
            userStats = JSON.parse(data);
            console.log('Betting system: Loaded user stats data');
        } else {
            console.log('Betting system: No existing user stats data found, starting fresh');
            saveUserStatsData();
        }
    } catch (error) {
        console.error('Betting system: Error loading user stats data', error);
        userStats = {};
        saveUserStatsData();
    }

    // Schedule cleanup of expired betting games
    scheduleCleanup();
}

/**
 * Schedule cleanup of expired betting games
 */
function scheduleCleanup() {
    // Check for expired games every hour
    setInterval(() => {
        const now = Date.now();
        const expiredGames = Object.entries(bettingGames)
            .filter(([id, game]) => !game.ended && now > game.expiresAt)
            .map(([id]) => id);

        expiredGames.forEach(gameId => {
            // Auto-close expired games
            endBettingGame(gameId, null, 'expired');
        });
    }, 3600000); // 1 hour
}

/**
 * Save betting games data to file
 */
function saveBettingGamesData() {
    fs.writeFileSync(BETTING_GAMES_FILE, JSON.stringify(bettingGames, null, 2));
}

/**
 * Save user bets data to file
 */
function saveUserBetsData() {
    fs.writeFileSync(USER_BETS_FILE, JSON.stringify(userBets, null, 2));
}

/**
 * Save user betting stats data to file
 */
function saveUserStatsData() {
    fs.writeFileSync(USER_STATS_FILE, JSON.stringify(userStats, null, 2));
}

/**
 * Create a new betting game
 * @param {string} creatorId ID of the user creating the bet
 * @param {string} groupId Group ID where the bet is created
 * @param {string} type Type of bet (from BET_TYPES)
 * @param {string} title Title/subject of the bet
 * @param {Array} options Betting options if custom type
 * @param {number} multiplier Payout multiplier (default from config)
 * @returns {object} Result object with game details or error
 */
function createBettingGame(creatorId, groupId, type, title, options = [], multiplier = null) {
    // Normalize IDs
    creatorId = pointsSystem.normalizeUserId(creatorId);
    
    // Validate bet type
    if (!BET_TYPES[type]) {
        return {
            success: false,
            error: 'invalid_bet_type',
            message: `Invalid bet type. Available types: ${Object.keys(BET_TYPES).join(', ')}`
        };
    }

    // Get betting options based on type
    let betOptions = [...(BET_TYPES[type].options || [])];
    
    // For custom type or types with dynamic options, use provided options
    if (type === 'custom' || betOptions.length === 0) {
        if (!options || options.length < 2) {
            return {
                success: false,
                error: 'insufficient_options',
                message: 'You must provide at least two betting options for this type of bet.'
            };
        }
        betOptions = options;
    }

    // Set payout multiplier
    const payoutMultiplier = multiplier || config.animeGames.betting.defaultMultiplier;

    // Generate unique ID for the betting game
    const gameId = generateShortId();
    
    // Set expiry time
    const expiryHours = config.animeGames.betting.gameExpiry;
    const expiresAt = Date.now() + (expiryHours * 60 * 60 * 1000);

    // Create the betting game
    const newGame = {
        id: gameId,
        creatorId,
        groupId,
        type,
        title,
        options: betOptions,
        multiplier: payoutMultiplier,
        createdAt: Date.now(),
        expiresAt,
        bets: {},
        totalBets: 0,
        totalAmount: 0,
        ended: false,
        winner: null,
        outcome: null
    };

    // Add to betting games
    bettingGames[gameId] = newGame;
    
    // Save data
    saveBettingGamesData();

    return {
        success: true,
        gameId,
        game: newGame,
        message: `Betting game created! ID: ${gameId}`
    };
}

/**
 * Place a bet on a game
 * @param {string} userId User ID placing the bet
 * @param {string} gameId ID of the betting game
 * @param {string} option Option to bet on
 * @param {number} amount Amount of points to bet
 * @returns {object} Result object with bet details or error
 */
function placeBet(userId, gameId, option, amount) {
    // Normalize userId
    userId = pointsSystem.normalizeUserId(userId);
    
    // Validate amount
    if (isNaN(amount) || amount < config.animeGames.betting.minBetAmount) {
        return {
            success: false,
            error: 'invalid_amount',
            message: `Minimum bet amount is ${config.animeGames.betting.minBetAmount} points.`
        };
    }
    
    if (amount > config.animeGames.betting.maxBetAmount) {
        return {
            success: false,
            error: 'invalid_amount',
            message: `Maximum bet amount is ${config.animeGames.betting.maxBetAmount} points.`
        };
    }
    
    // Validate game exists and is active
    if (!bettingGames[gameId]) {
        return {
            success: false,
            error: 'game_not_found',
            message: 'Betting game not found.'
        };
    }
    
    const game = bettingGames[gameId];
    
    if (game.ended) {
        return {
            success: false,
            error: 'game_ended',
            message: 'This betting game has already ended.'
        };
    }
    
    // Validate option is valid for this game
    if (!game.options.includes(option)) {
        return {
            success: false,
            error: 'invalid_option',
            message: `Invalid option. Available options: ${game.options.join(', ')}`
        };
    }
    
    // Check if user has enough points
    const userPointsResult = pointsSystem.getUserPoints(userId);
    if (userPointsResult < amount) {
        return {
            success: false,
            error: 'insufficient_points',
            message: `You don't have enough points. You have ${userPointsResult} but need ${amount}.`
        };
    }
    
    // Check if user already bet on this game
    if (game.bets[userId]) {
        return {
            success: false,
            error: 'already_bet',
            message: 'You have already placed a bet on this game.'
        };
    }
    
    // Deduct points from user
    const deductResult = pointsSystem.deductPoints(userId, amount, `bet_on_${gameId}`);
    if (!deductResult.success) {
        return deductResult; // Return the error from points system
    }
    
    // Record the bet
    game.bets[userId] = {
        userId,
        option,
        amount,
        timestamp: Date.now()
    };
    
    // Update totals
    game.totalBets++;
    game.totalAmount += amount;
    
    // Update user bets record
    if (!userBets[userId]) {
        userBets[userId] = [];
    }
    userBets[userId].push({
        gameId,
        option,
        amount,
        timestamp: Date.now()
    });
    
    // Update user stats
    if (!userStats[userId]) {
        userStats[userId] = {
            totalBets: 0,
            totalAmount: 0,
            wins: 0,
            losses: 0,
            totalWinnings: 0,
            totalLosses: 0
        };
    }
    userStats[userId].totalBets++;
    userStats[userId].totalAmount += amount;
    
    // Save data
    saveBettingGamesData();
    saveUserBetsData();
    saveUserStatsData();
    
    return {
        success: true,
        gameId,
        option,
        amount,
        currentPoints: deductResult.currentPoints,
        message: `Bet placed! You bet ${amount} points on "${option}".`
    };
}

/**
 * End a betting game and distribute winnings
 * @param {string} gameId ID of the betting game
 * @param {string} winningOption The winning option
 * @param {string} reason Reason for ending (optional)
 * @returns {object} Result object with outcome details or error
 */
function endBettingGame(gameId, winningOption, reason = null) {
    // Validate game exists
    if (!bettingGames[gameId]) {
        return {
            success: false,
            error: 'game_not_found',
            message: 'Betting game not found.'
        };
    }
    
    const game = bettingGames[gameId];
    
    // Check if game already ended
    if (game.ended) {
        return {
            success: false,
            error: 'game_already_ended',
            message: 'This betting game has already ended.'
        };
    }
    
    // Handle case for expired games
    if (reason === 'expired' && !winningOption) {
        // For expired games with no specified winner, refund all bets
        game.ended = true;
        game.outcome = 'expired';
        
        // Refund all bets
        const refundResults = Object.entries(game.bets).map(([userId, bet]) => {
            const refundResult = pointsSystem.addPoints(userId, bet.amount, 'bet_refund');
            return {
                userId,
                refunded: bet.amount,
                success: refundResult.success
            };
        });
        
        // Save changes
        saveBettingGamesData();
        
        return {
            success: true,
            gameId,
            outcome: 'expired',
            message: 'Game expired. All bets have been refunded.',
            refunds: refundResults
        };
    }
    
    // Validate winning option
    if (!game.options.includes(winningOption)) {
        return {
            success: false,
            error: 'invalid_option',
            message: `Invalid winning option. Available options: ${game.options.join(', ')}`
        };
    }
    
    // Mark game as ended
    game.ended = true;
    game.winner = winningOption;
    game.outcome = 'completed';
    
    // Calculate and distribute winnings
    const winners = Object.entries(game.bets)
        .filter(([userId, bet]) => bet.option === winningOption)
        .map(([userId, bet]) => ({ userId, bet }));
    
    const losers = Object.entries(game.bets)
        .filter(([userId, bet]) => bet.option !== winningOption)
        .map(([userId, bet]) => ({ userId, bet }));
    
    // Process winners
    const winResults = winners.map(({ userId, bet }) => {
        // Calculate winnings with multiplier
        const winnings = Math.round(bet.amount * game.multiplier);
        
        // Add points to user
        const addResult = pointsSystem.addPoints(userId, winnings, 'bet_win');
        
        // Update user stats
        if (userStats[userId]) {
            userStats[userId].wins++;
            userStats[userId].totalWinnings += winnings;
        }
        
        return {
            userId,
            bet: bet.amount,
            option: bet.option,
            winnings,
            success: addResult.success
        };
    });
    
    // Update loser stats
    losers.forEach(({ userId, bet }) => {
        if (userStats[userId]) {
            userStats[userId].losses++;
            userStats[userId].totalLosses += bet.amount;
        }
    });
    
    // Save data
    saveBettingGamesData();
    saveUserStatsData();
    
    return {
        success: true,
        gameId,
        winningOption,
        winners: winResults,
        totalWinners: winners.length,
        totalLosers: losers.length,
        message: `Game ended! The winning option is "${winningOption}". ${winners.length} winners, ${losers.length} losers.`
    };
}

/**
 * Get details of a specific betting game
 * @param {string} gameId ID of the betting game
 * @returns {object} Game details or error
 */
function getBettingGame(gameId) {
    if (!bettingGames[gameId]) {
        return {
            success: false,
            error: 'game_not_found',
            message: 'Betting game not found.'
        };
    }
    
    return {
        success: true,
        game: bettingGames[gameId]
    };
}

/**
 * Get all active betting games
 * @param {string} groupId Optional group ID to filter games
 * @returns {Array} List of active betting games
 */
function getActiveBettingGames(groupId = null) {
    let games = Object.values(bettingGames).filter(game => !game.ended);
    
    // Filter by group if provided
    if (groupId) {
        games = games.filter(game => game.groupId === groupId);
    }
    
    return games;
}

/**
 * Get a user's betting statistics
 * @param {string} userId User's ID
 * @returns {object} User's betting statistics
 */
function getUserBettingStats(userId) {
    // Normalize userId
    userId = pointsSystem.normalizeUserId(userId);
    
    // Get or initialize user stats
    if (!userStats[userId]) {
        userStats[userId] = {
            totalBets: 0,
            totalAmount: 0,
            wins: 0,
            losses: 0,
            totalWinnings: 0,
            totalLosses: 0
        };
    }
    
    // Calculate win rate
    const winRate = userStats[userId].totalBets > 0 
        ? (userStats[userId].wins / userStats[userId].totalBets) * 100 
        : 0;
    
    // Calculate net profit/loss
    const netProfit = userStats[userId].totalWinnings - userStats[userId].totalAmount;
    
    // Calculate ROI (Return on Investment)
    const roi = userStats[userId].totalAmount > 0 
        ? (netProfit / userStats[userId].totalAmount) * 100 
        : 0;
    
    return {
        ...userStats[userId],
        winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal place
        netProfit,
        roi: Math.round(roi * 10) / 10 // Round to 1 decimal place
    };
}

/**
 * Generate a short, unique ID for betting games
 * @returns {string} A short unique ID
 */
function generateShortId() {
    // Generate a UUID and take first 8 characters
    return 'BET-' + uuidv4().substring(0, 8);
}

/**
 * Get available bet types with descriptions
 * @returns {object} Object containing bet types and descriptions
 */
function getBetTypes() {
    return BET_TYPES;
}

module.exports = {
    initialize,
    createBettingGame,
    placeBet,
    endBettingGame,
    getBettingGame,
    getActiveBettingGames,
    getUserBettingStats,
    getBetTypes
};