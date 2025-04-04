/**
 * Leaderboard Command Handlers
 * Provides commands to display message statistics and rankings in groups
 */

const messageStats = require('../lib/messageStats');
const config = require('../config');

/**
 * Format a leaderboard for display
 * @param {Array} leaderboard - Array of user entries with userId and count
 * @param {string} timeframe - Timeframe description (daily, weekly, monthly, all-time)
 * @param {Function} getUserName - Function to get user display name
 * @returns {string} Formatted leaderboard message
 */
function formatLeaderboard(leaderboard, timeframe, getUserName) {
    if (!leaderboard || leaderboard.length === 0) {
        return `No ${timeframe} message data found for this group.`;
    }
    
    // Create leaderboard header
    let message = `📊 *${timeframe.toUpperCase()} MESSAGE LEADERBOARD* 📊\n\n`;
    
    // Add each user entry
    leaderboard.forEach((entry, index) => {
        const rank = index + 1;
        const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}.`;
        const userName = getUserName(entry.userId) || `User ${entry.userId}`;
        message += `${medal} ${userName}: ${entry.count} messages\n`;
    });
    
    message += `\nUpdated: ${new Date().toLocaleString()}`;
    
    return message;
}

/**
 * Handle daily leaderboard command
 * @param {Object} params - Command parameters
 * @returns {Promise<string>} - Command response
 */
async function handleDailyLeaderboard(params) {
    const { remoteJid, sock } = params;
    
    // Only available in groups
    if (!remoteJid.endsWith('@g.us')) {
        return "This command is only available in groups.";
    }
    
    // Get daily leaderboard
    const leaderboard = messageStats.getDailyLeaderboard(remoteJid, 10);
    
    // Function to get user name from JID
    const getUserName = async (userId) => {
        try {
            // First try to get name from WhatsApp
            const fullJid = `${userId}@s.whatsapp.net`;
            const [result] = await sock.onWhatsApp(fullJid);
            
            if (result && result.exists) {
                try {
                    // Try to get user info
                    const userInfo = await sock.getContactInfo(fullJid);
                    if (userInfo && userInfo.notify) {
                        return userInfo.notify;
                    }
                } catch (error) {
                    // Silently fail, will use phone number instead
                }
            }
            
            // Use phone number as fallback
            return formatPhoneNumber(userId);
        } catch (error) {
            // Fallback to just showing the ID
            return formatPhoneNumber(userId);
        }
    };
    
    // Format the leaderboard with user names
    const formattedLeaderboard = formatLeaderboard(leaderboard, 'daily', getUserName);
    
    return formattedLeaderboard;
}

/**
 * Handle weekly leaderboard command
 * @param {Object} params - Command parameters
 * @returns {Promise<string>} - Command response
 */
async function handleWeeklyLeaderboard(params) {
    const { remoteJid, sock } = params;
    
    // Only available in groups
    if (!remoteJid.endsWith('@g.us')) {
        return "This command is only available in groups.";
    }
    
    // Get weekly leaderboard
    const leaderboard = messageStats.getWeeklyLeaderboard(remoteJid, 10);
    
    // Function to get user name from JID
    const getUserName = async (userId) => {
        try {
            // First try to get name from WhatsApp
            const fullJid = `${userId}@s.whatsapp.net`;
            const [result] = await sock.onWhatsApp(fullJid);
            
            if (result && result.exists) {
                try {
                    // Try to get user info
                    const userInfo = await sock.getContactInfo(fullJid);
                    if (userInfo && userInfo.notify) {
                        return userInfo.notify;
                    }
                } catch (error) {
                    // Silently fail, will use phone number instead
                }
            }
            
            // Use phone number as fallback
            return formatPhoneNumber(userId);
        } catch (error) {
            // Fallback to just showing the ID
            return formatPhoneNumber(userId);
        }
    };
    
    // Format the leaderboard with user names
    const formattedLeaderboard = formatLeaderboard(leaderboard, 'weekly', getUserName);
    
    return formattedLeaderboard;
}

/**
 * Handle monthly leaderboard command
 * @param {Object} params - Command parameters
 * @returns {Promise<string>} - Command response
 */
async function handleMonthlyLeaderboard(params) {
    const { remoteJid, sock } = params;
    
    // Only available in groups
    if (!remoteJid.endsWith('@g.us')) {
        return "This command is only available in groups.";
    }
    
    // Get monthly leaderboard
    const leaderboard = messageStats.getMonthlyLeaderboard(remoteJid, 10);
    
    // Function to get user name from JID
    const getUserName = async (userId) => {
        try {
            // First try to get name from WhatsApp
            const fullJid = `${userId}@s.whatsapp.net`;
            const [result] = await sock.onWhatsApp(fullJid);
            
            if (result && result.exists) {
                try {
                    // Try to get user info
                    const userInfo = await sock.getContactInfo(fullJid);
                    if (userInfo && userInfo.notify) {
                        return userInfo.notify;
                    }
                } catch (error) {
                    // Silently fail, will use phone number instead
                }
            }
            
            // Use phone number as fallback
            return formatPhoneNumber(userId);
        } catch (error) {
            // Fallback to just showing the ID
            return formatPhoneNumber(userId);
        }
    };
    
    // Format the leaderboard with user names
    const formattedLeaderboard = formatLeaderboard(leaderboard, 'monthly', getUserName);
    
    return formattedLeaderboard;
}

/**
 * Handle all-time leaderboard command
 * @param {Object} params - Command parameters
 * @returns {Promise<string>} - Command response
 */
async function handleAllTimeLeaderboard(params) {
    const { remoteJid, sock } = params;
    
    // Only available in groups
    if (!remoteJid.endsWith('@g.us')) {
        return "This command is only available in groups.";
    }
    
    // Get all-time leaderboard
    const leaderboard = messageStats.getAllTimeLeaderboard(remoteJid, 10);
    
    // Function to get user name from JID
    const getUserName = async (userId) => {
        try {
            // First try to get name from WhatsApp
            const fullJid = `${userId}@s.whatsapp.net`;
            const [result] = await sock.onWhatsApp(fullJid);
            
            if (result && result.exists) {
                try {
                    // Try to get user info
                    const userInfo = await sock.getContactInfo(fullJid);
                    if (userInfo && userInfo.notify) {
                        return userInfo.notify;
                    }
                } catch (error) {
                    // Silently fail, will use phone number instead
                }
            }
            
            // Use phone number as fallback
            return formatPhoneNumber(userId);
        } catch (error) {
            // Fallback to just showing the ID
            return formatPhoneNumber(userId);
        }
    };
    
    // Format the leaderboard with user names
    const formattedLeaderboard = formatLeaderboard(leaderboard, 'all-time', getUserName);
    
    return formattedLeaderboard;
}

/**
 * Format a phone number to make it more readable
 * @param {string} phoneNumber - Raw phone number string
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
    // Remove any prefix like "+" if present
    phoneNumber = phoneNumber.replace(/^\+/, '');
    
    // Basic formatting based on length
    if (phoneNumber.length <= 5) {
        return phoneNumber;
    } else if (phoneNumber.length <= 8) {
        return phoneNumber.slice(0, 3) + '-' + phoneNumber.slice(3);
    } else if (phoneNumber.length <= 10) {
        return phoneNumber.slice(0, 3) + '-' + phoneNumber.slice(3, 6) + '-' + phoneNumber.slice(6);
    } else {
        // For longer international numbers
        return '+' + phoneNumber.slice(0, 2) + ' ' + 
               phoneNumber.slice(2, 5) + '-' + 
               phoneNumber.slice(5, 8) + '-' + 
               phoneNumber.slice(8);
    }
}

/**
 * Get user statistics
 * @param {Object} params - Command parameters
 * @returns {Promise<string>} - Command response
 */
async function handleUserStats(params) {
    const { remoteJid, quotedMsg, sender, sock } = params;
    
    // Only available in groups
    if (!remoteJid.endsWith('@g.us')) {
        return "This command is only available in groups.";
    }
    
    // Determine which user to check
    let targetUser = sender;
    
    // If there's a quoted message, use that sender instead
    if (quotedMsg) {
        const contextInfo = params.message.message?.extendedTextMessage?.contextInfo;
        if (contextInfo && contextInfo.participant) {
            targetUser = contextInfo.participant;
        }
    }
    
    // Get user stats
    const stats = messageStats.getUserStats(remoteJid, targetUser);
    
    if (!stats) {
        return "No message statistics found for this user.";
    }
    
    // Function to get user name
    const getUserName = async (userId) => {
        try {
            // First try to get name from WhatsApp
            const fullJid = `${userId}@s.whatsapp.net`;
            const [result] = await sock.onWhatsApp(fullJid);
            
            if (result && result.exists) {
                try {
                    // Try to get user info
                    const userInfo = await sock.getContactInfo(fullJid);
                    if (userInfo && userInfo.notify) {
                        return userInfo.notify;
                    }
                } catch (error) {
                    // Silently fail, will use phone number instead
                }
            }
            
            // Use phone number as fallback
            return formatPhoneNumber(userId);
        } catch (error) {
            // Fallback to just showing the ID
            return formatPhoneNumber(userId);
        }
    };
    
    const userName = await getUserName(stats.userId);
    
    // Format stats message
    let message = `📊 *MESSAGE STATISTICS FOR ${userName}* 📊\n\n`;
    message += `Today: ${stats.dailyMessages} messages\n`;
    message += `This Week: ${stats.weeklyMessages} messages\n`;
    message += `This Month: ${stats.monthlyMessages} messages\n`;
    message += `All Time: ${stats.totalMessages} messages\n\n`;
    message += `Updated: ${new Date().toLocaleString()}`;
    
    return message;
}

// Export command handlers
module.exports = {
    handleDailyLeaderboard,
    handleWeeklyLeaderboard,
    handleMonthlyLeaderboard,
    handleAllTimeLeaderboard,
    handleUserStats
};