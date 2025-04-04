/**
 * Message Statistics Module for WhatsApp Bot
 * Manages user message counts and generates leaderboards
 */

const fs = require('fs').promises;
const path = require('path');
const database = require('./database');

// Constants
const DATA_DIR = path.join(__dirname, '../data');
const STATS_FILE = path.join(DATA_DIR, 'message_stats.json');

// In-memory stats cache
let messageStats = {
    users: {},  // User-based stats (by phone number/JID)
    groups: {}  // Group-based stats
};

/**
 * Initialize message statistics module
 */
async function init() {
    try {
        // Ensure data directory exists
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
        } catch (err) {
            // Directory may already exist
        }
        
        // Load existing stats
        try {
            const data = await fs.readFile(STATS_FILE, 'utf8');
            messageStats = JSON.parse(data);
            console.log('Message statistics loaded successfully');
        } catch (err) {
            // If file doesn't exist, we'll start with empty stats
            console.log('Starting with fresh message statistics');
            await saveStats();
        }
        
        // Cleanup old entries daily at midnight
        setInterval(cleanupOldStats, 24 * 60 * 60 * 1000);
    } catch (err) {
        console.error('Error initializing message statistics:', err);
    }
}

/**
 * Save message statistics to disk
 */
async function saveStats() {
    try {
        await fs.writeFile(STATS_FILE, JSON.stringify(messageStats, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving message statistics:', err);
    }
}

/**
 * Cleanup old statistics entries
 * Removes entries older than 30 days
 */
function cleanupOldStats() {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    // Update users
    for (const userId in messageStats.users) {
        const dailyMessages = messageStats.users[userId].dailyMessages || {};
        for (const day in dailyMessages) {
            if (parseInt(day) < thirtyDaysAgo) {
                delete dailyMessages[day];
            }
        }
    }
    
    // Update groups
    for (const groupId in messageStats.groups) {
        const groupStats = messageStats.groups[groupId];
        for (const userId in groupStats.users) {
            const dailyMessages = groupStats.users[userId].dailyMessages || {};
            for (const day in dailyMessages) {
                if (parseInt(day) < thirtyDaysAgo) {
                    delete dailyMessages[day];
                }
            }
        }
    }
    
    // Save changes
    saveStats();
}

/**
 * Record a new message
 * @param {Object} params - Message parameters
 * @param {string} params.sender - Sender JID
 * @param {string} params.group - Group JID (optional)
 * @param {number} params.timestamp - Message timestamp
 */
function recordMessage(params) {
    const { sender, group, timestamp } = params;
    
    if (!sender) return;
    
    // Normalize phone number/JID
    const userId = sender.split('@')[0];
    
    // Get date components for tracking
    const date = new Date(timestamp);
    const day = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const month = day.substring(0, 7); // YYYY-MM
    const week = getWeekNumber(date);
    
    // Initialize user if not exists
    if (!messageStats.users[userId]) {
        messageStats.users[userId] = {
            totalMessages: 0,
            dailyMessages: {},
            weeklyMessages: {},
            monthlyMessages: {}
        };
    }
    
    // Update global user stats
    const user = messageStats.users[userId];
    user.totalMessages++;
    
    // Daily stats
    user.dailyMessages = user.dailyMessages || {};
    user.dailyMessages[day] = (user.dailyMessages[day] || 0) + 1;
    
    // Weekly stats
    user.weeklyMessages = user.weeklyMessages || {};
    user.weeklyMessages[week] = (user.weeklyMessages[week] || 0) + 1;
    
    // Monthly stats
    user.monthlyMessages = user.monthlyMessages || {};
    user.monthlyMessages[month] = (user.monthlyMessages[month] || 0) + 1;
    
    // If group message, update group stats
    if (group) {
        // Initialize group if not exists
        if (!messageStats.groups[group]) {
            messageStats.groups[group] = {
                totalMessages: 0,
                users: {}
            };
        }
        
        const groupData = messageStats.groups[group];
        groupData.totalMessages++;
        
        // Initialize user in group if not exists
        if (!groupData.users[userId]) {
            groupData.users[userId] = {
                totalMessages: 0,
                dailyMessages: {},
                weeklyMessages: {},
                monthlyMessages: {}
            };
        }
        
        // Update group user stats
        const groupUser = groupData.users[userId];
        groupUser.totalMessages++;
        
        // Daily stats
        groupUser.dailyMessages = groupUser.dailyMessages || {};
        groupUser.dailyMessages[day] = (groupUser.dailyMessages[day] || 0) + 1;
        
        // Weekly stats
        groupUser.weeklyMessages = groupUser.weeklyMessages || {};
        groupUser.weeklyMessages[week] = (groupUser.weeklyMessages[week] || 0) + 1;
        
        // Monthly stats
        groupUser.monthlyMessages = groupUser.monthlyMessages || {};
        groupUser.monthlyMessages[month] = (groupUser.monthlyMessages[month] || 0) + 1;
    }
    
    // Save stats periodically (debounce to prevent excessive writes)
    debounceWrite();
}

// Debounce the write operation to prevent excessive disk I/O
let saveTimeout = null;
function debounceWrite() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveStats();
        saveTimeout = null;
    }, 5000); // 5 second debounce
}

/**
 * Get the ISO week number for a date
 * @param {Date} date - The date to get week number for
 * @returns {string} - Year-Week (YYYY-WW)
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${weekNo.toString().padStart(2, '0')}`;
}

/**
 * Get daily leaderboard for a specific group
 * @param {string} groupId - Group JID
 * @param {number} limit - Maximum number of entries to return
 * @returns {Array} Array of users and their message counts
 */
function getDailyLeaderboard(groupId, limit = 10) {
    try {
        if (!groupId || !messageStats.groups[groupId]) {
            return [];
        }
        
        const group = messageStats.groups[groupId];
        const today = new Date().toISOString().split('T')[0];
        const users = Object.keys(group.users);
        
        // Calculate today's message counts for all users
        const results = users.map(userId => {
            const user = group.users[userId];
            const count = user.dailyMessages && user.dailyMessages[today] ? user.dailyMessages[today] : 0;
            
            return {
                userId,
                count
            };
        });
        
        // Sort by count (descending)
        results.sort((a, b) => b.count - a.count);
        
        return results.slice(0, limit);
    } catch (error) {
        console.error('Error getting daily leaderboard:', error);
        return [];
    }
}

/**
 * Get weekly leaderboard for a specific group
 * @param {string} groupId - Group JID
 * @param {number} limit - Maximum number of entries to return
 * @returns {Array} Array of users and their message counts
 */
function getWeeklyLeaderboard(groupId, limit = 10) {
    try {
        if (!groupId || !messageStats.groups[groupId]) {
            return [];
        }
        
        const group = messageStats.groups[groupId];
        const currentWeek = getWeekNumber(new Date());
        const users = Object.keys(group.users);
        
        // Calculate this week's message counts for all users
        const results = users.map(userId => {
            const user = group.users[userId];
            const count = user.weeklyMessages && user.weeklyMessages[currentWeek] ? 
                          user.weeklyMessages[currentWeek] : 0;
            
            return {
                userId,
                count
            };
        });
        
        // Sort by count (descending)
        results.sort((a, b) => b.count - a.count);
        
        return results.slice(0, limit);
    } catch (error) {
        console.error('Error getting weekly leaderboard:', error);
        return [];
    }
}

/**
 * Get monthly leaderboard for a specific group
 * @param {string} groupId - Group JID
 * @param {number} limit - Maximum number of entries to return
 * @returns {Array} Array of users and their message counts
 */
function getMonthlyLeaderboard(groupId, limit = 10) {
    try {
        if (!groupId || !messageStats.groups[groupId]) {
            return [];
        }
        
        const group = messageStats.groups[groupId];
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
        const users = Object.keys(group.users);
        
        // Calculate this month's message counts for all users
        const results = users.map(userId => {
            const user = group.users[userId];
            const count = user.monthlyMessages && user.monthlyMessages[currentMonth] ? 
                          user.monthlyMessages[currentMonth] : 0;
            
            return {
                userId,
                count
            };
        });
        
        // Sort by count (descending)
        results.sort((a, b) => b.count - a.count);
        
        return results.slice(0, limit);
    } catch (error) {
        console.error('Error getting monthly leaderboard:', error);
        return [];
    }
}

/**
 * Get all-time leaderboard for a specific group
 * @param {string} groupId - Group JID
 * @param {number} limit - Maximum number of entries to return
 * @returns {Array} Array of users and their message counts
 */
function getAllTimeLeaderboard(groupId, limit = 10) {
    try {
        if (!groupId || !messageStats.groups[groupId]) {
            return [];
        }
        
        const group = messageStats.groups[groupId];
        const users = Object.keys(group.users);
        
        // Get all-time message counts
        const results = users.map(userId => {
            const user = group.users[userId];
            return {
                userId,
                count: user.totalMessages || 0
            };
        });
        
        // Sort by count (descending)
        results.sort((a, b) => b.count - a.count);
        
        return results.slice(0, limit);
    } catch (error) {
        console.error('Error getting all-time leaderboard:', error);
        return [];
    }
}

/**
 * Get statistics for a specific user in a group
 * @param {string} groupId - Group JID
 * @param {string} userId - User JID
 * @returns {Object|null} User statistics or null if not found
 */
function getUserStats(groupId, userId) {
    try {
        // Normalize user ID
        userId = userId.split('@')[0];
        
        if (!groupId || !messageStats.groups[groupId]) {
            return null;
        }
        
        const group = messageStats.groups[groupId];
        if (!group.users[userId]) {
            return null;
        }
        
        const user = group.users[userId];
        const today = new Date().toISOString().split('T')[0];
        const currentWeek = getWeekNumber(new Date());
        const currentMonth = new Date().toISOString().substring(0, 7);
        
        return {
            userId,
            totalMessages: user.totalMessages || 0,
            dailyMessages: user.dailyMessages && user.dailyMessages[today] ? user.dailyMessages[today] : 0,
            weeklyMessages: user.weeklyMessages && user.weeklyMessages[currentWeek] ? user.weeklyMessages[currentWeek] : 0,
            monthlyMessages: user.monthlyMessages && user.monthlyMessages[currentMonth] ? user.monthlyMessages[currentMonth] : 0
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return null;
    }
}

// Export functions
module.exports = {
    init,
    recordMessage,
    getDailyLeaderboard,
    getWeeklyLeaderboard,
    getMonthlyLeaderboard,
    getAllTimeLeaderboard,
    getUserStats
};