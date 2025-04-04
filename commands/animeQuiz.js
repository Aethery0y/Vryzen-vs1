/**
 * Anime Quiz Commands for WhatsApp Bot
 * Handles quiz-related commands and answer processing
 */

const animeQuiz = require('../lib/animeQuiz');
const pointsSystem = require('../lib/pointsSystem');

/**
 * Handle quiz-related commands
 * @param {object} params Command parameters
 */
async function handleQuizCommand(params) {
    const { sock, message, messageContent, sender, remoteJid, quotedMsg } = params;
    
    // Get command and arguments
    const parts = messageContent.split(' ');
    const subCommand = parts[1]?.toLowerCase();
    
    // Extract args (combine remaining parts)
    const args = parts.slice(2).join(' ');
    
    switch (subCommand) {
        case 'start':
        case 'new':
            await startNewQuiz(sock, remoteJid, sender);
            break;
            
        case 'end':
        case 'stop':
            await endCurrentQuiz(sock, remoteJid, sender);
            break;
            
        case 'stats':
            await showQuizStats(sock, remoteJid, sender, args);
            break;
            
        case 'leaderboard':
        case 'top':
            await showLeaderboard(sock, remoteJid);
            break;
            
        case 'help':
        default:
            await showQuizHelp(sock, remoteJid);
            break;
    }
}

/**
 * Start a new quiz in the group
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {string} sender Sender ID
 */
async function startNewQuiz(sock, remoteJid, sender) {
    const result = await animeQuiz.startQuiz({ sock, remoteJid, sender });
    
    if (!result.success) {
        await sock.sendMessage(remoteJid, { 
            text: result.message,
            quoted: message 
        });
    }
    // If successful, the startQuiz function already sent the quiz message
}

/**
 * End the current quiz in the group
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {string} sender Sender ID
 */
async function endCurrentQuiz(sock, remoteJid, sender) {
    const result = await animeQuiz.endQuiz({ sock, remoteJid });
    
    if (!result.success) {
        await sock.sendMessage(remoteJid, { 
            text: result.message
        });
    }
    // If successful, the endQuiz function already sent the results message
}

/**
 * Show quiz statistics for a user
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {string} sender Sender ID
 * @param {string} userArg Optional user to check stats for
 */
async function showQuizStats(sock, remoteJid, sender, userArg) {
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
    
    // Get user stats
    const stats = animeQuiz.getUserStats(targetUser);
    const points = pointsSystem.getUserPoints(targetUser);
    
    // Format display name
    const displayName = showingSelf ? 'Your' : `@${targetUser.split('@')[0]}'s`;
    
    // Calculate accuracy
    const accuracy = stats.totalAnswered > 0 
        ? Math.round(stats.correctAnswers / stats.totalAnswered * 100) 
        : 0;
    
    // Create stats message
    let message = `*${displayName} Anime Quiz Stats*\n\n`;
    message += `Total quizzes answered: ${stats.totalAnswered}\n`;
    message += `Correct answers: ${stats.correctAnswers}\n`;
    message += `Accuracy: ${accuracy}%\n`;
    message += `Current streak: ${stats.streakCurrent}\n`;
    message += `Best streak: ${stats.streakBest}\n`;
    message += `Current points: ${points}\n\n`;
    
    // Add tip for new users
    if (stats.totalAnswered === 0) {
        message += `_Participate in quizzes by answering with A, B, C, or D when a quiz is active!_`;
    } else {
        message += `_Keep playing to earn more points and increase your streak!_`;
    }
    
    // Send message
    await sock.sendMessage(remoteJid, { 
        text: message,
        mentions: showingSelf ? [] : [targetUser]
    });
}

/**
 * Show anime quiz leaderboard
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 */
async function showLeaderboard(sock, remoteJid) {
    // Get top quiz performers
    const leaderboard = animeQuiz.getLeaderboard(10);
    
    if (leaderboard.length === 0) {
        await sock.sendMessage(remoteJid, { 
            text: "No quiz data available yet. Be the first to play!"
        });
        return;
    }
    
    // Create leaderboard message
    let message = `*🏆 ANIME QUIZ LEADERBOARD 🏆*\n\n`;
    
    // Add each user to the leaderboard
    leaderboard.forEach((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} @${entry.userId.split('@')[0]} - ${entry.correctAnswers} correct (${entry.accuracy}%)\n`;
    });
    
    message += `\n_Use .quiz stats to see your personal stats._`;
    
    // Get user IDs for mentions
    const mentions = leaderboard.map(entry => entry.userId);
    
    // Send message with mentions
    await sock.sendMessage(remoteJid, { 
        text: message,
        mentions
    });
}

/**
 * Show help for quiz commands
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 */
async function showQuizHelp(sock, remoteJid) {
    const message = `*🎮 Anime Quiz Game Commands 🎮*\n\n` +
        `📋 *Basic Commands:*\n` +
        `• .quiz start - Begin a new anime trivia quiz\n` +
        `• .quiz end - Finish the current active quiz\n` +
        `• .quiz help - Show this help message\n\n` +
        
        `📊 *Stats & Rankings:*\n` +
        `• .quiz stats - View your personal quiz statistics\n` +
        `• .quiz stats @user - Check another player's stats\n` +
        `• .quiz leaderboard - See top quiz players ranking\n\n` +
        
        `🎯 *How to Play:*\n` +
        `• When a quiz is active, the bot posts a question with 4 options\n` +
        `• Simply reply with A, B, C, or D to submit your answer\n` +
        `• Correct answers earn you points and increase your streak\n` +
        `• Be quick! Quizzes have a 30-second time limit\n` +
        `• Earn bonus points for consecutive correct answers\n\n` +
        
        `💡 *Pro Tips:*\n` +
        `• Build your anime knowledge to improve your score\n` +
        `• Play regularly to appear on the leaderboard\n` +
        `• Challenge friends to beat your accuracy percentage`;
    
    await sock.sendMessage(remoteJid, { text: message });
}

/**
 * Handle a potential quiz answer (A, B, C, D)
 * @param {object} params Answer parameters
 * @returns {boolean} True if the message was processed as a quiz answer
 */
async function handleQuizAnswer(params) {
    return await animeQuiz.handleQuizAnswer(params);
}

module.exports = {
    handleQuizCommand,
    handleQuizAnswer
};