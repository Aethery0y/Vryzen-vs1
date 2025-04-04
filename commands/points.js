/**
 * Points System Commands
 * Handles all commands related to the gamified engagement system
 */

const pointsSystem = require('../lib/pointsSystem');
const config = require('../config');

// Helper to format points profile
function formatProfile(profile) {
    if (!profile || !profile.points) {
        return `*🌟 You're new here! 🌟*

You don't have any points yet. Start chatting, using commands, and participating in activities to earn points and level up!

Type *.dailycheck* to get your first points!`;
    }
    
    // Calculate a simple level based on points
    const points = profile.points;
    const level = Math.floor(Math.sqrt(points / 10)) + 1;
    const nextLevelPoints = Math.pow(level, 2) * 10;
    const progress = Math.min(100, Math.floor((points / nextLevelPoints) * 100));
    
    // Create progress bar
    const progressBarLength = 15;
    const filledBars = Math.floor(progress / 100 * progressBarLength);
    const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(progressBarLength - filledBars);
    
    // Get titles based on level
    const titles = [
        'Anime Newcomer', 'Manga Reader', 'Anime Fan', 'Otaku Apprentice', 
        'Otaku Explorer', 'Anime Enthusiast', 'Anime Scholar', 'Manga Master', 
        'Anime Connoisseur', 'Legendary Weeb'
    ];
    const title = titles[Math.min(level - 1, titles.length - 1)];
    
    let response = `*🏆 ${title} - LEVEL ${level} 🏆*

*Points:* ${profile.points} pts
*Rank:* #${profile.rank || '??'} 
*Daily Stats:* ${profile.dailyStats ? `${profile.dailyStats.total} points earned today` : 'No activity today'}

*Level Progress:* ${progress}%
${progressBar}`;

    response += `\n*Next Level:* ${nextLevelPoints - points} points needed`;
    
    // Add basic stats
    response += `\n\n*📊 Stats 📊*`;
    response += `\n• Current Points: ${points}`;
    response += `\n• Current Level: ${level}`;
    
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
        // Simplified display without level info for now
        response += `${medal} ${user.userId.replace(/^\+/, '')}: ${user.points} pts (Rank #${user.rank || (index + 1)})\n`;
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
    pointsSystem.updatePoints(sender, 5, 'command_usage');
}

/**
 * Command handler for leaderboard (.leaderboard)
 */
async function handleLeaderboardCommand({ sock, sender, message, remoteJid, isGroup }) {
    // Get top users
    const topUsers = pointsSystem.getTopUsers(10);
    
    // Format leaderboard
    const title = isGroup ? '🏆 Group Leaderboard 🏆' : '🌟 Global Leaderboard 🌟';
    const formattedLeaderboard = formatLeaderboard(topUsers, title);
    
    await sock.sendMessage(remoteJid, { 
        text: formattedLeaderboard,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.updatePoints(sender, 5, 'command_usage');
}

/**
 * Command handler for daily check-in (.dailycheck)
 */
async function handleDailyCheckInCommand({ sock, sender, message, remoteJid }) {
    // Process daily check-in - use grantDailyBonus instead of dailyCheckIn
    const checkInResult = pointsSystem.grantDailyBonus(sender);
    
    await sock.sendMessage(remoteJid, { 
        text: checkInResult.message,
        quoted: message 
    });
}

/**
 * Command handler for seeing possible achievements (.achievements)
 */
async function handleAchievementsCommand({ sock, sender, message, remoteJid }) {
    // Get user profile
    const profile = pointsSystem.getUserProfile(sender);
    
    // Simple achievement message since BADGES aren't implemented yet
    let response = `*🏅 Available Achievements 🏅*\n\n`;
    response += `Achievement system is being updated. Check back later!\n\n`;
    response += `You currently have ${profile.points} points.`;
    
    await sock.sendMessage(remoteJid, { 
        text: response,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.updatePoints(sender, 5, 'command_usage');
}

/**
 * Command handler for seeing the points system rules (.pointsinfo)
 */
async function handlePointsInfoCommand({ sock, sender, message, remoteJid }) {
    // Get points system settings from config
    const pointsSettings = require('../config').animeGames.points;
    
    // Format point values
    let pointsInfo = '*💯 Points System 💯*\n\n';
    pointsInfo += `*Basic Interactions:*\n`;
    pointsInfo += `• Regular message: ${pointsSettings.messagePoints} point\n`;
    pointsInfo += `• Using a bot command: 5 points\n`;
    pointsInfo += `• Daily check-in: ${pointsSettings.dailyBonus} points\n\n`;
    
    pointsInfo += `*Anime Activities:*\n`;
    pointsInfo += `• Correct anime quiz answer: ${pointsSettings.quizPoints} points\n`;
    pointsInfo += `• Card collection: 5-50 points (based on rarity)\n`;
    pointsInfo += `• Betting games: Win back double your bet!\n\n`;
    
    pointsInfo += `*Special Activities:*\n`;
    pointsInfo += `• Creating stickers: 10 points\n`;
    pointsInfo += `• Sharing content: 5 points\n`;
    pointsInfo += `• Group games: 15-30 points\n\n`;
    
    pointsInfo += `*Limits:*\n`;
    pointsInfo += `• Maximum daily points: ${pointsSettings.maxPointsPerDay} points\n`;
    pointsInfo += `• Points reset: Never\n`;
    
    // Send message
    await sock.sendMessage(remoteJid, { 
        text: pointsInfo,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.updatePoints(sender, 5, 'command_usage');
}

module.exports = {
    handleProfileCommand,
    handleLeaderboardCommand,
    handleDailyCheckInCommand,
    handleAchievementsCommand,
    handlePointsInfoCommand,
    awardPointsForInteraction: (userId, action) => {
        // Map actions to point values
        const pointValues = {
            'MESSAGE': 1,
            'COMMAND': 5,
            'QUIZ': 15,
            'STICKER': 10,
            'SHARE': 5
        };
        const points = pointValues[action] || 1;
        return pointsSystem.updatePoints(userId, points, action.toLowerCase());
    }
};
