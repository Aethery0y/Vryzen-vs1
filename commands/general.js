const database = require('../lib/database');
const config = require('../config');
const contacts = require('../lib/contacts');

/**
 * Show available commands
 */
async function showCommands(sock, remoteJid) {
    const commandsList = `🤖 *WhatsApp Bot Commands* 🤖\n\n` +
        `*General Commands:*\n` +
        `• .cmds - Show this list of commands\n` +
        `• .clear - Clear conversation history with the bot\n` +
        `• .profile - Show your user profile & warning status\n` +
        `• .sticker - Convert image/video to sticker (reply to media)\n` +
        `• .animenews - Get latest anime news\n\n` +
        
        `*Group Commands:*\n` +
        `• .save all - Save all group members' numbers\n` +
        `• .add all - Add saved numbers to the current group\n` +
        `• .tag all "message" - Tag all group members\n\n` +
        
        `*Privacy Commands:*\n` +
        `• .private - Restrict bot access to allowed users only\n` +
        `• .public - Make the bot accessible to everyone\n` +
        `• .allow "number" - Add a number to allowed users list\n\n` +
        
        `*Contact Management:*\n` +
        `• .label add "number" "label" - Add label to contact\n` +
        `• .label remove "number" "label" - Remove label\n` +
        `• .label list "number" - List labels for a contact\n` +
        `• .contact set "number" field="value" - Update contact info\n` +
        `• .contact get "number" - Get contact details\n` +
        `• .find label="value" engagement="level" - Find contacts\n` +
        `• .stats "number" - Show engagement stats for user`;
    
    await sock.sendMessage(remoteJid, { text: commandsList });
}

/**
 * Clear conversation context with the bot
 */
async function clearConversation(sock, remoteJid, sender) {
    // The actual context clearing happens in the main file
    // This just sends a confirmation message
    
    await sock.sendMessage(remoteJid, { 
        text: '🧹 Conversation history has been cleared. Starting fresh!'
    });
}

/**
 * Show user profile and warning status
 */
async function showProfile(sock, remoteJid, sender) {
    const contact = contacts.getContactInfo(sender) || {
        number: sender,
        labels: [],
        engagement: 0,
        lastInteraction: Date.now()
    };
    
    const warnings = database.getWarnings(sender);
    
    const profile = `👤 *User Profile*\n\n` +
        `• Number: ${contact.number}\n` +
        `• Labels: ${contact.labels.length > 0 ? contact.labels.join(', ') : 'None'}\n` +
        `• Engagement Level: ${contact.engagement}\n` +
        `• Last Interaction: ${new Date(contact.lastInteraction).toLocaleString()}\n\n` +
        
        `⚠️ *Warning Status*\n` +
        `• Warnings: ${warnings.warnings}/${config.maxWarnings}\n` +
        `• Strikes: ${warnings.strikes}/${config.maxStrikes}\n` +
        `• Status: ${warnings.banned ? '🚫 BANNED' : '✅ ACTIVE'}`;
    
    await sock.sendMessage(remoteJid, { text: profile });
}

/**
 * Set bot to private mode (only allowed users)
 */
async function setPrivateMode(sock, remoteJid) {
    const settings = database.getBotSettings();
    settings.isPublic = false;
    database.updateBotSettings(settings);
    
    await sock.sendMessage(remoteJid, { 
        text: '🔒 Bot is now in private mode. Only allowed users can access commands.'
    });
}

/**
 * Set bot to public mode (available to everyone)
 */
async function setPublicMode(sock, remoteJid) {
    const settings = database.getBotSettings();
    settings.isPublic = true;
    database.updateBotSettings(settings);
    
    await sock.sendMessage(remoteJid, { 
        text: '🔓 Bot is now in public mode. Everyone can access commands.'
    });
}

/**
 * Add a user to the allowed users list
 */
async function allowUser(sock, remoteJid, number) {
    const normalizedNumber = database.normalizeNumber(number);
    const settings = database.getBotSettings();
    
    // Check if user is already allowed
    if (settings.allowedUsers.some(user => database.normalizeNumber(user) === normalizedNumber)) {
        await sock.sendMessage(remoteJid, { 
            text: `✅ User ${normalizedNumber} is already in the allowed users list.`
        });
        return;
    }
    
    // Add to allowed users
    settings.allowedUsers.push(normalizedNumber);
    database.updateBotSettings(settings);
    
    await sock.sendMessage(remoteJid, { 
        text: `✅ User ${normalizedNumber} has been added to the allowed users list.`
    });
}

module.exports = {
    showCommands,
    clearConversation,
    showProfile,
    setPrivateMode,
    setPublicMode,
    allowUser
};
