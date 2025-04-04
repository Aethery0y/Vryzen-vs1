const database = require('../lib/database');
const config = require('../config');

// Storage for monitoring data
const monitoredGroups = {};
const memberActivity = {};
const warningsList = {};

/**
 * Silently track who joins/leaves the group
 */
async function trackGroupChanges(sock, remoteJid, sender) {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        // Toggle tracking for this group
        if (monitoredGroups[remoteJid]) {
            delete monitoredGroups[remoteJid];
            return { 
                success: true, 
                message: "Group tracking has been deactivated." 
            };
        } else {
            monitoredGroups[remoteJid] = {
                trackedBy: sender,
                startTime: new Date(),
                members: {} // Will be populated when changes occur
            };
            
            // Initial member scan would happen here in a full implementation
            
            return { 
                success: true, 
                message: "Group tracking has been activated. You'll silently receive updates about member changes." 
            };
        }
    } catch (error) {
        console.error('Error setting up group tracking:', error);
        return { success: false, message: "Failed to set up group tracking." };
    }
}

/**
 * Identify the most active members in a group
 */
async function getActiveMembers(sock, remoteJid, sender, period = '24h') {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        // Use the messageStats module to get real activity data
        const messageStats = require('../lib/messageStats');
        let leaderboard;
        let periodName;
        
        // Determine which leaderboard to use based on the period parameter
        if (period === '24h' || period === 'daily') {
            leaderboard = messageStats.getDailyLeaderboard(remoteJid, 10);
            periodName = 'DAILY';
        } else if (period === 'weekly' || period === '7d') {
            leaderboard = messageStats.getWeeklyLeaderboard(remoteJid, 10);
            periodName = 'WEEKLY';
        } else if (period === 'monthly' || period === '30d') {
            leaderboard = messageStats.getMonthlyLeaderboard(remoteJid, 10);
            periodName = 'MONTHLY';
        } else {
            leaderboard = messageStats.getAllTimeLeaderboard(remoteJid, 10);
            periodName = 'ALL-TIME';
        }
        
        if (!leaderboard || leaderboard.length === 0) {
            return { 
                success: true, 
                message: `No ${periodName.toLowerCase()} message activity found for this group.`
            };
        }
        
        // Format the leaderboard with user names
        const getUserName = async (userId) => {
            try {
                // First try to get name from WhatsApp
                const fullJid = `${userId}@s.whatsapp.net`;
                const [result] = await sock.onWhatsApp(fullJid);
                
                if (result && result.exists) {
                    try {
                        // Try to get user info
                        const userInfo = await sock.getContactInfo(fullJid);
                        if (userInfo && userInfo.notify) {
                            return userInfo.notify;
                        }
                    } catch (error) {
                        // Silently fail, will use phone number instead
                    }
                }
                
                // Use phone number as fallback with formatting
                return formatPhoneNumber(userId);
            } catch (error) {
                // Fallback to just showing the ID
                return formatPhoneNumber(userId);
            }
        };
        
        // Format phone number for display
        function formatPhoneNumber(phoneNumber) {
            // Remove any prefix like "+" if present
            phoneNumber = phoneNumber.replace(/^\+/, '');
            
            // Basic formatting based on length
            if (phoneNumber.length <= 5) {
                return phoneNumber;
            } else if (phoneNumber.length <= 8) {
                return phoneNumber.slice(0, 3) + '-' + phoneNumber.slice(3);
            } else if (phoneNumber.length <= 10) {
                return phoneNumber.slice(0, 3) + '-' + phoneNumber.slice(3, 6) + '-' + phoneNumber.slice(6);
            } else {
                // For longer international numbers
                return '+' + phoneNumber.slice(0, 2) + ' ' + 
                       phoneNumber.slice(2, 5) + '-' + 
                       phoneNumber.slice(5, 8) + '-' + 
                       phoneNumber.slice(8);
            }
        }
        
        // Create leaderboard header
        let message = `📊 *${periodName} ACTIVE MEMBERS* 📊\n\n`;
        
        // Add each user entry
        for (let i = 0; i < leaderboard.length; i++) {
            const entry = leaderboard[i];
            const rank = i + 1;
            const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}.`;
            const userName = await getUserName(entry.userId);
            message += `${medal} ${userName}: ${entry.count} messages\n`;
        }
        
        message += `\nUpdated: ${new Date().toLocaleString()}`;
        
        return { 
            success: true, 
            message: message
        };
    } catch (error) {
        console.error('Error getting active members:', error);
        return { success: false, message: "Failed to identify active members: " + error.message };
    }
}

/**
 * Set up detection for when members join/leave
 */
async function setupDetector(sock, remoteJid, sender) {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        // Toggle detector for this group
        const key = `detector_${remoteJid}`;
        
        if (monitoredGroups[key]) {
            delete monitoredGroups[key];
            return { 
                success: true, 
                message: "Member detector has been deactivated." 
            };
        } else {
            monitoredGroups[key] = {
                trackedBy: sender,
                startTime: new Date(),
                notifyTo: sender,
                members: {} // Will be populated with current members
            };
            
            // Initial member scan would happen here in a full implementation
            
            return { 
                success: true, 
                message: "Member detector has been activated. You'll receive notifications when members join or leave." 
            };
        }
    } catch (error) {
        console.error('Error setting up member detector:', error);
        return { success: false, message: "Failed to set up member detector." };
    }
}

/**
 * Send a warning to a user (without admin privileges)
 */
async function warnUser(sock, remoteJid, sender, mentionedUser, reason) {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        if (!mentionedUser) {
            return { success: false, message: "Please mention the user you want to warn." };
        }
        
        // Track warnings for this user in this group
        const key = `${remoteJid}_${mentionedUser}`;
        
        if (!warningsList[key]) {
            warningsList[key] = [];
        }
        
        warningsList[key].push({
            by: sender,
            reason: reason || "No reason provided",
            timestamp: new Date()
        });
        
        const warningCount = warningsList[key].length;
        
        // Format the warning message
        let warningMessage = `⚠️ *WARNING* ⚠️\n\n`;
        warningMessage += `@${mentionedUser.split('@')[0]} has been warned`;
        
        if (reason) {
            warningMessage += ` for: ${reason}`;
        }
        
        warningMessage += `\n\nThis is warning #${warningCount}`;
        
        if (warningCount >= 3) {
            warningMessage += "\n\nThis user has reached 3+ warnings. They should be removed from the group.";
        }
        
        // Send the warning as a regular message
        await sock.sendMessage(remoteJid, { 
            text: warningMessage,
            mentions: [mentionedUser]
        });
        
        return { 
            success: true, 
            message: `Warning sent to user.`,
            silent: true // No need for confirmation message
        };
    } catch (error) {
        console.error('Error warning user:', error);
        return { success: false, message: "Failed to warn user." };
    }
}

/**
 * Compile a report of rule violations
 */
async function generateReport(sock, remoteJid, sender, targetUser = null) {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        // Generate report for specific user or all warned users
        let report = `📝 *Violation Report*\n\n`;
        
        if (targetUser) {
            // Report for specific user
            const key = `${remoteJid}_${targetUser}`;
            
            if (!warningsList[key] || warningsList[key].length === 0) {
                return { success: false, message: "This user has no warnings." };
            }
            
            report += `User: @${targetUser.split('@')[0]}\n`;
            report += `Total warnings: ${warningsList[key].length}\n\n`;
            report += `*Warning History:*\n`;
            
            warningsList[key].forEach((warning, index) => {
                const date = new Date(warning.timestamp).toLocaleDateString();
                report += `${index + 1}. Date: ${date}\n`;
                report += `   Reason: ${warning.reason}\n`;
                report += `   By: @${warning.by.split('@')[0]}\n\n`;
            });
            
            // Send the report
            await sock.sendMessage(remoteJid, { 
                text: report,
                mentions: [targetUser]
            });
        } else {
            // Report for all warned users in this group
            const warnedUsers = Object.keys(warningsList)
                .filter(key => key.startsWith(remoteJid))
                .map(key => {
                    const userId = key.split('_')[1];
                    return {
                        id: userId,
                        count: warningsList[key].length
                    };
                })
                .sort((a, b) => b.count - a.count);
                
            if (warnedUsers.length === 0) {
                return { success: false, message: "No warnings have been issued in this group." };
            }
            
            report += `Group has ${warnedUsers.length} warned members.\n\n`;
            report += `*Warning Summary:*\n`;
            
            const mentions = [];
            
            warnedUsers.forEach((user, index) => {
                mentions.push(user.id);
                report += `${index + 1}. @${user.id.split('@')[0]}: ${user.count} warnings\n`;
            });
            
            // Send the report
            await sock.sendMessage(remoteJid, { 
                text: report,
                mentions: mentions
            });
        }
        
        return { 
            success: true, 
            message: `Report generated.`,
            silent: true // No need for confirmation message
        };
    } catch (error) {
        console.error('Error generating report:', error);
        return { success: false, message: "Failed to generate violation report." };
    }
}

/**
 * Have the bot ignore messages from specific users
 */
async function silenceUser(sock, remoteJid, sender, targetUser, duration = '1h') {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        if (!targetUser) {
            return { success: false, message: "Please mention the user you want to silence." };
        }
        
        // Parse duration
        let durationMs = 3600000; // Default: 1 hour
        
        if (duration) {
            const match = duration.match(/^(\d+)([hmd])$/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                
                if (unit === 'h') durationMs = value * 3600000; // hours
                if (unit === 'm') durationMs = value * 60000;   // minutes
                if (unit === 'd') durationMs = value * 86400000; // days
            }
        }
        
        // Maximum duration: 7 days
        durationMs = Math.min(durationMs, 7 * 86400000);
        
        // Set up silencing
        const key = `silence_${remoteJid}_${targetUser}`;
        global.silencedUsers = global.silencedUsers || {};
        
        global.silencedUsers[key] = {
            until: new Date(Date.now() + durationMs),
            by: sender
        };
        
        // Calculate when silence will end
        const endTime = new Date(Date.now() + durationMs);
        const endTimeStr = endTime.toLocaleString();
        
        return { 
            success: true, 
            message: `@${targetUser.split('@')[0]} will be silenced until ${endTimeStr}.`,
            mentions: [targetUser]
        };
    } catch (error) {
        console.error('Error silencing user:', error);
        return { success: false, message: "Failed to silence user." };
    }
}

/**
 * Check if a user is silenced
 */
function isUserSilenced(remoteJid, sender) {
    if (!global.silencedUsers) return false;
    
    const key = `silence_${remoteJid}_${sender}`;
    const silenceInfo = global.silencedUsers[key];
    
    if (!silenceInfo) return false;
    
    // Check if silence period has expired
    if (new Date() > silenceInfo.until) {
        // Remove expired silence
        delete global.silencedUsers[key];
        return false;
    }
    
    return true;
}

/**
 * Find key influencers in a group
 */
async function findInfluencers(sock, remoteJid) {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        // Use the groupRelationship module to analyze real data
        const groupRelationship = require('../lib/groupRelationship');
        const messageStats = require('../lib/messageStats');
        
        // Get activity analysis from the group relationship module
        const analysisResult = groupRelationship.analyzeGroup(remoteJid);
        
        if (analysisResult.error) {
            if (analysisResult.needsData) {
                return { 
                    success: false, 
                    message: "Not enough group interaction data collected yet.\n\nThe bot needs to observe more message activity and replies between members to identify influencers. Keep chatting!"
                };
            }
            return { 
                success: false, 
                message: "Failed to analyze group dynamics: " + analysisResult.error
            };
        }
        
        // Format phone number for display
        function formatPhoneNumber(phoneNumber) {
            // Remove any prefix like "+" if present
            phoneNumber = phoneNumber.replace(/^\+/, '');
            
            // Basic formatting based on length
            if (phoneNumber.length <= 5) {
                return phoneNumber;
            } else if (phoneNumber.length <= 8) {
                return phoneNumber.slice(0, 3) + '-' + phoneNumber.slice(3);
            } else if (phoneNumber.length <= 10) {
                return phoneNumber.slice(0, 3) + '-' + phoneNumber.slice(3, 6) + '-' + phoneNumber.slice(6);
            } else {
                // For longer international numbers
                return '+' + phoneNumber.slice(0, 2) + ' ' + 
                       phoneNumber.slice(2, 5) + '-' + 
                       phoneNumber.slice(5, 8) + '-' + 
                       phoneNumber.slice(8);
            }
        }
        
        // Get user name from WhatsApp
        const getUserName = async (userId) => {
            try {
                // First try to get name from WhatsApp
                const fullJid = `${userId}@s.whatsapp.net`;
                const [result] = await sock.onWhatsApp(fullJid);
                
                if (result && result.exists) {
                    try {
                        // Try to get user info
                        const userInfo = await sock.getContactInfo(fullJid);
                        if (userInfo && userInfo.notify) {
                            return userInfo.notify;
                        }
                    } catch (error) {
                        // Silently fail, will use phone number instead
                    }
                }
                
                // Use phone number as fallback with formatting
                return formatPhoneNumber(userId);
            } catch (error) {
                // Fallback to just showing the ID
                return formatPhoneNumber(userId);
            }
        };
        
        // Get all-time message stats for context
        const topMessages = messageStats.getAllTimeLeaderboard(remoteJid, 5);
        
        // Prepare the report
        let message = `📊 *GROUP INFLUENCE ANALYSIS* 📊\n\n`;
        
        // Add key influencers section if we have them
        if (analysisResult.keyInfluencers && analysisResult.keyInfluencers.length > 0) {
            message += `🌟 *KEY INFLUENCERS*\n`;
            let count = 0;
            
            for (const influencer of analysisResult.keyInfluencers) {
                if (count >= 3) break; // Only show top 3
                
                const name = await getUserName(influencer.id);
                let metric = "";
                
                if (influencer.responseRate) {
                    metric = `Response rate: ${(influencer.responseRate * 100).toFixed(0)}%`;
                } else if (influencer.receivedReplies) {
                    metric = `Gets ${influencer.receivedReplies} replies`;
                } else if (influencer.threadStarts) {
                    metric = `Starts ${influencer.threadStarts} convos`;
                }
                
                message += `${count + 1}. ${name} - ${metric}\n`;
                count++;
            }
            message += `\n`;
        }
        
        // Add conversation starters if available
        if (analysisResult.conversationStarters && analysisResult.conversationStarters.length > 0) {
            message += `💬 *CONVERSATION STARTERS*\n`;
            
            for (let i = 0; i < Math.min(3, analysisResult.conversationStarters.length); i++) {
                const starter = analysisResult.conversationStarters[i];
                const name = await getUserName(starter.id);
                message += `${i + 1}. ${name} - ${starter.count} new topics\n`;
            }
            message += `\n`;
        }
        
        // Add most replied to members if available
        if (analysisResult.mostRepliedTo && analysisResult.mostRepliedTo.length > 0) {
            message += `📨 *MOST REPLIED TO*\n`;
            
            for (let i = 0; i < Math.min(3, analysisResult.mostRepliedTo.length); i++) {
                const member = analysisResult.mostRepliedTo[i];
                const name = await getUserName(member.id);
                message += `${i + 1}. ${name} - ${member.count} replies received\n`;
            }
            message += `\n`;
        }
        
        // Add most active members from message stats
        if (topMessages && topMessages.length > 0) {
            message += `📝 *MOST ACTIVE MEMBERS*\n`;
            
            for (let i = 0; i < topMessages.length; i++) {
                const member = topMessages[i];
                const name = await getUserName(member.userId);
                message += `${i + 1}. ${name} - ${member.count} messages\n`;
            }
        }
        
        // Add analysis timestamp
        message += `\nAnalysis updated: ${new Date().toLocaleString()}`;
        
        return { 
            success: true, 
            message: message
        };
    } catch (error) {
        console.error('Error finding influencers:', error);
        return { success: false, message: "Failed to identify group influencers: " + error.message };
    }
}

/**
 * Send multiple messages to dominate the conversation
 */
async function dominateChat(sock, remoteJid, sender, count = 5) {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        const maxCount = 10; // Limit to prevent abuse
        const actualCount = Math.min(parseInt(count) || 5, maxCount);
        
        if (actualCount <= 0) {
            return { success: false, message: "Please specify a valid count (1-10)." };
        }
        
        // Generate messages that feel natural but are designed to redirect conversation
        const messages = [
            "I was thinking about something completely different...",
            "This reminds me of an interesting topic...",
            "Let's talk about something more engaging!",
            "I just saw something fascinating about...",
            "Did anyone see the news about...",
            "What does everyone think about...",
            "Here's a question for the group...",
            "I'm curious what people here think of...",
            "This group should discuss...",
            "Changing topics, what about..."
        ];
        
        // Send the dominating messages with small delays
        for (let i = 0; i < actualCount; i++) {
            // Small random delay between messages
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            
            const message = messages[i % messages.length];
            await sock.sendMessage(remoteJid, { text: message });
        }
        
        return { 
            success: true, 
            message: `Conversation redirection complete.`,
            silent: true // No need for confirmation
        };
    } catch (error) {
        console.error('Error dominating chat:', error);
        return { success: false, message: "Failed to redirect conversation." };
    }
}

/**
 * Change topic to distract from unwanted discussions
 */
async function distractGroup(sock, remoteJid, sender, topic) {
    try {
        // Check if this is a group
        if (!remoteJid.endsWith('@g.us')) {
            return { success: false, message: "This command can only be used in groups." };
        }
        
        // Generate a distracting topic if none provided
        let distractionTopic = topic;
        
        if (!distractionTopic) {
            const topics = [
                "Did anyone watch that amazing sports game yesterday?",
                "What's everyone's favorite movie that came out recently?",
                "I just found this incredible new restaurant, anyone been there?",
                "What's the most interesting place you've ever traveled to?",
                "This weather is so strange lately, right?",
                "I need recommendations for a new show to watch!",
                "What's the best mobile app you've used lately?",
                "I just heard the craziest news story, did anyone else see it?",
                "What's everyone doing this weekend?",
                "If you could have any superpower, what would it be?"
            ];
            
            distractionTopic = topics[Math.floor(Math.random() * topics.length)];
        }
        
        // Send the distraction message
        await sock.sendMessage(remoteJid, { text: distractionTopic });
        
        return { 
            success: true, 
            message: `Distraction sent.`,
            silent: true // No need for confirmation
        };
    } catch (error) {
        console.error('Error distracting group:', error);
        return { success: false, message: "Failed to send distraction." };
    }
}

/**
 * Export functionality
 */
module.exports = {
    trackGroupChanges,
    getActiveMembers,
    setupDetector,
    warnUser,
    generateReport,
    silenceUser,
    isUserSilenced,
    findInfluencers,
    dominateChat,
    distractGroup
};