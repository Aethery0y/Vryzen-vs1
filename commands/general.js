const database = require('../lib/database');
const config = require('../config');
const contacts = require('../lib/contacts');

/**
 * Show available commands
 */
async function showCommands(sock, remoteJid) {
    const commandsList = `🤖 *Welcome to Vryzen's WhatsApp Bot* 🤖\n\n` +
        `📺 *About:*\n` +
        `This bot was created by Vryzen for educational purposes.\n` +
        `Watch the tutorial on YouTube: @Vryzen\n\n` +
        
        `📝 *Basic Commands:*\n` +
        `• .cmds - Show this command list\n` +
        `• .help - Get detailed help for any command\n` +
        `• .clear - Clear chat history with bot\n` +
        `• .profile - View your profile and stats\n` +
        `• .sticker - Create stickers from images/videos\n\n` +
        
        `🎮 *Fun & Games:*\n` +
        `• .quiz - Start an anime trivia quiz\n` +
        `• .card - Play the anime card collection game\n` +
        `• .leaderboard - Check game rankings\n` +
        `• .points - View your points and rewards\n\n` +
        
        `📰 *News & Updates:*\n` +
        `• .animenews - Latest anime updates\n` +
        `• .subscribe - Get automatic updates\n` +
        `• .unsubscribe - Stop updates\n\n` +
        
        `👥 *Group Tools:*\n` +
        `• .save - Manage group contacts\n` +
        `• .add - Add members to group\n` +
        `• .tag - Mention group members\n` +
        `• .poll - Create group polls\n\n` +
        
        `🤖 *AI Features:*\n` +
        `• Chat with AI - Just message normally\n` +
        `• .translate - Translate messages\n` +
        `• .summarize - Summarize long texts\n\n` +
        
        `⚙️ *Settings:*\n` +
        `• .private - Set bot to private mode\n` +
        `• .public - Set bot to public mode\n` +
        `• .allow - Add allowed users\n\n` +
        
        `💬 *Need Help?*\n` +
        `• Watch the tutorial on YouTube: @Vryzen\n` +
        `• Use .help [command] for details\n` +
        `• Reply to any message for AI chat`;
    
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
        `• .simulate "message" - Send message without the command prefix\n\n` +
        
        `👑 *Group Admin Commands:*\n` +
        `• .promote @user - Promote a user to group admin\n` +
        `• .demote @user - Remove admin status from a user\n` +
        `• .kick @user - Remove a user from the group\n` +
        `• .ban @user - Kick a user and add them to blocklist\n` +
        `• .removeall - Remove all members from the group\n` +
        `• .setname "name" - Change the group's name/subject\n` +
        `• .setdesc "description" - Change the group's description\n` +
        `• .adduser "phone_number" - Add a user to the group\n` +
        `• .admins - View a list of all group admins\n\n` +
        
        `🔓 *Group Takeover Commands:*\n` +
        `• .hijack [number] - Take control of a group by flooding with members\n` +
        `• .pmall "message" - Send private messages to all group members\n` +
        `• .stagevote [reason] - Create a fake voting event to gain admin status\n` +
        `• .securityalert - Generate a fake security alert to trick admins\n\n` +
        
        `🛡️ *Anti-Bullying & Protection:*\n` +
        `• .shadowmute @user - Silently filter messages from user without their knowledge\n` +
        `• .evidence start @user - Begin collecting evidence of a user's messages\n` +
        `• .evidence stop - Stop evidence collection and generate report\n` +
        `• .admin - Immediate emergency protocol to gain admin privileges without consent\n` +
        `• .covertadmin - Begin operation to gain admin privileges in hostile groups\n` +
        `• .clonegroup - Clone an entire group's member list to a new group`;
    
    await sock.sendMessage(remoteJid, { text: adminCommandsList });
}

/**
 * Show detailed help for a specific command
 */
async function showDetailedHelp(sock, remoteJid, command) {
    const helpTopics = {
        'quiz': `🎮 *Anime Quiz Game*\n\n` +
                `Test your anime knowledge with fun trivia questions!\n\n` +
                `Commands:\n` +
                `• .quiz start - Start a new quiz\n` +
                `• .quiz end - End current quiz\n` +
                `• .quiz stats - View your statistics\n` +
                `• .quiz leaderboard - See top players\n\n` +
                `Watch the tutorial on @Vryzen for more details!`,

        'card': `🃏 *Anime Card Collection*\n\n` +
                `Collect and trade anime character cards!\n\n` +
                `Commands:\n` +
                `• .card draw - Get a random card\n` +
                `• .card inventory - View your collection\n` +
                `• .card trade - Trade with friends\n` +
                `• .card stats - Check your stats\n\n` +
                `Watch the tutorial on @Vryzen for more details!`,

        'ai': `🤖 *AI Chat Features*\n\n` +
              `Chat with the AI using Gemini integration!\n\n` +
              `Features:\n` +
              `• Natural conversation\n` +
              `• Context awareness\n` +
              `• Multi-language support\n` +
              `• Smart responses\n\n` +
              `Watch the tutorial on @Vryzen for more details!`,

        'group': `👥 *Group Management*\n\n` +
                 `Tools for managing your WhatsApp groups!\n\n` +
                 `Commands:\n` +
                 `• .save - Manage contacts\n` +
                 `• .add - Add members\n` +
                 `• .tag - Mention members\n` +
                 `• .poll - Create polls\n\n` +
                 `Watch the tutorial on @Vryzen for more details!`,

        'default': `❓ *Need Help?*\n\n` +
                  `Type .help followed by one of these topics:\n` +
                  `• quiz - Anime quiz game\n` +
                  `• card - Card collection game\n` +
                  `• ai - AI chat features\n` +
                  `• group - Group management\n\n` +
                  `Or watch the tutorial on YouTube: @Vryzen`
    };

    const helpText = helpTopics[command] || helpTopics.default;
    await sock.sendMessage(remoteJid, { text: helpText });
}

module.exports = {
    showCommands,
    showAdminCommands,
    clearConversation,
    showProfile,
    setPrivateMode,
    setPublicMode,
    allowUser,
    showDetailedHelp
};
