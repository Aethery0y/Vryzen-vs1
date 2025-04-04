/**
 * Points System Commands
 * Handles all commands related to the gamified engagement system
 */

const pointsSystem = require('../lib/pointsSystem');
const config = require('../config');

// Helper to format points profile
function formatProfile(profile) {
    if (!profile.exists) {
        return `*🌟 You're new here! 🌟*

You don't have any points yet. Start chatting, using commands, and participating in activities to earn points and level up!

Type *.dailycheck* to get your first points!`;
    }
    
    // Create progress bar for level
    const progressBarLength = 15;
    const filledBars = Math.floor(profile.level.progress / 100 * progressBarLength);
    const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(progressBarLength - filledBars);
    
    let response = `*🏆 ${profile.level.title} - LEVEL ${profile.level.level} 🏆*

*Points:* ${profile.points} pts
*Rank:* #${profile.rank} of ${profile.totalUsers} users
*Current Streak:* ${profile.streak} days 🔥
*Best Streak:* ${profile.maxStreak} days

*Level Progress:* ${profile.level.progress}%
${progressBar}`;

    if (profile.level.pointsToNextLevel) {
        response += `\n*Next Level:* ${profile.level.pointsToNextLevel} points needed`;
    } else {
        response += `\n*Max Level Reached!* 🎉`;
    }
    
    // Add achievements if any
    if (profile.achievements && profile.achievements.length > 0) {
        response += `\n\n*🏅 Achievements 🏅*\n`;
        profile.achievements.forEach(achievement => {
            response += `${achievement.name}\n`;
        });
    }
    
    // Add top 3 most active groups
    if (profile.topGroups && profile.topGroups.length > 0) {
        response += `\n*Most Active Groups:*\n`;
        profile.topGroups.forEach((group, index) => {
            response += `${index + 1}. ${group.points} pts\n`;
        });
    }
    
    return response;
}

// Helper to format leaderboard
function formatLeaderboard(users, title) {
    if (!users || users.length === 0) {
        return `*${title}*\n\nNo users found on the leaderboard yet!`;
    }
    
    let response = `*${title}*\n\n`;
    
    users.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        response += `${medal} ${user.userId.replace(/^\+/, '')}: ${user.points} pts (Lvl ${user.level.level} - ${user.level.title})\n`;
    });
    
    response += `\n_Type *.profile* to see your stats!_`;
    
    return response;
}

/**
 * Command handler for user profile (.profile)
 */
async function handleProfileCommand({ sock, sender, message, remoteJid }) {
    // Get user profile
    const profile = pointsSystem.getUserProfile(sender);
    
    // Format and send profile
    const formattedProfile = formatProfile(profile);
    
    await sock.sendMessage(remoteJid, { 
        text: formattedProfile,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for leaderboard (.leaderboard)
 */
async function handleLeaderboardCommand({ sock, sender, message, remoteJid, isGroup }) {
    // Get top users, filtered by group if in a group chat
    const topUsers = pointsSystem.getTopUsers(10, isGroup ? remoteJid : null);
    
    // Format leaderboard
    const title = isGroup ? '🏆 Group Leaderboard 🏆' : '🌟 Global Leaderboard 🌟';
    const formattedLeaderboard = formatLeaderboard(topUsers, title);
    
    await sock.sendMessage(remoteJid, { 
        text: formattedLeaderboard,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for daily check-in (.dailycheck)
 */
async function handleDailyCheckInCommand({ sock, sender, message, remoteJid }) {
    // Process daily check-in
    const checkInResult = pointsSystem.dailyCheckIn(sender);
    
    await sock.sendMessage(remoteJid, { 
        text: checkInResult.message,
        quoted: message 
    });
}

/**
 * Command handler for seeing possible achievements (.achievements)
 */
async function handleAchievementsCommand({ sock, sender, message, remoteJid }) {
    // Get all available badges
    const badges = pointsSystem.BADGES;
    
    // Get user achievements
    const profile = pointsSystem.getUserProfile(sender);
    const userAchievementIds = profile.achievements.map(a => a.id);
    
    // Format message
    let response = `*🏅 Available Achievements 🏅*\n\n`;
    
    Object.values(badges).forEach(badge => {
        const achieved = userAchievementIds.includes(badge.id);
        response += `${achieved ? '✅' : '⬜'} ${badge.name}: ${badge.requirement}\n`;
    });
    
    response += `\n_You've earned ${profile.achievements.length} out of ${Object.keys(badges).length} achievements!_`;
    
    await sock.sendMessage(remoteJid, { 
        text: response,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for seeing the points system rules (.pointsinfo)
 */
async function handlePointsInfoCommand({ sock, sender, message, remoteJid }) {
    // Format levels
    let levelsInfo = '*🌟 Levels & Titles 🌟*\n\n';
    pointsSystem.LEVELS.forEach(level => {
        levelsInfo += `*Level ${level.level} - ${level.title}*: ${level.points} points\n`;
    });
    
    // Format point values
    let pointsInfo = '*💯 Points System 💯*\n\n';
    pointsInfo += `*Basic Interactions:*\n`;
    pointsInfo += `• Regular message: ${pointsSystem.POINT_VALUES.MESSAGE} point\n`;
    pointsInfo += `• Using a bot command: ${pointsSystem.POINT_VALUES.COMMAND} points\n`;
    pointsInfo += `• Daily check-in: ${pointsSystem.POINT_VALUES.DAILY_LOGIN} points\n\n`;
    
    pointsInfo += `*Anime Activities:*\n`;
    pointsInfo += `• Correct anime quiz answer: ${pointsSystem.POINT_VALUES.ANIME_QUIZ_CORRECT} points\n`;
    pointsInfo += `• Quiz participation: ${pointsSystem.POINT_VALUES.ANIME_QUIZ_PARTICIPATION} points\n`;
    pointsInfo += `• Anime recommendation: ${pointsSystem.POINT_VALUES.ANIME_RECOMMENDATION} points\n\n`;
    
    pointsInfo += `*Special Activities:*\n`;
    pointsInfo += `• Creating stickers: ${pointsSystem.POINT_VALUES.CREATE_STICKER} points\n`;
    pointsInfo += `• Sharing content: ${pointsSystem.POINT_VALUES.SHARE_CONTENT} points\n`;
    pointsInfo += `• Group games: ${pointsSystem.POINT_VALUES.GROUP_GAME} points\n\n`;
    
    pointsInfo += `*Bonuses:*\n`;
    pointsInfo += `• Level up bonus: ${pointsSystem.POINT_VALUES.LEVEL_UP_BONUS} points\n`;
    pointsInfo += `• 7-day streak: 30 bonus points\n`;
    pointsInfo += `• 30-day streak: 150 bonus points\n`;
    
    // Send messages (split for better readability)
    await sock.sendMessage(remoteJid, { 
        text: pointsInfo,
        quoted: message 
    });
    
    await sock.sendMessage(remoteJid, { 
        text: levelsInfo
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

module.exports = {
    handleProfileCommand,
    handleLeaderboardCommand,
    handleDailyCheckInCommand,
    handleAchievementsCommand,
    handlePointsInfoCommand,
    awardPointsForInteraction: (userId, action, groupId) => {
        return pointsSystem.awardPoints(userId, action, groupId);
    }
};