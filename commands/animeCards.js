/**
 * Anime Cards Commands for WhatsApp Bot
 * Handles card game related commands
 */

const animeCardGame = require('../lib/animeCardGame');
const pointsSystem = require('../lib/pointsSystem');

/**
 * Handle card game commands
 * @param {object} params Command parameters
 */
async function handleCardCommand(params) {
    const { sock, message, messageContent, sender, remoteJid, quotedMsg } = params;
    
    // Get command and arguments
    const parts = messageContent.split(' ');
    const subCommand = parts[1]?.toLowerCase();
    
    // Extract args (combine remaining parts)
    const args = parts.slice(2).join(' ');
    
    switch (subCommand) {
        case 'draw':
            await drawCard(sock, remoteJid, sender);
            break;
            
        case 'inventory':
        case 'inv':
            await showInventory(sock, remoteJid, sender, args);
            break;
            
        case 'stats':
            await showCardStats(sock, remoteJid, sender, args);
            break;
            
        case 'trade':
            await tradeCard(sock, remoteJid, sender, args, quotedMsg);
            break;
            
        case 'help':
        default:
            await showCardHelp(sock, remoteJid);
            break;
    }
}

/**
 * Draw a card for a user
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {string} sender Sender ID
 */
async function drawCard(sock, remoteJid, sender) {
    // Check if the user can draw a card
    if (!animeCardGame.canDrawCard(sender)) {
        await sock.sendMessage(remoteJid, { 
            text: `You've reached your daily card draw limit. Try again tomorrow!`,
            quoted: message 
        });
        return;
    }
    
    // Draw a card
    const result = animeCardGame.drawCard(sender);
    
    if (!result.success) {
        await sock.sendMessage(remoteJid, { 
            text: result.message,
            quoted: message 
        });
        return;
    }
    
    // Format rarity stars
    let rarityStars = '';
    switch (result.card.rarity) {
        case 'common': rarityStars = '⭐'; break;
        case 'uncommon': rarityStars = '⭐⭐'; break;
        case 'rare': rarityStars = '⭐⭐⭐'; break;
        case 'epic': rarityStars = '⭐⭐⭐⭐'; break;
        case 'legendary': rarityStars = '⭐⭐⭐⭐⭐'; break;
    }
    
    // Create card message
    let cardMessage = `*🎴 NEW CARD OBTAINED! 🎴*\n\n`;
    cardMessage += `${rarityStars} *${result.card.rarity.toUpperCase()}*: ${result.card.name}\n`;
    cardMessage += `Anime: ${result.card.anime}\n`;
    cardMessage += `Power: ${result.card.power}\n\n`;
    cardMessage += `_${result.card.description}_\n\n`;
    cardMessage += `_Card ID: ${result.card.id}_\n`;
    cardMessage += `_Use .card inventory to view your collection!_`;
    
    // Send card message
    await sock.sendMessage(remoteJid, { 
        text: cardMessage,
        quoted: message 
    });
}

/**
 * Show a user's card inventory
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {string} sender Sender ID
 * @param {string} userArg Optional user to check inventory for
 */
async function showInventory(sock, remoteJid, sender, userArg) {
    // Determine which user to show stats for
    let targetUser = sender;
    let showingSelf = true;
    
    // If user mentioned someone else
    if (userArg && userArg.startsWith('@')) {
        const mentioned = userArg.substring(1);
        // Convert mentioned username to full JID
        if (/^\d+$/.test(mentioned)) {
            targetUser = mentioned + '@s.whatsapp.net';
            showingSelf = false;
        }
    }
    
    // Generate showcase message
    const showcaseMessage = animeCardGame.generateCardShowcase(targetUser);
    
    // Send message
    await sock.sendMessage(remoteJid, { 
        text: showcaseMessage,
        mentions: showingSelf ? [] : [targetUser]
    });
}

/**
 * Show card game stats for a user
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {string} sender Sender ID
 * @param {string} userArg Optional user to check stats for
 */
async function showCardStats(sock, remoteJid, sender, userArg) {
    // Determine which user to show stats for
    let targetUser = sender;
    let showingSelf = true;
    
    // If user mentioned someone else
    if (userArg && userArg.startsWith('@')) {
        const mentioned = userArg.substring(1);
        // Convert mentioned username to full JID
        if (/^\d+$/.test(mentioned)) {
            targetUser = mentioned + '@s.whatsapp.net';
            showingSelf = false;
        }
    }
    
    // Get card stats
    const stats = animeCardGame.getUserCardStats(targetUser);
    const completion = animeCardGame.getCollectionCompletion(targetUser);
    const points = pointsSystem.getUserPoints(targetUser);
    
    // Format display name
    const displayName = showingSelf ? 'Your' : `@${targetUser.split('@')[0]}'s`;
    
    // Create stats message
    let message = `*${displayName} Anime Card Collection Stats*\n\n`;
    message += `Total cards: ${stats.total}\n`;
    message += `Collection completion: ${completion.percentage}% (${completion.uniqueCards}/${completion.totalUniqueCards})\n\n`;
    
    message += `*Cards by rarity:*\n`;
    message += `⭐ Common: ${stats.byRarity.common}\n`;
    message += `⭐⭐ Uncommon: ${stats.byRarity.uncommon}\n`;
    message += `⭐⭐⭐ Rare: ${stats.byRarity.rare}\n`;
    message += `⭐⭐⭐⭐ Epic: ${stats.byRarity.epic}\n`;
    message += `⭐⭐⭐⭐⭐ Legendary: ${stats.byRarity.legendary}\n\n`;
    
    message += `Current points: ${points}\n\n`;
    
    // Add tip for new users
    if (stats.total === 0) {
        message += `_You haven't collected any cards yet. Use .card draw to get your first card!_`;
    } else {
        message += `_Keep collecting to complete your anime card collection!_`;
    }
    
    // Send message
    await sock.sendMessage(remoteJid, { 
        text: message,
        mentions: showingSelf ? [] : [targetUser]
    });
}

/**
 * Trade a card with another user
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {string} sender Sender ID
 * @param {string} args Command arguments
 * @param {object} quotedMsg Quoted message (if any)
 */
async function tradeCard(sock, remoteJid, sender, args, quotedMsg) {
    // Check if trading is to another user (must be in reply to their message)
    if (!quotedMsg || !quotedMsg.participant) {
        await sock.sendMessage(remoteJid, { 
            text: "To trade a card, reply to the recipient's message with: .card trade [card_id]",
            quoted: message 
        });
        return;
    }
    
    // Get recipient
    const recipient = quotedMsg.participant;
    
    // Check if sender is trying to trade with themselves
    if (recipient === sender) {
        await sock.sendMessage(remoteJid, { 
            text: "You cannot trade cards with yourself!",
            quoted: message 
        });
        return;
    }
    
    // Get card ID from args
    const cardId = args.trim();
    if (!cardId) {
        await sock.sendMessage(remoteJid, { 
            text: "Please specify a card ID to trade. Use .card inventory to see your cards.",
            quoted: message 
        });
        return;
    }
    
    // Attempt the trade
    const result = animeCardGame.tradeCard(sender, recipient, cardId);
    
    if (!result.success) {
        await sock.sendMessage(remoteJid, { 
            text: result.message,
            quoted: message 
        });
        return;
    }
    
    // Format rarity stars
    let rarityStars = '';
    switch (result.card.rarity) {
        case 'common': rarityStars = '⭐'; break;
        case 'uncommon': rarityStars = '⭐⭐'; break;
        case 'rare': rarityStars = '⭐⭐⭐'; break;
        case 'epic': rarityStars = '⭐⭐⭐⭐'; break;
        case 'legendary': rarityStars = '⭐⭐⭐⭐⭐'; break;
    }
    
    // Create trade success message
    let tradeMessage = `*🔄 CARD TRADE SUCCESSFUL! 🔄*\n\n`;
    tradeMessage += `@${sender.split('@')[0]} gave @${recipient.split('@')[0]}:\n\n`;
    tradeMessage += `${rarityStars} *${result.card.name}* (${result.card.anime})\n`;
    tradeMessage += `_${result.card.description}_\n\n`;
    tradeMessage += `_Use .card inventory to view your updated collection!_`;
    
    // Send trade message
    await sock.sendMessage(remoteJid, { 
        text: tradeMessage,
        mentions: [sender, recipient]
    });
}

/**
 * Show help for card commands
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 */
async function showCardHelp(sock, remoteJid) {
    const message = `*🎴 Anime Card Collection Game 🎴*\n\n` +
        `📋 *Basic Commands:*\n` +
        `• .card draw - Obtain a random anime character card\n` +
        `• .card inventory - Browse your card collection\n` +
        `• .card help - Show this complete guide\n\n` +
        
        `📊 *Collection Stats:*\n` +
        `• .card stats - See your collection statistics\n` +
        `• .card stats @user - View another collector's stats\n` +
        `• .card inventory @user - Peek at someone else's collection\n\n` +
        
        `🔄 *Trading System:*\n` +
        `• .card trade [card_id] - Trade a card with another user\n` +
        `  (Reply to recipient's message when using this command)\n\n` +
        
        `📝 *Card Rarities:*\n` +
        `• ⭐ Common - Basic characters (50% chance)\n` +
        `• ⭐⭐ Uncommon - Supporting characters (30% chance)\n` +
        `• ⭐⭐⭐ Rare - Major characters (15% chance)\n` +
        `• ⭐⭐⭐⭐ Epic - Fan favorites (4% chance)\n` +
        `• ⭐⭐⭐⭐⭐ Legendary - Iconic anime heroes (1% chance)\n\n` +
        
        `💡 *Game Tips:*\n` +
        `• You can draw up to 5 cards per day\n` +
        `• Each card has a unique ID for trading\n` +
        `• Collect all characters to complete your collection\n` +
        `• Trade duplicates with friends to find missing cards`;
    
    await sock.sendMessage(remoteJid, { text: message });
}

module.exports = {
    handleCardCommand
};