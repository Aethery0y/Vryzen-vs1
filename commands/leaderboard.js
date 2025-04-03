/**
 * Leaderboard Commands
 * Provides commands to display message statistics and user rankings
 */

const messageStats = require('../lib/messageStats');

const handlers = {
    /**
     * Display the leaderboard for the current chat
     * This shows the top message senders for today, this week, and this month
     * 
     * @param {Object} sock - WhatsApp socket connection
     * @param {Object} message - Message object
     * @param {Object} context - Message context
     * @param {Array} args - Command arguments
     */
    leaderboard: async (sock, message, context, args) => {
        try {
            const { isGroup, chat } = context;
            let leaderboardMessage;
            
            if (isGroup) {
                // Generate group-specific leaderboard
                leaderboardMessage = messageStats.getLeaderboardMessage(chat);
            } else {
                // Generate global leaderboard
                leaderboardMessage = messageStats.getLeaderboardMessage();
            }
            
            // Send the leaderboard message
            await sock.sendMessage(chat, {
                text: leaderboardMessage
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error displaying leaderboard:', error);
            await sock.sendMessage(chat, {
                text: '❌ Error generating leaderboard. Please try again later.'
            }, { quoted: message });
        }
    },
    
    /**
     * Display the daily leaderboard for the current chat
     * 
     * @param {Object} sock - WhatsApp socket connection
     * @param {Object} message - Message object
     * @param {Object} context - Message context
     * @param {Array} args - Command arguments
     */
    daily: async (sock, message, context, args) => {
        try {
            const { isGroup, chat } = context;
            const dailyLeaderboard = messageStats.getDailyLeaderboard(isGroup ? chat : null, 10);
            const leaderboardMessage = messageStats.formatLeaderboardMessage(
                dailyLeaderboard, 
                `Today's Top Chatters${isGroup ? ' in this group' : ''}`
            );
            
            // Send the daily leaderboard message
            await sock.sendMessage(chat, {
                text: leaderboardMessage
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error displaying daily leaderboard:', error);
            await sock.sendMessage(chat, {
                text: '❌ Error generating daily leaderboard. Please try again later.'
            }, { quoted: message });
        }
    },
    
    /**
     * Display the weekly leaderboard for the current chat
     * 
     * @param {Object} sock - WhatsApp socket connection
     * @param {Object} message - Message object
     * @param {Object} context - Message context
     * @param {Array} args - Command arguments
     */
    weekly: async (sock, message, context, args) => {
        try {
            const { isGroup, chat } = context;
            const weeklyLeaderboard = messageStats.getWeeklyLeaderboard(isGroup ? chat : null, 10);
            const leaderboardMessage = messageStats.formatLeaderboardMessage(
                weeklyLeaderboard, 
                `This Week's Top Chatters${isGroup ? ' in this group' : ''}`
            );
            
            // Send the weekly leaderboard message
            await sock.sendMessage(chat, {
                text: leaderboardMessage
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error displaying weekly leaderboard:', error);
            await sock.sendMessage(chat, {
                text: '❌ Error generating weekly leaderboard. Please try again later.'
            }, { quoted: message });
        }
    },
    
    /**
     * Display the monthly leaderboard for the current chat
     * 
     * @param {Object} sock - WhatsApp socket connection
     * @param {Object} message - Message object
     * @param {Object} context - Message context
     * @param {Array} args - Command arguments
     */
    monthly: async (sock, message, context, args) => {
        try {
            const { isGroup, chat } = context;
            const monthlyLeaderboard = messageStats.getMonthlyLeaderboard(isGroup ? chat : null, 10);
            const leaderboardMessage = messageStats.formatLeaderboardMessage(
                monthlyLeaderboard, 
                `This Month's Top Chatters${isGroup ? ' in this group' : ''}`
            );
            
            // Send the monthly leaderboard message
            await sock.sendMessage(chat, {
                text: leaderboardMessage
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error displaying monthly leaderboard:', error);
            await sock.sendMessage(chat, {
                text: '❌ Error generating monthly leaderboard. Please try again later.'
            }, { quoted: message });
        }
    }
};

module.exports = {
    handlers,
    info: {
        name: 'Leaderboard Commands',
        description: 'Display messaging activity statistics and rankings',
        commands: [
            {
                name: '.leaderboard',
                description: 'Display the full message leaderboard with daily, weekly, and monthly rankings',
                usage: '.leaderboard',
                example: '.leaderboard'
            },
            {
                name: '.daily',
                description: 'Display today\'s message leaderboard',
                usage: '.daily',
                example: '.daily'
            },
            {
                name: '.weekly',
                description: 'Display this week\'s message leaderboard',
                usage: '.weekly',
                example: '.weekly'
            },
            {
                name: '.monthly',
                description: 'Display this month\'s message leaderboard',
                usage: '.monthly',
                example: '.monthly'
            }
        ]
    }
};