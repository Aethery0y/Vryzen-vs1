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
        `• .admincmds - Show admin-only advanced commands\n` +
        `• .clear - Clear conversation history with the bot\n` +
        `• .profile - Show your user profile & warning status\n` +
        `• .sticker - Convert image/video to sticker (reply to media)\n` +
        `• .animenews - Get latest anime news\n\n` +
        
        `*Group Commands:*\n` +
        `• .save all - Save all group members' numbers\n` +
        `• .save allcon - Export all members as contacts file to your device\n` +
        `• .add "number1,number2" - Add specific numbers to the group\n` +
        `• .add auto - Start auto-adding one contact per minute\n` +
        `• .addstop - Stop the auto-adding process\n` +
        `• .fetch numbers - Get random numbers from saved contacts\n` +
        `• .tag all "message" - Tag all group members\n` +
        `• .relationships - Show group relationships analysis\n` +
        `• .leaderboard [daily|weekly|monthly|all] - Show message rankings\n` +
        `• .mystats - Show your own message statistics\n\n` +
        
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
        `• .stats "number" - Show engagement stats for user\n\n` +
        
        `*Advanced Features:*\n` +
        `• Use .admincmds to see advanced admin features including:\n` +
        `  - Message scheduling\n` +
        `  - Polling\n` +
        `  - Auto-replies\n` +
        `  - Group influence tools\n` +
        `  - Content analysis\n` +
        `  - AI persona customization`;
    
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

/**
 * Show admin commands
 */
async function showAdminCommands(sock, remoteJid, sender) {
    // Check if user is bot owner or admin
    const senderNumber = sender.split('@')[0];
    const isOwner = require('./index').isOwner(senderNumber);
    
    if (!isOwner) {
        await sock.sendMessage(remoteJid, { 
            text: '⛔ Sorry, only bot owners can access admin commands.'
        });
        return;
    }
    
    const adminCommandsList = `🔐 *WhatsApp Bot Admin Commands* 🔐\n\n` +
        `*Advanced Messaging:*\n` +
        `• .schedule "time" "message" - Schedule a future message\n` +
        `• .cancel "id" - Cancel a scheduled message\n` +
        `• .scheduled - List your scheduled messages\n` +
        `• .poll "question" "option1, option2" - Create a poll\n` +
        `• .vote "poll_id" "option_number" - Vote in a poll\n` +
        `• .results "poll_id" - View poll results\n` +
        `• .endpoll "poll_id" - End a poll and show results\n` +
        `• .broadcast "message" "targets" - Send to multiple recipients\n\n` +
        
        `*Auto-Reply & Content:*\n` +
        `• .autoreply set "trigger" "response" - Create auto-reply rule\n` +
        `• .autoreply remove "trigger" - Remove an auto-reply\n` +
        `• .autoreply list - View all auto-replies\n` +
        `• .summarize - Summarize a long message (reply to msg)\n` +
        `• .translate "language" - Translate message (reply to msg)\n\n` +
        
        `*Group Influence:*\n` +
        `• .track - Track member join/leave events silently\n` +
        `• .active - View most active members\n` +
        `• .detector - Get notified when members join/leave\n` +
        `• .warn @user "reason" - Send warning to a user\n` +
        `• .report [@user] - Generate violation report\n` +
        `• .silence @user "duration" - Have bot ignore a user\n` +
        `• .influence - Find key influencers in group\n\n` +
        
        `*Advanced Control:*\n` +
        `• .flood delay="2s" count="3" message="text" - Send multiple msgs\n` +
        `• .dominate "count" - Take control of conversation flow\n` +
        `• .distract "topic" - Change topic to distract from current one\n` +
        `• .simulate "message" - Send message without command prefix\n\n` +
        
        `*AI & Analysis:*\n` +
        `• .analyze - Analyze group member relationships\n` +
        `• .activity "period" - Get group activity report\n` +
        `• .topics - Identify trending topics in the group\n` +
        `• .persona "style" - Change AI response style\n` +
        `• .remember "info" - Store info for contextual responses\n` +
        `• .recall - View your stored information\n` +
        `• .leaderboard [daily|weekly|monthly|all] - Show message rankings\n` +
        `• .clearrelations - Clear relationship analysis data`;
    
    await sock.sendMessage(remoteJid, { text: adminCommandsList });
}

module.exports = {
    showCommands,
    showAdminCommands,
    clearConversation,
    showProfile,
    setPrivateMode,
    setPublicMode,
    allowUser
};
