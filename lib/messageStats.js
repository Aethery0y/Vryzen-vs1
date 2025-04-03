/**
 * Message Statistics Tracking System
 * Tracks and provides analytics on user messaging activity with time-based tracking
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const database = require('./database');

// File to store message statistics
const statsFile = path.join(config.databaseDir, 'messageStats.json');

/**
 * Initialize the message stats system
 * Creates necessary files if they don't exist
 */
function initMessageStats() {
    try {
        // Ensure the data directory exists
        if (!fs.existsSync(config.databaseDir)) {
            fs.mkdirSync(config.databaseDir, { recursive: true });
        }
        
        // Create stats file if it doesn't exist
        if (!fs.existsSync(statsFile)) {
            const initialData = {
                users: {},
                lastUpdate: Date.now()
            };
            fs.writeFileSync(statsFile, JSON.stringify(initialData, null, 2));
            console.log('Message statistics file created');
        }
        
        // Validate and repair stats file if needed
        validateStatsFile();
        
        console.log('Message statistics system initialized');
        return true;
    } catch (error) {
        console.error('Error initializing message statistics:', error);
        return false;
    }
}

/**
 * Validates the stats file and repairs it if necessary
 */
function validateStatsFile() {
    try {
        const statsData = getStatsData();
        
        // Ensure the file has the required structure
        if (!statsData.users) {
            statsData.users = {};
        }
        
        if (!statsData.lastUpdate) {
            statsData.lastUpdate = Date.now();
        }
        
        // Save the validated/repaired data
        saveStatsData(statsData);
        
    } catch (error) {
        console.error('Error validating stats file, recreating:', error);
        // Recreate the file if it's corrupted
        const initialData = {
            users: {},
            lastUpdate: Date.now()
        };
        fs.writeFileSync(statsFile, JSON.stringify(initialData, null, 2));
    }
}

/**
 * Get the current stats data from file
 * 
 * @returns {Object} The stats data object
 */
function getStatsData() {
    try {
        if (!fs.existsSync(statsFile)) {
            return { users: {}, lastUpdate: Date.now() };
        }
        
        const data = fs.readFileSync(statsFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading message stats data:', error);
        return { users: {}, lastUpdate: Date.now() };
    }
}

/**
 * Save stats data to file
 * 
 * @param {Object} data - The stats data to save
 */
function saveStatsData(data) {
    try {
        fs.writeFileSync(statsFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving message stats data:', error);
    }
}

/**
 * Record a message from a user
 * 
 * @param {string} userId - The user's WhatsApp ID
 * @param {Object} message - The message object
 * @param {string} groupId - Optional group ID where the message was sent
 */
function recordUserMessage(userId, message, groupId = null) {
    try {
        // Only record text messages
        if (!message.conversation && 
            !message.extendedTextMessage && 
            !message.imageMessage?.caption && 
            !message.videoMessage?.caption) {
            return; // Skip non-text messages
        }
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const currentWeekStart = getStartOfWeek(now).getTime();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        
        const statsData = getStatsData();
        
        // Initialize user data if not exists
        if (!statsData.users[userId]) {
            statsData.users[userId] = {
                totalMessages: 0,
                dailyStats: {},
                weeklyStats: {},
                monthlyStats: {},
                lastActive: now.getTime()
            };
        }
        
        const userData = statsData.users[userId];
        
        // Increment total messages
        userData.totalMessages = (userData.totalMessages || 0) + 1;
        userData.lastActive = now.getTime();
        
        // Record daily stats
        if (!userData.dailyStats[today]) {
            userData.dailyStats[today] = 0;
        }
        userData.dailyStats[today]++;
        
        // Record weekly stats
        if (!userData.weeklyStats[currentWeekStart]) {
            userData.weeklyStats[currentWeekStart] = 0;
        }
        userData.weeklyStats[currentWeekStart]++;
        
        // Record monthly stats
        if (!userData.monthlyStats[currentMonthStart]) {
            userData.monthlyStats[currentMonthStart] = 0;
        }
        userData.monthlyStats[currentMonthStart]++;
        
        // If message is in a group, track group-specific stats
        if (groupId) {
            if (!userData.groups) {
                userData.groups = {};
            }
            
            if (!userData.groups[groupId]) {
                userData.groups[groupId] = {
                    totalMessages: 0,
                    dailyStats: {},
                    weeklyStats: {},
                    monthlyStats: {}
                };
            }
            
            const groupData = userData.groups[groupId];
            
            // Increment total group messages
            groupData.totalMessages++;
            
            // Record daily stats for group
            if (!groupData.dailyStats[today]) {
                groupData.dailyStats[today] = 0;
            }
            groupData.dailyStats[today]++;
            
            // Record weekly stats for group
            if (!groupData.weeklyStats[currentWeekStart]) {
                groupData.weeklyStats[currentWeekStart] = 0;
            }
            groupData.weeklyStats[currentWeekStart]++;
            
            // Record monthly stats for group
            if (!groupData.monthlyStats[currentMonthStart]) {
                groupData.monthlyStats[currentMonthStart] = 0;
            }
            groupData.monthlyStats[currentMonthStart]++;
        }
        
        // Update timestamp
        statsData.lastUpdate = now.getTime();
        
        // Clean up old data (remove entries older than 6 months)
        cleanupOldData(userData);
        
        // Save updated stats data
        saveStatsData(statsData);
        
    } catch (error) {
        console.error('Error recording user message:', error);
    }
}

/**
 * Clean up old statistical data older than 6 months
 * 
 * @param {Object} userData - The user data object to clean
 */
function cleanupOldData(userData) {
    try {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).getTime();
        
        // Clean up daily stats
        if (userData.dailyStats) {
            Object.keys(userData.dailyStats).forEach(timestamp => {
                if (parseInt(timestamp) < sixMonthsAgo) {
                    delete userData.dailyStats[timestamp];
                }
            });
        }
        
        // Clean up weekly stats
        if (userData.weeklyStats) {
            Object.keys(userData.weeklyStats).forEach(timestamp => {
                if (parseInt(timestamp) < sixMonthsAgo) {
                    delete userData.weeklyStats[timestamp];
                }
            });
        }
        
        // Clean up monthly stats
        if (userData.monthlyStats) {
            Object.keys(userData.monthlyStats).forEach(timestamp => {
                if (parseInt(timestamp) < sixMonthsAgo) {
                    delete userData.monthlyStats[timestamp];
                }
            });
        }
        
        // Clean up group stats
        if (userData.groups) {
            Object.keys(userData.groups).forEach(groupId => {
                const groupData = userData.groups[groupId];
                
                // Clean daily stats
                if (groupData.dailyStats) {
                    Object.keys(groupData.dailyStats).forEach(timestamp => {
                        if (parseInt(timestamp) < sixMonthsAgo) {
                            delete groupData.dailyStats[timestamp];
                        }
                    });
                }
                
                // Clean weekly stats
                if (groupData.weeklyStats) {
                    Object.keys(groupData.weeklyStats).forEach(timestamp => {
                        if (parseInt(timestamp) < sixMonthsAgo) {
                            delete groupData.weeklyStats[timestamp];
                        }
                    });
                }
                
                // Clean monthly stats
                if (groupData.monthlyStats) {
                    Object.keys(groupData.monthlyStats).forEach(timestamp => {
                        if (parseInt(timestamp) < sixMonthsAgo) {
                            delete groupData.monthlyStats[timestamp];
                        }
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error cleaning up old stats data:', error);
    }
}

/**
 * Get the start date of the week containing the specified date
 * 
 * @param {Date} date - The date to get the week start for
 * @returns {Date} - Date representing the start of the week (Sunday)
 */
function getStartOfWeek(date) {
    const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, etc.
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
}

/**
 * Format a timestamp for display in leaderboard
 * 
 * @param {number} timestamp - Timestamp to format
 * @returns {string} Formatted date string
 */
function formatTimestamp(timestamp) {
    const date = new Date(parseInt(timestamp));
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

/**
 * Get daily leaderboard for a specific group or global
 * 
 * @param {string} groupId - Optional group ID to get stats for
 * @param {number} limit - Max number of users to return
 * @returns {Array} Array of users sorted by message count
 */
function getDailyLeaderboard(groupId = null, limit = 10) {
    try {
        const statsData = getStatsData();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        const leaderboard = [];
        
        // Process each user's data
        Object.keys(statsData.users).forEach(userId => {
            const userData = statsData.users[userId];
            let messageCount = 0;
            
            if (groupId && userData.groups && userData.groups[groupId]) {
                // Get group-specific daily stats
                messageCount = userData.groups[groupId].dailyStats[today] || 0;
            } else if (!groupId) {
                // Get global daily stats
                messageCount = userData.dailyStats[today] || 0;
            }
            
            if (messageCount > 0) {
                // Get contact name if available
                const contact = database.getContact(userId.split('@')[0]) || {};
                const name = contact.name || userId.split('@')[0];
                
                leaderboard.push({
                    userId,
                    name,
                    messageCount
                });
            }
        });
        
        // Sort by message count and limit results
        return leaderboard
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, limit);
            
    } catch (error) {
        console.error('Error getting daily leaderboard:', error);
        return [];
    }
}

/**
 * Get weekly leaderboard for a specific group or global
 * 
 * @param {string} groupId - Optional group ID to get stats for
 * @param {number} limit - Max number of users to return
 * @returns {Array} Array of users sorted by message count
 */
function getWeeklyLeaderboard(groupId = null, limit = 10) {
    try {
        const statsData = getStatsData();
        const now = new Date();
        const currentWeekStart = getStartOfWeek(now).getTime();
        
        const leaderboard = [];
        
        // Process each user's data
        Object.keys(statsData.users).forEach(userId => {
            const userData = statsData.users[userId];
            let messageCount = 0;
            
            if (groupId && userData.groups && userData.groups[groupId]) {
                // Get group-specific weekly stats
                messageCount = userData.groups[groupId].weeklyStats[currentWeekStart] || 0;
            } else if (!groupId) {
                // Get global weekly stats
                messageCount = userData.weeklyStats[currentWeekStart] || 0;
            }
            
            if (messageCount > 0) {
                // Get contact name if available
                const contact = database.getContact(userId.split('@')[0]) || {};
                const name = contact.name || userId.split('@')[0];
                
                leaderboard.push({
                    userId,
                    name,
                    messageCount
                });
            }
        });
        
        // Sort by message count and limit results
        return leaderboard
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, limit);
            
    } catch (error) {
        console.error('Error getting weekly leaderboard:', error);
        return [];
    }
}

/**
 * Get monthly leaderboard for a specific group or global
 * 
 * @param {string} groupId - Optional group ID to get stats for
 * @param {number} limit - Max number of users to return
 * @returns {Array} Array of users sorted by message count
 */
function getMonthlyLeaderboard(groupId = null, limit = 10) {
    try {
        const statsData = getStatsData();
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        
        const leaderboard = [];
        
        // Process each user's data
        Object.keys(statsData.users).forEach(userId => {
            const userData = statsData.users[userId];
            let messageCount = 0;
            
            if (groupId && userData.groups && userData.groups[groupId]) {
                // Get group-specific monthly stats
                messageCount = userData.groups[groupId].monthlyStats[currentMonthStart] || 0;
            } else if (!groupId) {
                // Get global monthly stats
                messageCount = userData.monthlyStats[currentMonthStart] || 0;
            }
            
            if (messageCount > 0) {
                // Get contact name if available
                const contact = database.getContact(userId.split('@')[0]) || {};
                const name = contact.name || userId.split('@')[0];
                
                leaderboard.push({
                    userId,
                    name,
                    messageCount
                });
            }
        });
        
        // Sort by message count and limit results
        return leaderboard
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, limit);
            
    } catch (error) {
        console.error('Error getting monthly leaderboard:', error);
        return [];
    }
}

/**
 * Generate a formatted leaderboard message
 * 
 * @param {Array} leaderboard - Array of user data sorted by message count
 * @param {string} title - Title for the leaderboard
 * @returns {string} Formatted leaderboard message
 */
function formatLeaderboardMessage(leaderboard, title) {
    if (leaderboard.length === 0) {
        return `📊 *${title}*\n\nNo messages recorded for this period.`;
    }
    
    let message = `📊 *${title}*\n\n`;
    
    leaderboard.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${user.name}: ${user.messageCount} messages\n`;
    });
    
    return message;
}

/**
 * Generate a complete leaderboard message with daily, weekly, and monthly stats
 * 
 * @param {string} groupId - Optional group ID to get stats for
 * @returns {string} Formatted complete leaderboard message
 */
function getLeaderboardMessage(groupId = null) {
    try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });
        
        const groupInfo = groupId ? ` for this group` : '';
        let message = `📊 *MESSAGE LEADERBOARD${groupInfo}*\n${dateStr}\n\n`;
        
        // Get all leaderboards
        const dailyLeaderboard = getDailyLeaderboard(groupId, 10);
        const weeklyLeaderboard = getWeeklyLeaderboard(groupId, 10);
        const monthlyLeaderboard = getMonthlyLeaderboard(groupId, 10);
        
        // Daily leaderboard
        message += `*TODAY'S TOP CHATTERS*\n`;
        if (dailyLeaderboard.length === 0) {
            message += `No messages recorded today.\n`;
        } else {
            dailyLeaderboard.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                message += `${medal} ${user.name}: ${user.messageCount} messages\n`;
            });
        }
        
        message += `\n*THIS WEEK'S TOP CHATTERS*\n`;
        if (weeklyLeaderboard.length === 0) {
            message += `No messages recorded this week.\n`;
        } else {
            weeklyLeaderboard.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                message += `${medal} ${user.name}: ${user.messageCount} messages\n`;
            });
        }
        
        message += `\n*THIS MONTH'S TOP CHATTERS*\n`;
        if (monthlyLeaderboard.length === 0) {
            message += `No messages recorded this month.\n`;
        } else {
            monthlyLeaderboard.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                message += `${medal} ${user.name}: ${user.messageCount} messages\n`;
            });
        }
        
        return message;
        
    } catch (error) {
        console.error('Error generating leaderboard message:', error);
        return '❌ Error generating leaderboard. Please try again later.';
    }
}

module.exports = {
    initMessageStats,
    recordUserMessage,
    getDailyLeaderboard,
    getWeeklyLeaderboard,
    getMonthlyLeaderboard,
    getLeaderboardMessage
};