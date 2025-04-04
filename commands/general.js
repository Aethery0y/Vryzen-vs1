const database = require('../lib/database');
const config = require('../config');
const contacts = require('../lib/contacts');

/**
 * Show available commands
 */
async function showCommands(sock, remoteJid) {
    const commandsList = `🤖 *WhatsApp Bot Commands* 🤖\n\n` +
        `📝 *Basic Commands:*\n` +
        `• .cmds - Show this complete command list\n` +
        `• .admincmds - View admin-only advanced commands\n` +
        `• .clear - Erase your conversation history with the bot\n` +
        `• .profile - View your profile, status, and warning level\n` +
        `• .sticker - Turn an image/video into a sticker (reply to media)\n` +
        `• .animenews - Get the latest anime and manga news\n\n` +
        
        `🎮 *Anime Games:*\n` +
        `• .quiz start - Begin a new anime trivia quiz in your group\n` +
        `• .quiz end - End the current ongoing quiz\n` +
        `• .quiz stats - View your personal quiz statistics\n` +
        `• .quiz leaderboard - See the quiz high scores\n` +
        `• .quiz help - Get detailed quiz game instructions\n\n` +
        
        `🃏 *Anime Card Collection:*\n` +
        `• .card draw - Get a random anime character card\n` +
        `• .card inventory - View your card collection\n` +
        `• .card stats - Check your collection statistics\n` +
        `• .card trade - Trade cards with other users\n` +
        `• .card help - Get detailed card game instructions\n\n` +
        
        `🎲 *Anime Betting System:*\n` +
        `• .createbet <type> - Create a new betting game\n` +
        `• .bet <game_id> <option> <amount> - Place a bet\n` +
        `• .bets - List all active betting games\n` +
        `• .betinfo <game_id> - View details about a game\n` +
        `• .endbet <game_id> <winner> - End a betting game\n` +
        `• .mystats - View your betting statistics\n\n` +
        
        `👥 *Group Management:*\n` +
        `• .save all - Add all group members to bot database\n` +
        `• .save allcon - Export members as a contacts file\n` +
        `• .add "number1,number2" - Add specific numbers to the group\n` +
        `• .addauto - Automatically add one contact per minute\n` +
        `• .addstop - Stop the automatic adding process\n` +
        `• .fetch numbers - Get random numbers from saved contacts\n` +
        `• .tag all "message" - Mention all group members\n\n` +
        
        `📊 *Analytics & Statistics:*\n` +
        `• .relationships - View group interaction patterns\n` +
        `• .leaderboard daily - See today's most active members\n` +
        `• .leaderboard weekly - View this week's most active users\n` +
        `• .leaderboard monthly - See this month's top participants\n` +
        `• .leaderboard all - View all-time most active members\n` +
        `• .mystats - Get your personal message statistics\n\n` +
        
        `🔐 *Privacy Settings:*\n` +
        `• .private - Set bot to private mode (allowed users only)\n` +
        `• .public - Set bot to public mode (accessible to everyone)\n` +
        `• .allow "number" - Add a user to the allowed users list\n\n` +
        
        `📇 *Contact Management:*\n` +
        `• .label add "number" "label" - Tag a contact with a label\n` +
        `• .label remove "number" "label" - Remove a contact's label\n` +
        `• .label list "number" - View all labels for a contact\n` +
        `• .contact set "number" field="value" - Update contact details\n` +
        `• .contact get "number" - Retrieve contact information\n` +
        `• .find label="value" - Search contacts by criteria\n` +
        `• .stats "number" - View engagement stats for any user\n\n` +
        
        `⚙️ *Advanced Features:*\n` +
        `• Message scheduling: .schedule "time" "message"\n` +
        `• Interactive polls: .poll "question" "options"\n` +
        `• Custom auto-replies: .autoreply set "trigger" "response"\n` +
        `• Group influence tools: .influence, .warn, .silence\n` +
        `• Content analysis: .analyze, .topics, .summarize\n` +
        `• AI responses: .persona "style", .translate "language"\n\n` +
        
        `💬 *Help & Support:*\n` +
        `• Type .quiz help or .card help for game instructions\n` +
        `• Use .admincmds to see owner/admin-only commands\n` +
        `• Reply to a message from the bot for direct interaction`;
    
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
    const config = require('../config');
    const database = require('../lib/database');
    const normalizedNumber = database.normalizeNumber(senderNumber);
    const isUserOwner = config.botOwners.some(owner => database.normalizeNumber(owner) === normalizedNumber);
    
    if (!isUserOwner) {
        await sock.sendMessage(remoteJid, { 
            text: '⛔ Sorry, only bot owners can access admin commands.'
        });
        return;
    }
    
    const adminCommandsList = `🔐 *WhatsApp Bot Admin Commands* 🔐\n\n` +
        `⏰ *Scheduled Messaging:*\n` +
        `• .schedule "time" "message" - Schedule a message for future delivery\n` +
        `• .cancel "id" - Cancel a scheduled message by its ID\n` +
        `• .scheduled - View all your pending scheduled messages\n` +
        `• .broadcast "message" "targets" - Send message to multiple recipients\n\n` +
        
        `📊 *Polls & Voting:*\n` +
        `• .poll "question" "option1, option2" - Create an interactive poll\n` +
        `• .vote "poll_id" "option_number" - Cast your vote in a poll\n` +
        `• .results "poll_id" - Check current poll results\n` +
        `• .endpoll "poll_id" - Finish a poll and display final results\n\n` +
        
        `🤖 *Auto-Reply System:*\n` +
        `• .autoreply set "trigger" "response" - Create new auto-reply rule\n` +
        `• .autoreply remove "trigger" - Delete an existing auto-reply\n` +
        `• .autoreply list - Display all configured auto-replies\n\n` +
        
        `✨ *AI & Content:*\n` +
        `• .persona "style" - Customize AI response style and personality\n` +
        `• .summarize - Create summary of long text (reply to message)\n` +
        `• .translate "language" - Convert message to another language\n` +
        `• .remember "info" - Store information for contextual responses\n` +
        `• .recall - Review all your stored information\n\n` +
        
        `🔍 *Group Intelligence:*\n` +
        `• .analyze - Generate comprehensive group relationships map\n` +
        `• .activity "period" - Create detailed group activity report\n` +
        `• .topics - Identify current trending topics in the group\n` +
        `• .influence - Discover key influencers and opinion leaders\n` +
        `• .track - Silently monitor member join/leave events\n` +
        `• .active - View list of most active group members\n` +
        `• .detector - Receive notifications for group membership changes\n` +
        `• .clearrelations - Reset all relationship analysis data\n\n` +
        
        `👮 *Moderation Tools:*\n` +
        `• .warn @user "reason" - Issue formal warning to a user\n` +
        `• .report [@user] - Generate user violation report\n` +
        `• .silence @user "duration" - Temporarily ignore messages from user\n\n` +
        
        `⚡ *Conversation Control:*\n` +
        `• .flood delay="2s" count="3" message="text" - Send multiple messages\n` +
        `• .dominate "count" - Control conversation flow with multiple messages\n` +
        `• .distract "topic" - Redirect group conversation to new topic\n` +
        `• .simulate "message" - Send message without the command prefix`;
    
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
