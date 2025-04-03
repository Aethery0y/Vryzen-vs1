/**
 * Analytics commands for WhatsApp bot
 */
const analyticsLib = require('../lib/analytics');
const database = require('../lib/database');

/**
 * Show group analytics data
 */
async function showGroupAnalytics(sock, message, args) {
    const { remoteJid, isGroup, sender } = message;
    
    if (!isGroup) {
        return { success: false, message: '⚠️ This command can only be used in groups.' };
    }
    
    let period = 'week';
    if (args.length > 0 && ['day', 'week', 'month'].includes(args[0].toLowerCase())) {
        period = args[0].toLowerCase();
    }
    
    try {
        const stats = analyticsLib.getGroupStats(remoteJid, period);
        
        // Format the data for display
        let response = `📊 *Group Analytics (${period})* 📊\n\n`;
        
        response += `Total Messages: ${stats.totalMessages}\n`;
        response += `Active Members: ${stats.activeMembers}\n\n`;
        
        // Add top users
        if (stats.topUsers && stats.topUsers.length > 0) {
            response += "*Most Active Members:*\n";
            stats.topUsers.forEach((user, index) => {
                // Try to get contact name if available
                const displayName = database.getContactName(user.user) || user.user.split('@')[0];
                response += `${index + 1}. ${displayName}: ${user.count} messages\n`;
            });
            response += "\n";
        }
        
        // Add activity by hour
        if (stats.activityByHour) {
            response += "*Activity by Hour:*\n";
            const peakHour = Object.entries(stats.activityByHour)
                .sort((a, b) => b[1] - a[1])[0];
            
            response += `Peak hour: ${peakHour[0]}:00 (${peakHour[1]} messages)\n\n`;
        }
        
        // Add activity trend
        if (stats.activityTrend) {
            response += `*Activity Trend:* ${stats.activityTrend}\n\n`;
        }
        
        response += `📝 Use .useractivity to see individual user stats.`;
        
        return { success: true, message: response };
    } catch (error) {
        console.error("Error in group analytics:", error);
        return { success: false, message: `⚠️ Error fetching analytics: ${error.message}` };
    }
}

/**
 * Show user activity for a specific contact
 */
async function showUserActivity(sock, message, args) {
    const { remoteJid, sender, quotedMsg } = message;
    
    let targetUser;
    
    if (quotedMsg) {
        // If replying to a message, use that sender
        targetUser = quotedMsg.key.participant || quotedMsg.key.remoteJid;
    } else if (args.length > 0) {
        // If a phone number is provided
        const phoneNumber = args[0].replace(/[^0-9]/g, '');
        if (phoneNumber) {
            targetUser = `${phoneNumber}@s.whatsapp.net`;
        }
    } else {
        // Default to the sender
        targetUser = sender;
    }
    
    if (!targetUser) {
        return { success: false, message: '⚠️ Could not identify target user. Reply to a message or provide a phone number.' };
    }
    
    try {
        const stats = analyticsLib.getUserStats(targetUser);
        const displayName = database.getContactName(targetUser) || targetUser.split('@')[0];
        
        let response = `👤 *User Activity: ${displayName}* 👤\n\n`;
        
        response += `Total Messages: ${stats.totalMessages}\n`;
        response += `First Seen: ${new Date(stats.firstSeen).toLocaleDateString()}\n`;
        response += `Last Active: ${new Date(stats.lastActive).toLocaleDateString()}\n\n`;
        
        // Add user's active groups
        if (stats.activeGroups && stats.activeGroups.length > 0) {
            response += "*Active In Groups:*\n";
            stats.activeGroups.forEach((group, index) => {
                const groupName = database.getGroupName(group.groupId) || group.groupId.split('@')[0];
                response += `${index + 1}. ${groupName}: ${group.count} messages\n`;
            });
            response += "\n";
        }
        
        // Add activity by time period
        if (stats.activityBreakdown) {
            response += "*Activity Breakdown:*\n";
            response += `Today: ${stats.activityBreakdown.today || 0} messages\n`;
            response += `This Week: ${stats.activityBreakdown.week || 0} messages\n`;
            response += `This Month: ${stats.activityBreakdown.month || 0} messages\n\n`;
        }
        
        // Add commonly used commands
        if (stats.commandUsage && Object.keys(stats.commandUsage).length > 0) {
            response += "*Frequently Used Commands:*\n";
            Object.entries(stats.commandUsage)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .forEach(([cmd, count]) => {
                    response += `.${cmd}: ${count} times\n`;
                });
        }
        
        return { success: true, message: response };
    } catch (error) {
        console.error("Error in user analytics:", error);
        return { success: false, message: `⚠️ Error fetching user analytics: ${error.message}` };
    }
}

/**
 * Show command usage statistics
 */
async function showCommandStats(sock, message, args) {
    try {
        const stats = analyticsLib.getCommandStats();
        
        let response = `🤖 *Command Usage Statistics* 🤖\n\n`;
        
        if (stats.totalCommands && stats.totalCommands > 0) {
            response += `Total Commands Used: ${stats.totalCommands}\n\n`;
            
            if (stats.mostUsedCommands && stats.mostUsedCommands.length > 0) {
                response += "*Most Used Commands:*\n";
                stats.mostUsedCommands.forEach((cmd, index) => {
                    response += `${index + 1}. .${cmd.command}: ${cmd.count} uses (${Math.round(cmd.percent)}%)\n`;
                });
                response += "\n";
            }
            
            if (stats.recentTrend) {
                response += `*Recent Trend:* ${stats.recentTrend}\n\n`;
            }
            
            if (stats.mostActiveUsers && stats.mostActiveUsers.length > 0) {
                response += "*Top Command Users:*\n";
                stats.mostActiveUsers.forEach((user, index) => {
                    const displayName = database.getContactName(user.user) || user.user.split('@')[0];
                    response += `${index + 1}. ${displayName}: ${user.count} commands\n`;
                });
            }
        } else {
            response += "No command usage data available yet.";
        }
        
        return { success: true, message: response };
    } catch (error) {
        console.error("Error in command stats:", error);
        return { success: false, message: `⚠️ Error fetching command statistics: ${error.message}` };
    }
}

module.exports = {
    showGroupAnalytics,
    showUserActivity,
    showCommandStats
};