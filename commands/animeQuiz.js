/**
 * Anime Quiz Commands
 * Handles all commands related to the anime quiz game
 */

const animeQuiz = require('../lib/animeQuiz');
const config = require('../config');
const pointsSystem = require('../lib/pointsSystem');

// Map of letter answers to indices
const answerMap = {
    'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4
};

/**
 * Command handler for starting a quiz (.animequiz)
 */
async function handleStartQuizCommand({ sock, sender, message, remoteJid, messageContent }) {
    // Extract difficulty and category from command if provided
    const args = messageContent.split(' ').slice(1);
    
    let difficulty = null;
    let category = null;
    
    // Parse arguments
    if (args.length > 0) {
        // Check for difficulty
        const diffArg = args.find(arg => 
            Object.values(animeQuiz.DIFFICULTY).includes(arg.toLowerCase())
        );
        
        if (diffArg) {
            difficulty = diffArg.toLowerCase();
        }
        
        // Check for category
        const catArg = args.find(arg => 
            Object.values(animeQuiz.CATEGORIES).includes(arg.toLowerCase())
        );
        
        if (catArg) {
            category = catArg.toLowerCase();
        }
    }
    
    // Start the quiz
    const quiz = animeQuiz.startQuiz(remoteJid, difficulty, category);
    
    if (!quiz.success) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ ${quiz.error}`,
            quoted: message 
        });
        return;
    }
    
    // Format difficulty tag based on level
    let difficultyTag = '';
    switch (quiz.difficulty) {
        case animeQuiz.DIFFICULTY.EASY:
            difficultyTag = '🟢 EASY';
            break;
        case animeQuiz.DIFFICULTY.MEDIUM:
            difficultyTag = '🟡 MEDIUM';
            break;
        case animeQuiz.DIFFICULTY.HARD:
            difficultyTag = '🔴 HARD';
            break;
        case animeQuiz.DIFFICULTY.WEEB:
            difficultyTag = '⚫ WEEB';
            break;
    }
    
    // Format category
    const categoryText = quiz.category.charAt(0).toUpperCase() + quiz.category.slice(1);
    
    // Format quiz message
    const quizMessage = `*🎮 ANIME QUIZ - ${difficultyTag}*
*Category:* ${categoryText}
*Time:* ${quiz.timeLimit}

*Question:* ${quiz.question}

${quiz.options}

_Reply with just A, B, C, or D to answer!_
_+${pointsSystem.POINT_VALUES.ANIME_QUIZ_CORRECT} points for correct answer_`;
    
    await sock.sendMessage(remoteJid, { 
        text: quizMessage,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for anime quiz answer
 * This is not a direct command but processes A/B/C/D answers to quizzes
 */
async function handleQuizAnswer({ sock, sender, message, remoteJid, messageContent }) {
    // Extract answer from message (should be just A, B, C, D or a full option text)
    const answer = messageContent.trim();
    
    // Check if answer is valid (A, B, C, D)
    const isValidAnswer = answer.length === 1 && answer.match(/[A-D]/i);
    
    // If not a valid answer format, don't process
    if (!isValidAnswer) {
        return false;
    }
    
    // Submit the answer
    const result = animeQuiz.answerQuiz(remoteJid, sender, answer);
    
    // If no active quiz, silently ignore
    if (!result.success) {
        return false;
    }
    
    // If correct answer
    if (result.correct) {
        const userNumber = sender.split('@')[0];
        
        await sock.sendMessage(remoteJid, { 
            text: `🎉 *Correct!* 🎉\n\n@${userNumber} got it right!\nAnswer: ${result.correctAnswer}\n\n+${result.pointsAwarded} points awarded!`,
            quoted: message,
            mentions: [sender]
        });
        
        return true;
    }
    
    // For incorrect answers, we don't need to send a message to avoid cluttering the chat
    return true;
}

/**
 * Command handler for quiz stats (.quizstats)
 */
async function handleQuizStatsCommand({ sock, sender, message, remoteJid }) {
    // Get quiz statistics
    const stats = animeQuiz.getQuizStats();
    
    // Format response
    let response = `*📊 Anime Quiz Statistics 📊*\n\n`;
    response += `*Total Questions:* ${stats.totalQuestions}\n\n`;
    
    response += `*Questions by Difficulty:*\n`;
    for (const [diff, count] of Object.entries(stats.byDifficulty)) {
        const diffName = diff.toUpperCase();
        response += `• ${diffName}: ${count}\n`;
    }
    
    response += `\n*Questions by Category:*\n`;
    for (const [cat, count] of Object.entries(stats.byCategory)) {
        const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
        response += `• ${catName}: ${count}\n`;
    }
    
    response += `\n_Start a quiz with .animequiz_`;
    
    await sock.sendMessage(remoteJid, { 
        text: response,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for ending a quiz (.endquiz)
 * Only group admins and bot admins can end a quiz
 */
async function handleEndQuizCommand({ sock, sender, message, remoteJid, isGroup }) {
    // Check if user is authorized (bot admin or group admin)
    const isAuthorized = config.botAdmins.includes(sender.split('@')[0]);
    
    if (!isAuthorized) {
        await sock.sendMessage(remoteJid, { 
            text: "❌ Only bot admins can end an active quiz.",
            quoted: message 
        });
        return;
    }
    
    // End the quiz
    const result = animeQuiz.endQuiz(remoteJid);
    
    if (!result.success) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ ${result.error}`,
            quoted: message 
        });
        return;
    }
    
    // Send result message
    await sock.sendMessage(remoteJid, { 
        text: `*Quiz Ended*\n\nThe correct answer was: ${result.correctAnswer}\n\n${result.participants} participants attempted this quiz.`,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for adding a new quiz question (.addquiz)
 * Only bot admins can add new questions
 */
async function handleAddQuizCommand({ sock, sender, message, remoteJid, messageContent }) {
    // Check if user is authorized (bot admin)
    const cleanSender = sender.split('@')[0];
    if (!config.botAdmins.includes(cleanSender)) {
        await sock.sendMessage(remoteJid, { 
            text: "❌ Only bot admins can add quiz questions.",
            quoted: message 
        });
        return;
    }
    
    // Extract question data from the message
    // Format expected: .addquiz "Question text" "Option A" "Option B" "Option C" "Option D" 0 [category] [difficulty]
    
    try {
        // Remove command
        const argText = messageContent.substring('.addquiz'.length).trim();
        
        // Use regex to extract quoted strings
        const quotedRegex = /"([^"]*)"/g;
        const matches = [...argText.matchAll(quotedRegex)];
        
        if (matches.length < 5) {
            throw new Error('Not enough quoted arguments.');
        }
        
        // Extract question and options
        const question = matches[0][1];
        const options = [
            matches[1][1], 
            matches[2][1], 
            matches[3][1], 
            matches[4][1]
        ];
        
        // Get remaining arguments after the quoted strings
        const remainingArgs = argText.replace(quotedRegex, '').trim().split(/\s+/);
        
        // Parse answer index
        const answerIndex = parseInt(remainingArgs[0], 10);
        
        if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
            throw new Error(`Invalid answer index: ${remainingArgs[0]}`);
        }
        
        // Parse optional category and difficulty
        let category = remainingArgs[1] || 'series';
        let difficulty = remainingArgs[2] || 'medium';
        
        // Validate category
        if (!Object.values(animeQuiz.CATEGORIES).includes(category)) {
            category = 'series';
        }
        
        // Validate difficulty
        if (!Object.values(animeQuiz.DIFFICULTY).includes(difficulty)) {
            difficulty = 'medium';
        }
        
        // Create question object
        const questionData = {
            question,
            options,
            answer: answerIndex,
            category,
            difficulty
        };
        
        // Add the question
        const result = animeQuiz.addQuestion(questionData);
        
        if (result.success) {
            await sock.sendMessage(remoteJid, { 
                text: `✅ Quiz question added successfully! Total questions: ${result.questionCount}`,
                quoted: message 
            });
        } else {
            await sock.sendMessage(remoteJid, { 
                text: `❌ Error adding question: ${result.error}`,
                quoted: message 
            });
        }
    } catch (error) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ Invalid format. Use: .addquiz "Question text" "Option A" "Option B" "Option C" "Option D" CorrectAnswerIndex [category] [difficulty]`,
            quoted: message 
        });
    }
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for showing quiz help (.quizhelp)
 */
async function handleQuizHelpCommand({ sock, sender, message, remoteJid }) {
    const helpText = `*🎮 Anime Quiz Help 🎮*

*Start a quiz:*
• .animequiz - Start a random quiz
• .animequiz easy - Start an easy quiz
• .animequiz medium - Start a medium quiz
• .animequiz hard - Start a hard quiz
• .animequiz weeb - Start a weeb (expert) quiz
• .animequiz characters - Start a character quiz
• .animequiz [difficulty] [category] - Start a quiz with specific difficulty and category

*Categories:*
• characters - Anime character questions
• series - Anime series questions
• studios - Animation studio questions
• quotes - Anime quotes
• openings - Anime opening songs
• genres - Anime genres
• voice_actors - Voice actor questions
• manga - Manga-related questions

*Other Commands:*
• .quizstats - Show quiz statistics
• .endquiz - End an active quiz (admin only)
• .addquiz - Add a new quiz question (admin only)

*Points:*
• Participation: +${pointsSystem.POINT_VALUES.ANIME_QUIZ_PARTICIPATION} points
• Correct answer: +${pointsSystem.POINT_VALUES.ANIME_QUIZ_CORRECT} points

_To answer a quiz, just reply with A, B, C, or D!_`;

    await sock.sendMessage(remoteJid, { 
        text: helpText,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

module.exports = {
    handleStartQuizCommand,
    handleQuizAnswer,
    handleQuizStatsCommand,
    handleEndQuizCommand,
    handleAddQuizCommand,
    handleQuizHelpCommand
};