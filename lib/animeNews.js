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
        const response = await fetch(config.animeNewsApiUrl);
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching anime news:', error);
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
    try {
        // Get all groups
        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.values(chats);
        
        if (groups.length === 0) {
            console.log('No groups found to send anime news');
            return;
        }
        
        // Fetch anime news
        const animeList = await fetchLatestAnimeNews();
        
        if (animeList.length === 0) {
            console.log('No anime news found');
            return;
        }
        
        // Find new anime news (not sent before)
        const newAnimeNews = animeList.filter(anime => !sentNewsIds.has(anime.mal_id));
        
        if (newAnimeNews.length === 0) {
            console.log('No new anime news to send');
            return;
        }
        
        // Select one random news item to send
        const randomIndex = Math.floor(Math.random() * newAnimeNews.length);
        const newsItem = newAnimeNews[randomIndex];
        
        // Mark as sent
        sentNewsIds.add(newsItem.mal_id);
        
        // If set gets too large, clear older entries
        if (sentNewsIds.size > 100) {
            const idsArray = Array.from(sentNewsIds);
            sentNewsIds = new Set(idsArray.slice(idsArray.length - 50));
        }
        
        // Format the news
        const formattedNews = formatAnimeNews(newsItem);
        
        // Send to each group
        for (const group of groups) {
            try {
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
                
                console.log(`Sent anime news to group: ${groupJid}`);
            } catch (error) {
                console.error(`Error sending anime news to group ${group.id}:`, error);
            }
        }
        
        console.log(`Sent anime news update to ${groups.length} groups`);
    } catch (error) {
        console.error('Error in sendAnimeNewsUpdates:', error);
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
        // Fetch anime news
        const animeList = await fetchLatestAnimeNews();
        
        if (animeList.length === 0) {
            await sock.sendMessage(jid, { text: "Sorry, couldn't find any anime news at the moment." });
            return false;
        }
        
        // Select random anime news
        const randomIndex = Math.floor(Math.random() * animeList.length);
        const newsItem = animeList[randomIndex];
        
        // Format the news
        const formattedNews = formatAnimeNews(newsItem);
        
        // Send image with caption if available
        if (formattedNews.imageUrl) {
            await sock.sendMessage(jid, {
                image: { url: formattedNews.imageUrl },
                caption: formattedNews.text
            });
        } else {
            // Send text only
            await sock.sendMessage(jid, { text: formattedNews.text });
        }
        
        return true;
    } catch (error) {
        console.error('Error in sendAnimeNewsToChat:', error);
        await sock.sendMessage(jid, { 
            text: "Sorry, there was an error fetching anime news. Please try again later."
        });
        return false;
    }
}

module.exports = {
    fetchLatestAnimeNews,
    sendAnimeNewsUpdates,
    sendAnimeNewsToChat
};
