// Use node-fetch v2 which supports CommonJS
// This is a workaround since v3+ is ESM only
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const config = require('../config');
const database = require('./database');

// Keep track of already sent news to avoid duplicates
let sentNewsIds = new Set();

/**
 * Fetches the latest anime news from the API
 * 
 * @returns {Promise<Array>} Array of news items
 */
async function fetchLatestAnimeNews() {
    try {
        const response = await fetch(config.animeNewsApiUrl, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });
        
        if (!response.ok) {
            console.log(`Anime API responded with status: ${response.status}. URL: ${config.animeNewsApiUrl}`);
            return []; // Return empty array instead of throwing
        }
        
        const data = await response.json();
        
        // If data or data.data is undefined/null, return empty array
        if (!data || !data.data) {
            console.log('Anime API returned invalid data format:', data);
            return [];
        }
        
        return data.data;
    } catch (error) {
        console.error('Error fetching anime news:', error);
        // Don't let this crash the application
        return [];
    }
}

/**
 * Formats anime news into a readable message
 * 
 * @param {Object} anime - Anime news item
 * @returns {Object} Formatted message with text and image URL
 */
function formatAnimeNews(anime) {
    const title = anime.title || 'New Anime Update';
    const synopsis = anime.synopsis || 'No description available';
    const url = anime.url || '';
    const imageUrl = anime.images?.jpg?.image_url || '';
    
    // Create message text
    const message = `📺 *${title}*\n\n` +
                    `${synopsis.substring(0, 200)}${synopsis.length > 200 ? '...' : ''}\n\n` +
                    `🔗 More info: ${url}`;
    
    return {
        text: message,
        imageUrl
    };
}

/**
 * Sends anime news updates to all groups
 * 
 * @param {Object} sock - The WhatsApp socket
 * @returns {Promise<void>}
 */
async function sendAnimeNewsUpdates(sock) {
    // Don't throw errors from this function - it runs on a schedule
    try {
        // Make sure sock is valid
        if (!sock || typeof sock.groupFetchAllParticipating !== 'function') {
            console.log('Invalid sock object in sendAnimeNewsUpdates, skipping anime news update');
            return;
        }
        
        // Get all groups - with error handling
        let groups = [];
        try {
            const chats = await sock.groupFetchAllParticipating();
            groups = Object.values(chats);
        } catch (groupError) {
            console.error('Error fetching groups for anime news:', groupError);
            return;
        }
        
        if (groups.length === 0) {
            console.log('No groups found to send anime news');
            return;
        }
        
        // Fetch anime news
        const animeList = await fetchLatestAnimeNews();
        
        if (!animeList || animeList.length === 0) {
            console.log('No anime news found or empty anime list returned');
            return;
        }
        
        // Find new anime news (not sent before)
        const newAnimeNews = animeList.filter(anime => anime && anime.mal_id && !sentNewsIds.has(anime.mal_id));
        
        if (newAnimeNews.length === 0) {
            console.log('No new anime news to send');
            return;
        }
        
        // Select one random news item to send
        const randomIndex = Math.floor(Math.random() * newAnimeNews.length);
        const newsItem = newAnimeNews[randomIndex];
        
        if (!newsItem || !newsItem.mal_id) {
            console.log('Invalid news item selected:', newsItem);
            return;
        }
        
        // Mark as sent
        sentNewsIds.add(newsItem.mal_id);
        
        // If set gets too large, clear older entries
        if (sentNewsIds.size > 100) {
            const idsArray = Array.from(sentNewsIds);
            sentNewsIds = new Set(idsArray.slice(idsArray.length - 50));
        }
        
        // Format the news
        const formattedNews = formatAnimeNews(newsItem);
        
        // Keep track of successful sends
        let successCount = 0;
        
        // Send to each group
        for (const group of groups) {
            try {
                if (!group || !group.id) continue;
                
                const groupJid = group.id;
                
                // Send image with caption if available
                if (formattedNews.imageUrl) {
                    await sock.sendMessage(groupJid, {
                        image: { url: formattedNews.imageUrl },
                        caption: formattedNews.text
                    });
                } else {
                    // Send text only
                    await sock.sendMessage(groupJid, { text: formattedNews.text });
                }
                
                successCount++;
                console.log(`Sent anime news to group: ${groupJid}`);
                
                // Small delay between sends to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Error sending anime news to group ${group?.id || 'unknown'}:`, error);
            }
        }
        
        console.log(`Sent anime news update to ${successCount} out of ${groups.length} groups`);
    } catch (error) {
        console.error('Error in sendAnimeNewsUpdates:', error);
        // Never let this crash the application
    }
}

/**
 * Sends a single anime news update to a specific chat
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} jid - Chat JID to send to
 * @returns {Promise<boolean>} Success status
 */
async function sendAnimeNewsToChat(sock, jid) {
    try {
        // Validate inputs
        if (!sock || typeof sock.sendMessage !== 'function' || !jid) {
            console.error('Invalid parameters for sendAnimeNewsToChat');
            return false;
        }
        
        // Fetch anime news with additional error handling
        let animeList = [];
        try {
            animeList = await fetchLatestAnimeNews();
        } catch (fetchError) {
            console.error('Error fetching anime news for chat:', fetchError);
            await sock.sendMessage(jid, { text: "Sorry, couldn't connect to the anime database at the moment. Please try again later." });
            return false;
        }
        
        if (!animeList || animeList.length === 0) {
            await sock.sendMessage(jid, { text: "Sorry, couldn't find any anime news at the moment. The API might be temporarily unavailable." });
            return false;
        }
        
        // Filter out any malformed items
        const validAnimeList = animeList.filter(item => item && item.mal_id);
        
        if (validAnimeList.length === 0) {
            await sock.sendMessage(jid, { text: "Sorry, the anime data received was invalid. Please try again later." });
            return false;
        }
        
        // Select random anime news
        const randomIndex = Math.floor(Math.random() * validAnimeList.length);
        const newsItem = validAnimeList[randomIndex];
        
        // Format the news with error handling
        let formattedNews;
        try {
            formattedNews = formatAnimeNews(newsItem);
        } catch (formatError) {
            console.error('Error formatting anime news:', formatError, 'Item:', newsItem);
            await sock.sendMessage(jid, { text: "Sorry, there was an error processing the anime information. Please try again later." });
            return false;
        }
        
        // Send image with caption if available
        try {
            if (formattedNews.imageUrl) {
                await sock.sendMessage(jid, {
                    image: { url: formattedNews.imageUrl },
                    caption: formattedNews.text
                });
            } else {
                // Send text only
                await sock.sendMessage(jid, { text: formattedNews.text });
            }
            
            // Add to sent IDs to avoid showing again soon
            if (newsItem.mal_id) {
                sentNewsIds.add(newsItem.mal_id);
            }
            
            return true;
        } catch (sendError) {
            console.error('Error sending anime news message:', sendError);
            // Try one more time with just text
            try {
                await sock.sendMessage(jid, { text: formattedNews.text });
                return true;
            } catch (retryError) {
                console.error('Error sending text-only anime news:', retryError);
                await sock.sendMessage(jid, { 
                    text: "Sorry, there was an error sending the anime information. Please try again later."
                });
                return false;
            }
        }
    } catch (error) {
        console.error('Unexpected error in sendAnimeNewsToChat:', error);
        try {
            await sock.sendMessage(jid, { 
                text: "Sorry, there was an unexpected error with the anime news feature. Please try again later."
            });
        } catch (finalError) {
            console.error('Could not send error message:', finalError);
        }
        return false;
    }
}

module.exports = {
    fetchLatestAnimeNews,
    sendAnimeNewsUpdates,
    sendAnimeNewsToChat
};
