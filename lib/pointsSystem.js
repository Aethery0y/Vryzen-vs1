/**
 * Points System Module for WhatsApp Bot
 * Manages a gamified points system for user engagement
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// Data storage
let userPoints = {};
let pointsUsageTracking = {};
const POINTS_FILE = path.join(config.databaseDir, 'userPoints.json');
const POINTS_USAGE_FILE = path.join(config.databaseDir, 'pointsUsage.json');

// Points system settings
const pointsSettings = config.animeGames.points;

/**
 * Initialize the points system
 */
function initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(config.databaseDir)) {
        fs.mkdirSync(config.databaseDir, { recursive: true });
    }

    // Load existing user points data if available
    try {
        if (fs.existsSync(POINTS_FILE)) {
            const data = fs.readFileSync(POINTS_FILE, 'utf8');
            userPoints = JSON.parse(data);
            console.log('Points system: Loaded user points data');
        } else {
            console.log('Points system: No existing points data found, starting fresh');
            savePointsData();
        }
    } catch (error) {
        console.error('Points system: Error loading points data', error);
        userPoints = {};
        savePointsData();
    }

    // Load points usage tracking data
    try {
        if (fs.existsSync(POINTS_USAGE_FILE)) {
            const data = fs.readFileSync(POINTS_USAGE_FILE, 'utf8');
            pointsUsageTracking = JSON.parse(data);
            console.log('Points system: Loaded points usage tracking data');
        } else {
            console.log('Points system: No existing points usage data found, starting fresh');
            savePointsUsageData();
        }
    } catch (error) {
        console.error('Points system: Error loading points usage data', error);
        pointsUsageTracking = {};
        savePointsUsageData();
    }

    // Set up daily reset for usage tracking
    scheduleUsageReset();
}

/**
 * Schedule daily reset of points usage tracking
 */
function scheduleUsageReset() {
    const nodeSchedule = require('node-schedule');
    
    // Reset at midnight every day
    nodeSchedule.scheduleJob('0 0 * * *', () => {
        console.log('Points system: Performing daily usage tracking reset');
        resetDailyUsage();
    });
}

/**
 * Reset daily usage tracking for all users
 */
function resetDailyUsage() {
    pointsUsageTracking = {};
    savePointsUsageData();
}

/**
 * Save points data to file
 */
function savePointsData() {
    try {
        fs.writeFileSync(POINTS_FILE, JSON.stringify(userPoints, null, 2));
    } catch (error) {
        console.error('Points system: Error saving points data', error);
    }
}

/**
 * Save points usage tracking data to file
 */
function savePointsUsageData() {
    try {
        fs.writeFileSync(POINTS_USAGE_FILE, JSON.stringify(pointsUsageTracking, null, 2));
    } catch (error) {
        console.error('Points system: Error saving points usage data', error);
    }
}

/**
 * Get a user's current points
 * @param {string} userId User's phone number or ID
 * @returns {number} Current points
 */
function getUserPoints(userId) {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    return userPoints[userId] || 0;
}

/**
 * Get user points for multiple users
 * @param {array} userIds Array of user IDs
 * @returns {object} Map of user IDs to points
 */
function getMultipleUserPoints(userIds) {
    const result = {};
    
    for (const userId of userIds) {
        const normalizedId = normalizeUserId(userId);
        result[normalizedId] = getUserPoints(normalizedId);
    }
    
    return result;
}

/**
 * Add points to a user
 * @param {string} userId User's phone number or ID
 * @param {number} points Points to add
 * @param {string} source Source of points (message, quiz, etc)
 * @returns {object} Result object with success, points, error
 */
function addPoints(userId, points, source = 'generic') {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    // Initialize user if not exists
    if (!userPoints[userId]) {
        userPoints[userId] = 0;
    }
    
    // Initialize tracking if not exists
    if (!pointsUsageTracking[userId]) {
        pointsUsageTracking[userId] = {
            total: 0,
            sources: {}
        };
    }
    
    // Initialize source tracking if not exists
    if (!pointsUsageTracking[userId].sources[source]) {
        pointsUsageTracking[userId].sources[source] = 0;
    }
    
    // Check if user has reached daily limit
    if (pointsUsageTracking[userId].total >= pointsSettings.maxPointsPerDay) {
        return {
            success: false,
            error: 'daily_limit',
            currentPoints: userPoints[userId],
            addedPoints: 0,
            message: `You've reached your daily points limit (${pointsSettings.maxPointsPerDay}). Try again tomorrow!`
        };
    }
    
    // Calculate the points to be added (respecting the daily limit)
    const pointsToAdd = Math.min(
        points, 
        pointsSettings.maxPointsPerDay - pointsUsageTracking[userId].total
    );
    
    // Add points
    userPoints[userId] += pointsToAdd;
    
    // Update tracking
    pointsUsageTracking[userId].total += pointsToAdd;
    pointsUsageTracking[userId].sources[source] += pointsToAdd;
    
    // Save data
    savePointsData();
    savePointsUsageData();
    
    return {
        success: true,
        currentPoints: userPoints[userId],
        addedPoints: pointsToAdd,
        message: `You earned ${pointsToAdd} points from ${source}!`
    };
}

/**
 * Deduct points from a user
 * @param {string} userId User's phone number or ID
 * @param {number} points Points to deduct
 * @param {string} reason Reason for deduction
 * @returns {object} Result object with success, points, error
 */
function deductPoints(userId, points, reason = 'purchase') {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    // Initialize user if not exists
    if (!userPoints[userId]) {
        userPoints[userId] = 0;
    }
    
    // Check if user has enough points
    if (userPoints[userId] < points) {
        return {
            success: false,
            error: 'insufficient_points',
            currentPoints: userPoints[userId],
            message: `Not enough points. You have ${userPoints[userId]} points, but need ${points}.`
        };
    }
    
    // Deduct points
    userPoints[userId] -= points;
    
    // Save data
    savePointsData();
    
    return {
        success: true,
        currentPoints: userPoints[userId],
        deductedPoints: points,
        message: `${points} points were deducted for ${reason}. You now have ${userPoints[userId]} points.`
    };
}

/**
 * Get leaderboard for top users
 * @param {number} limit How many users to include
 * @returns {array} Array of user IDs and points
 */
function getLeaderboard(limit = 10) {
    return Object.entries(userPoints)
        .sort((a, b) => b[1] - a[1]) // Sort by points (descending)
        .slice(0, limit)
        .map(([userId, points]) => ({ userId, points }));
}

/**
 * Get a user's daily points usage statistics
 * @param {string} userId User's phone number or ID
 * @returns {object} Daily usage stats or null if not found
 */
function getUserDailyStats(userId) {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    return pointsUsageTracking[userId] || null;
}

/**
 * Grant a daily bonus to a user
 * @param {string} userId User's phone number or ID
 * @returns {object} Result object with success, points, error
 */
function grantDailyBonus(userId) {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    return addPoints(userId, pointsSettings.dailyBonus, 'daily_bonus');
}

/**
 * Award points for a message
 * @param {string} userId User's phone number or ID
 * @returns {object} Result object with success, points, error
 */
function awardMessagePoints(userId) {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    return addPoints(userId, pointsSettings.messagePoints, 'message');
}

/**
 * Award points for answering a quiz correctly
 * @param {string} userId User's phone number or ID
 * @returns {object} Result object with success, points, error
 */
function awardQuizPoints(userId) {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    return addPoints(userId, pointsSettings.quizPoints, 'quiz');
}

/**
 * Award points for getting a new card based on rarity
 * @param {string} userId User's phone number or ID
 * @param {string} rarity Card rarity
 * @returns {object} Result object with success, points, error
 */
function awardCardPoints(userId, rarity) {
    // Normalize userId to consistent format
    userId = normalizeUserId(userId);
    
    // Get points based on rarity
    const rarityPoints = pointsSettings.cardRarityPoints[rarity.toLowerCase()] || 10;
    
    return addPoints(userId, rarityPoints, 'card_collection');
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
    getUserPoints,
    getMultipleUserPoints,
    addPoints,
    deductPoints,
    getLeaderboard,
    getUserDailyStats,
    grantDailyBonus,
    awardMessagePoints,
    awardQuizPoints,
    awardCardPoints
};