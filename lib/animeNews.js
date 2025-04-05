/**
 * Anime News Module
 * Fetches and formats anime news from various sources
 */

const fetch = require('node-fetch');
const schedule = require('node-schedule');
const { v4: uuidv4 } = require('uuid');

// Cache to store recently fetched news to avoid duplicates
let newsCache = [];
const MAX_CACHE_SIZE = 50;

// Schedule for news updates (every 10 minutes)
let newsJob = null;
let activeGroups = new Set();

/**
 * Initialize the news scheduler
 * @param {Object} sock - Baileys socket connection
 */
function initNewsScheduler(sock) {
    if (newsJob) {
        newsJob.cancel();
    }
    
    console.log('🗞️ Initializing anime news scheduler...');
    newsJob = schedule.scheduleJob('*/10 * * * *', async function() {
        try {
            const news = await fetchLatestAnimeNews();
            if (news && news.length > 0) {
                const latestNews = news[0];
                
                // Send to all active groups
                for (const groupJid of activeGroups) {
                    try {
                        await sendNewsToGroup(sock, groupJid, latestNews);
                    } catch (error) {
                        console.error(`Error sending news to group ${groupJid}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error in news scheduler:', error);
        }
    });
}

/**
 * Add a group to receive automatic news updates
 * @param {string} groupJid - JID of the group
 * @returns {Object} Status object with success flag and message
 */
function subscribeGroupToNews(groupJid) {
    if (activeGroups.has(groupJid)) {
        return { success: false, message: '⚠️ This group is already subscribed to anime news updates.' };
    }
    
    activeGroups.add(groupJid);
    return { success: true, message: '✅ This group will now receive anime news updates every 10 minutes!' };
}

/**
 * Remove a group from automatic news updates
 * @param {string} groupJid - JID of the group
 * @returns {Object} Status object with success flag and message
 */
function unsubscribeGroupFromNews(groupJid) {
    if (!activeGroups.has(groupJid)) {
        return { success: false, message: '⚠️ This group is not subscribed to anime news updates.' };
    }
    
    activeGroups.delete(groupJid);
    return { success: true, message: '✅ This group will no longer receive automatic anime news updates.' };
}

/**
 * Fetch latest anime news from AniList GraphQL API
 * @returns {Array} Array of news items
 */
async function fetchLatestAnimeNews() {
    try {
        // Using AniList GraphQL API to fetch recent anime news
        const query = `
            query {
                Page(page: 1, perPage: 5) {
                    media(type: ANIME, sort: TRENDING_DESC) {
                        id
                        title {
                            romaji
                            english
                        }
                        description
                        coverImage {
                            large
                        }
                        siteUrl
                        trending
                        popularity
                        status
                        episodes
                        nextAiringEpisode {
                            airingAt
                            episode
                        }
                    }
                }
            }
        `;
        
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        
        if (data.errors) {
            console.error('Error fetching from AniList:', data.errors);
            return [];
        }
        
        // Process and format the news
        const newsItems = data.data.Page.media.map(anime => {
            const newsId = uuidv4();
            
            // Clean up description (remove HTML tags)
            let description = anime.description || 'No description available';
            description = description.replace(/<[^>]*>/g, '');
            description = description.length > 150 ? description.substring(0, 147) + '...' : description;
            
            // Set status message
            let statusMsg = '';
            if (anime.status === 'RELEASING' && anime.nextAiringEpisode) {
                const airingDate = new Date(anime.nextAiringEpisode.airingAt * 1000);
                const now = new Date();
                const diffDays = Math.floor((airingDate - now) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    statusMsg = `🔥 Episode ${anime.nextAiringEpisode.episode} airing TODAY!`;
                } else if (diffDays === 1) {
                    statusMsg = `⏰ Episode ${anime.nextAiringEpisode.episode} airing TOMORROW!`;
                } else {
                    statusMsg = `⏳ Episode ${anime.nextAiringEpisode.episode} airing in ${diffDays} days`;
                }
            } else if (anime.status === 'FINISHED') {
                statusMsg = `✅ Complete anime with ${anime.episodes} episodes`;
            }
            
            return {
                id: newsId,
                title: anime.title.english || anime.title.romaji,
                description,
                statusMsg,
                imageUrl: anime.coverImage.large,
                link: anime.siteUrl,
                trending: anime.trending,
                popularity: anime.popularity
            };
        });
        
        // Filter out news we've already cached
        const newItems = newsItems.filter(item => 
            !newsCache.some(cached => cached.title === item.title));
        
        // Update cache
        if (newItems.length > 0) {
            newsCache = [...newItems, ...newsCache].slice(0, MAX_CACHE_SIZE);
        }
        
        return newsItems;
    } catch (error) {
        console.error('Error fetching anime news:', error);
        return [];
    }
}

/**
 * Send a news item to a specific group
 * @param {Object} sock - Baileys socket connection
 * @param {string} groupJid - JID of the group to send to
 * @param {Object} newsItem - News item object
 */
async function sendNewsToGroup(sock, groupJid, newsItem) {
    try {
        const caption = `🔰 *ANIME NEWS UPDATE* 🔰\n\n` +
                      `📺 *${newsItem.title}*\n\n` +
                      `${newsItem.description}\n\n` +
                      `${newsItem.statusMsg}\n\n` +
                      `🌟 Trending score: ${newsItem.trending}\n` +
                      `👥 Popularity: ${newsItem.popularity}\n\n` +
                      `🔗 More info: ${newsItem.link}`;
        
        // Try to send with image first
        if (newsItem.imageUrl) {
            try {
                await sock.sendMessage(groupJid, {
                    image: { url: newsItem.imageUrl },
                    caption: caption
                });
                return;
            } catch (imageError) {
                console.warn('Failed to send news with image, falling back to text only:', imageError.message);
            }
        }
        
        // Fallback to text-only message
        await sock.sendMessage(groupJid, { text: caption });
        
    } catch (error) {
        console.error('Error sending anime news to group:', error);
        throw error;
    }
}

/**
 * Get multiple news items for manual command
 * @param {Object} sock - Baileys socket connection
 * @param {string} jid - JID to send news to
 * @param {Object} message - Original message for quoting
 * @param {number} count - Number of news items to fetch (default: 1)
 */
async function sendAnimeNewsCommand(sock, jid, message, count = 1) {
    try {
        await sock.sendMessage(jid, { 
            text: '🔍 Fetching the latest anime news...' 
        }, { quoted: message });
        
        const newsItems = await fetchLatestAnimeNews();
        
        if (!newsItems || newsItems.length === 0) {
            await sock.sendMessage(jid, { 
                text: '⚠️ Failed to fetch anime news. Please try again later.' 
            }, { quoted: message });
            return;
        }
        
        // Limit to requested count or available items
        const itemsToSend = newsItems.slice(0, Math.min(count, newsItems.length));
        
        for (const item of itemsToSend) {
            await sendNewsToGroup(sock, jid, item);
            
            // Wait a bit between messages to prevent flooding
            if (itemsToSend.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
    } catch (error) {
        console.error('Error sending anime news command:', error);
        await sock.sendMessage(jid, { 
            text: `⚠️ Error fetching anime news: ${error.message}` 
        }, { quoted: message });
    }
}

module.exports = {
    initNewsScheduler,
    subscribeGroupToNews,
    unsubscribeGroupFromNews,
    fetchLatestAnimeNews,
    sendAnimeNewsCommand
};