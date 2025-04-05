/**
 * Anime-related commands for the WhatsApp bot
 */

const animeNews = require('../lib/animeNews');

/**
 * Command handler for anime commands
 */
const animeCommands = {
    /**
     * Fetch and send anime news
     */
    news: {
        help: 'Fetch the latest anime news',
        description: 'Get trending anime updates from AniList',
        usage: '.animenews [count]',
        handler: async (sock, remoteJid, message, sender, args) => {
            try {
                // Check if count parameter was provided
                const count = args.length > 0 && !isNaN(args[0]) ? parseInt(args[0]) : 1;
                
                // Limit count to reasonable value to prevent flooding
                const limitedCount = Math.min(count, 5);
                
                await animeNews.sendAnimeNewsCommand(sock, remoteJid, message, limitedCount);
                
                return { success: true };
            } catch (error) {
                console.error('Error in anime news command:', error);
                return {
                    success: false,
                    message: `⚠️ Error fetching anime news: ${error.message}`
                };
            }
        }
    },
    
    /**
     * Subscribe a group to automatic anime news
     */
    subscribe: {
        help: 'Subscribe to anime news updates',
        description: 'Enable automatic anime news updates every 10 minutes in this group',
        usage: '.anime subscribe',
        handler: async (sock, remoteJid, message, sender, args) => {
            try {
                const result = animeNews.subscribeGroupToNews(remoteJid);
                return {
                    success: result.success,
                    message: result.message
                };
            } catch (error) {
                console.error('Error in anime subscribe command:', error);
                return {
                    success: false,
                    message: `⚠️ Error subscribing to anime news: ${error.message}`
                };
            }
        }
    },
    
    /**
     * Unsubscribe a group from automatic anime news
     */
    unsubscribe: {
        help: 'Unsubscribe from anime news updates',
        description: 'Disable automatic anime news updates in this group',
        usage: '.anime unsubscribe',
        handler: async (sock, remoteJid, message, sender, args) => {
            try {
                const result = animeNews.unsubscribeGroupFromNews(remoteJid);
                return {
                    success: result.success,
                    message: result.message
                };
            } catch (error) {
                console.error('Error in anime unsubscribe command:', error);
                return {
                    success: false,
                    message: `⚠️ Error unsubscribing from anime news: ${error.message}`
                };
            }
        }
    }
};

module.exports = animeCommands;