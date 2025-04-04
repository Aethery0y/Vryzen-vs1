/**
 * Points System Module for WhatsApp Bot
 * Gamified user engagement system that rewards users for various interactions
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// Define point values for different actions
const POINT_VALUES = {
    // Basic interaction points
    MESSAGE: 1,                   // Regular message
    COMMAND: 5,                   // Using a bot command
    DAILY_LOGIN: 15,              // Daily login bonus
    
    // Anime-specific activities
    ANIME_QUIZ_CORRECT: 25,       // Correctly answering anime quiz
    ANIME_QUIZ_PARTICIPATION: 5,  // Just participating in anime quiz
    ANIME_RECOMMENDATION: 10,     // Giving anime recommendations
    ANIME_DISCUSSION: 2,          // Participating in anime discussion
    
    // Special activities
    CREATE_STICKER: 3,            // Creating a sticker
    SHARE_CONTENT: 5,             // Sharing content with the group
    GROUP_GAME: 10,               // Participating in group games
    
    // Social interaction
    REPLY_SOMEONE: 2,             // Replying to others
    GET_REPLIED: 1,               // Getting replies from others
    
    // Achievements
    DAILY_STREAK: 10,             // Maintaining a daily streak
    WEEKLY_ACTIVE: 30,            // Being active every day of the week
    MONTHLY_CHAMPION: 100,        // Monthly top contributor
    
    // Leveling milestones
    LEVEL_UP_BONUS: 50            // Bonus for leveling up
};

// Level thresholds
const LEVELS = [
    { level: 1, points: 0, title: "Anime Newbie" },
    { level: 2, points: 100, title: "Manga Reader" },
    { level: 3, points: 300, title: "Otaku Apprentice" },
    { level: 4, points: 600, title: "Shonen Fan" },
    { level: 5, points: 1000, title: "Seinen Enthusiast" },
    { level: 6, points: 1500, title: "Waifu Collector" },
    { level: 7, points: 2500, title: "Anime Scholar" },
    { level: 8, points: 4000, title: "Nakama Legend" },
    { level: 9, points: 7000, title: "Anime Sage" },
    { level: 10, points: 10000, title: "Otaku Sensei" },
    { level: 11, points: 15000, title: "Anime Guardian" },
    { level: 12, points: 25000, title: "Anime Deity" },
    { level: 13, points: 40000, title: "Anime Overlord" },
    { level: 14, points: 70000, title: "Anime God" },
    { level: 15, points: 100000, title: "Ultimate Weeb" }
];

// Special badges that can be earned
const BADGES = {
    QUIZ_MASTER: { id: 'quiz_master', name: '🧠 Quiz Master', requirement: 'Win 10 anime quizzes' },
    DAILY_DEVOTEE: { id: 'daily_devotee', name: '📆 Daily Devotee', requirement: 'Login 30 days in a row' },
    SOCIAL_BUTTERFLY: { id: 'social_butterfly', name: '🦋 Social Butterfly', requirement: 'Interact with 20 different members' },
    MEME_LORD: { id: 'meme_lord', name: '😂 Meme Lord', requirement: 'Share 50 stickers or memes' },
    SENSEI: { id: 'sensei', name: '👨‍🏫 Sensei', requirement: 'Help 15 different members' },
    ANIME_ENCYCLOPEDIA: { id: 'anime_encyclopedia', name: '📚 Anime Encyclopedia', requirement: 'Correctly answer 100 anime questions' },
    COMMUNITY_PILLAR: { id: 'community_pillar', name: '🏛️ Community Pillar', requirement: 'Be active in the group for 3 months' }
};

// File path for storing user points data
const POINTS_FILE = path.join(config.databaseDir, 'userPoints.json');
const ACHIEVEMENTS_FILE = path.join(config.databaseDir, 'userAchievements.json');
const DAILY_CHECKIN_FILE = path.join(config.databaseDir, 'dailyCheckins.json');

// In-memory cache of user points
let userPoints = {};
let userAchievements = {};
let dailyCheckins = {};

/**
 * Initialize the points system
 */
function initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(config.databaseDir)) {
        fs.mkdirSync(config.databaseDir, { recursive: true });
    }
    
    // Load existing points data
    if (fs.existsSync(POINTS_FILE)) {
        try {
            userPoints = JSON.parse(fs.readFileSync(POINTS_FILE, 'utf8'));
            console.log('Points system: User points loaded successfully');
        } catch (error) {
            console.error('Points system: Error loading user points:', error);
            userPoints = {};
        }
    }
    
    // Load existing achievements data
    if (fs.existsSync(ACHIEVEMENTS_FILE)) {
        try {
            userAchievements = JSON.parse(fs.readFileSync(ACHIEVEMENTS_FILE, 'utf8'));
            console.log('Points system: User achievements loaded successfully');
        } catch (error) {
            console.error('Points system: Error loading user achievements:', error);
            userAchievements = {};
        }
    }
    
    // Load daily checkin data
    if (fs.existsSync(DAILY_CHECKIN_FILE)) {
        try {
            dailyCheckins = JSON.parse(fs.readFileSync(DAILY_CHECKIN_FILE, 'utf8'));
            console.log('Points system: Daily checkins loaded successfully');
        } catch (error) {
            console.error('Points system: Error loading daily checkins:', error);
            dailyCheckins = {};
        }
    }
    
    // Start the daily reset task
    resetDailyTasks();
    
    return true;
}

/**
 * Save user points to disk
 */
function saveUserPoints() {
    try {
        fs.writeFileSync(POINTS_FILE, JSON.stringify(userPoints, null, 2));
    } catch (error) {
        console.error('Points system: Error saving user points:', error);
    }
}

/**
 * Save user achievements to disk
 */
function saveUserAchievements() {
    try {
        fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(userAchievements, null, 2));
    } catch (error) {
        console.error('Points system: Error saving user achievements:', error);
    }
}

/**
 * Save daily checkin data to disk
 */
function saveDailyCheckins() {
    try {
        fs.writeFileSync(DAILY_CHECKIN_FILE, JSON.stringify(dailyCheckins, null, 2));
    } catch (error) {
        console.error('Points system: Error saving daily checkins:', error);
    }
}

/**
 * Award points to a user for a specific action
 * @param {string} userId - The user ID (phone number)
 * @param {string} actionType - The type of action (from POINT_VALUES)
 * @param {string} groupId - The group ID where the action occurred
 * @returns {object} - Result of the operation with new total and level information
 */
function awardPoints(userId, actionType, groupId = null) {
    if (!userId || !POINT_VALUES[actionType]) {
        console.log(`Points system: Invalid award request - User: ${userId}, Action: ${actionType}`);
        return { success: false, reason: 'Invalid user or action type' };
    }
    
    // Clean userId (remove any @s.whatsapp.net or @g.us)
    const cleanUserId = userId.split('@')[0];
    
    // Initialize user if not exists
    if (!userPoints[cleanUserId]) {
        userPoints[cleanUserId] = {
            total: 0,
            groups: {},
            lastActivityTimestamp: 0,
            streak: {
                current: 0,
                lastCheckIn: 0,
                maxStreak: 0
            }
        };
    }
    
    // Get the points to award
    const pointsToAward = POINT_VALUES[actionType] || 0;
    
    // Update total points
    const prevTotal = userPoints[cleanUserId].total;
    userPoints[cleanUserId].total += pointsToAward;
    
    // Update group-specific points if group is provided
    if (groupId) {
        const cleanGroupId = groupId.split('@')[0];
        if (!userPoints[cleanUserId].groups[cleanGroupId]) {
            userPoints[cleanUserId].groups[cleanGroupId] = 0;
        }
        userPoints[cleanUserId].groups[cleanGroupId] += pointsToAward;
    }
    
    // Update activity timestamp
    userPoints[cleanUserId].lastActivityTimestamp = Date.now();
    
    // Calculate level before and after
    const oldLevel = getLevelInfo(prevTotal);
    const newLevel = getLevelInfo(userPoints[cleanUserId].total);
    
    // Check if user leveled up
    const leveledUp = oldLevel.level < newLevel.level;
    
    // If leveled up, award bonus points
    if (leveledUp) {
        userPoints[cleanUserId].total += POINT_VALUES.LEVEL_UP_BONUS;
        // Update the new level info after adding bonus
        const updatedLevel = getLevelInfo(userPoints[cleanUserId].total);
        
        // Save points to disk periodically (on level up is a good time)
        saveUserPoints();
        
        return {
            success: true,
            totalPoints: userPoints[cleanUserId].total,
            pointsAwarded: pointsToAward + POINT_VALUES.LEVEL_UP_BONUS,
            leveledUp: true,
            previousLevel: oldLevel,
            newLevel: updatedLevel,
            levelUpBonus: POINT_VALUES.LEVEL_UP_BONUS
        };
    }
    
    // Save points to disk periodically
    if (Math.random() < 0.1) { // ~10% chance to save on each action
        saveUserPoints();
    }
    
    return {
        success: true,
        totalPoints: userPoints[cleanUserId].total,
        pointsAwarded: pointsToAward,
        leveledUp: false,
        currentLevel: newLevel
    };
}

/**
 * Record a daily check-in for a user
 * @param {string} userId - The user ID
 * @returns {object} - Information about the check-in and streak
 */
function dailyCheckIn(userId) {
    if (!userId) return { success: false, reason: 'Invalid user ID' };
    
    // Clean userId
    const cleanUserId = userId.split('@')[0];
    
    // Initialize user in daily checkins if not exists
    if (!dailyCheckins[cleanUserId]) {
        dailyCheckins[cleanUserId] = {
            lastCheckIn: 0,
            streak: 0,
            maxStreak: 0,
            totalCheckins: 0
        };
    }
    
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const user = dailyCheckins[cleanUserId];
    
    // Check if this is a valid daily check-in
    // We use a 30-hour window to be more generous (accounts for timezone differences)
    const timeSinceLastCheckIn = now - user.lastCheckIn;
    
    // If already checked in today
    if (timeSinceLastCheckIn < oneDayMs - (6 * 60 * 60 * 1000)) { // Less than 18 hours
        return {
            success: true,
            alreadyCheckedIn: true,
            streak: user.streak,
            maxStreak: user.maxStreak,
            nextCheckInTime: new Date(user.lastCheckIn + oneDayMs).toLocaleString(),
            message: "You've already checked in today! Come back tomorrow for more points."
        };
    }
    
    // If it's been more than 48 hours, reset streak
    if (timeSinceLastCheckIn > 2 * oneDayMs) {
        user.streak = 1; // Reset to 1 (this check-in)
    } else {
        user.streak++; // Increment streak
    }
    
    // Update max streak if current streak is higher
    if (user.streak > user.maxStreak) {
        user.maxStreak = user.streak;
    }
    
    // Update last check-in time and total check-ins
    user.lastCheckIn = now;
    user.totalCheckins++;
    
    // Save daily check-ins
    saveDailyCheckins();
    
    // Calculate bonus points based on streak
    let streakBonus = 0;
    
    // Special streak bonuses
    if (user.streak % 7 === 0) {
        // Weekly streak bonus
        streakBonus = 30;
    } else if (user.streak % 30 === 0) {
        // Monthly streak bonus
        streakBonus = 150;
    } else if (user.streak % 100 === 0) {
        // Century streak bonus!
        streakBonus = 500;
    } else if (user.streak >= 5) {
        // Small bonus for 5+ day streak
        streakBonus = 5;
    }
    
    // Award daily check-in points plus any streak bonus
    const result = awardPoints(cleanUserId, 'DAILY_LOGIN');
    
    if (streakBonus > 0) {
        // Manually add the streak bonus
        userPoints[cleanUserId].total += streakBonus;
        saveUserPoints();
    }
    
    // Check for streak-based achievements
    checkAndAwardAchievements(cleanUserId);
    
    return {
        success: true,
        pointsAwarded: POINT_VALUES.DAILY_LOGIN + streakBonus,
        streak: user.streak,
        maxStreak: user.maxStreak,
        streakBonus: streakBonus,
        totalCheckins: user.totalCheckins,
        message: streakBonus > 0 
            ? `Daily check-in: +${POINT_VALUES.DAILY_LOGIN} points! Streak bonus: +${streakBonus} points for ${user.streak} day streak! 🔥`
            : `Daily check-in: +${POINT_VALUES.DAILY_LOGIN} points! Current streak: ${user.streak} days 🔥`
    };
}

/**
 * Reset daily tasks at midnight
 */
function resetDailyTasks() {
    // Get current date
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // tomorrow
        0, 0, 0 // midnight
    );
    const msToMidnight = night.getTime() - now.getTime();
    
    // Schedule the reset
    setTimeout(() => {
        console.log('Points system: Performing daily tasks reset');
        
        // Save all data just to be safe
        saveUserPoints();
        saveUserAchievements();
        saveDailyCheckins();
        
        // Schedule next reset
        resetDailyTasks();
    }, msToMidnight);
    
    console.log(`Points system: Daily tasks will reset in ${Math.floor(msToMidnight / 1000 / 60 / 60)} hours`);
}

/**
 * Get information about a user's level based on points
 * @param {number} points - The user's total points
 * @returns {object} - Level information
 */
function getLevelInfo(points) {
    // Find the highest level the user qualifies for
    let userLevel = LEVELS[0]; // Default to level 1
    
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (points >= LEVELS[i].points) {
            userLevel = LEVELS[i];
            break;
        }
    }
    
    // Calculate progress to next level
    let nextLevel = null;
    let progress = 100; // Default to 100% if at max level
    
    for (let i = 0; i < LEVELS.length; i++) {
        if (LEVELS[i].level === userLevel.level + 1) {
            nextLevel = LEVELS[i];
            const pointsNeeded = nextLevel.points - userLevel.points;
            const pointsGained = points - userLevel.points;
            progress = Math.floor((pointsGained / pointsNeeded) * 100);
            break;
        }
    }
    
    return {
        level: userLevel.level,
        title: userLevel.title,
        points: points,
        nextLevelPoints: nextLevel ? nextLevel.points : null,
        pointsToNextLevel: nextLevel ? nextLevel.points - points : null,
        progress: progress > 100 ? 100 : progress
    };
}

/**
 * Get a user's profile with points, level, and achievements
 * @param {string} userId - The user ID
 * @returns {object} - User profile information
 */
function getUserProfile(userId) {
    if (!userId) return { success: false, reason: 'Invalid user ID' };
    
    // Clean userId
    const cleanUserId = userId.split('@')[0];
    
    // If user doesn't exist, return default profile
    if (!userPoints[cleanUserId]) {
        return {
            success: true,
            userId: cleanUserId,
            exists: false,
            points: 0,
            level: getLevelInfo(0),
            achievements: [],
            rank: null,
            groups: {},
            streak: 0,
            maxStreak: 0
        };
    }
    
    // Get user info
    const userInfo = userPoints[cleanUserId];
    const userLevelInfo = getLevelInfo(userInfo.total);
    
    // Get streak info
    const streakInfo = dailyCheckins[cleanUserId] || { streak: 0, maxStreak: 0, totalCheckins: 0 };
    
    // Get top groups by points
    const groupsArray = Object.entries(userInfo.groups || {})
        .map(([groupId, points]) => ({ groupId, points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3); // Top 3 groups
    
    // Get user's rank
    const allUsers = Object.entries(userPoints)
        .map(([id, data]) => ({ id, points: data.total }))
        .sort((a, b) => b.points - a.points);
    
    const rank = allUsers.findIndex(u => u.id === cleanUserId) + 1;
    
    // Get user achievements
    const achievements = userAchievements[cleanUserId] || [];
    
    return {
        success: true,
        userId: cleanUserId,
        exists: true,
        points: userInfo.total,
        level: userLevelInfo,
        achievements: achievements.map(achId => BADGES[achId]),
        rank: rank,
        totalUsers: allUsers.length,
        topGroups: groupsArray,
        streak: streakInfo.streak,
        maxStreak: streakInfo.maxStreak,
        totalCheckins: streakInfo.totalCheckins,
        lastActive: userInfo.lastActivityTimestamp 
            ? new Date(userInfo.lastActivityTimestamp).toLocaleDateString() 
            : 'Never'
    };
}

/**
 * Get the top users by points
 * @param {number} limit - Number of users to return
 * @param {string} groupId - Optional group ID to filter by
 * @returns {Array} - List of top users
 */
function getTopUsers(limit = 10, groupId = null) {
    let users;
    
    if (groupId) {
        // Filter users who have activity in this group
        const cleanGroupId = groupId.split('@')[0];
        users = Object.entries(userPoints)
            .filter(([userId, data]) => 
                data.groups && data.groups[cleanGroupId] && data.groups[cleanGroupId] > 0
            )
            .map(([userId, data]) => ({
                userId,
                points: data.groups[cleanGroupId] || 0,
                totalPoints: data.total,
                level: getLevelInfo(data.total)
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, limit);
    } else {
        // Get global top users
        users = Object.entries(userPoints)
            .map(([userId, data]) => ({
                userId,
                points: data.total,
                level: getLevelInfo(data.total)
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, limit);
    }
    
    return users;
}

/**
 * Check and award achievements for a user
 * @param {string} userId - The user ID
 * @returns {object} - Information about new achievements
 */
function checkAndAwardAchievements(userId) {
    if (!userId) return { success: false, reason: 'Invalid user ID' };
    
    // Clean userId
    const cleanUserId = userId.split('@')[0];
    
    // Initialize achievements for user if not exists
    if (!userAchievements[cleanUserId]) {
        userAchievements[cleanUserId] = [];
    }
    
    const newAchievements = [];
    
    // Get user data
    const userData = userPoints[cleanUserId] || { total: 0 };
    const checkinData = dailyCheckins[cleanUserId] || { streak: 0, maxStreak: 0 };
    
    // Check for DAILY_DEVOTEE (30 day streak)
    if (checkinData.streak >= 30 && !userAchievements[cleanUserId].includes('DAILY_DEVOTEE')) {
        userAchievements[cleanUserId].push('DAILY_DEVOTEE');
        newAchievements.push(BADGES.DAILY_DEVOTEE);
    }
    
    // Add more achievement checks here
    
    // Save if new achievements were awarded
    if (newAchievements.length > 0) {
        saveUserAchievements();
    }
    
    return {
        success: true,
        newAchievements: newAchievements
    };
}

module.exports = {
    initialize,
    awardPoints,
    dailyCheckIn,
    getUserProfile,
    getTopUsers,
    POINT_VALUES,
    LEVELS,
    BADGES,
    checkAndAwardAchievements
};