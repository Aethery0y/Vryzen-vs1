/**
 * Anime Quiz Module for WhatsApp Bot
 * Manages anime quizzes for user engagement and points
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const fetch = require('node-fetch');
const nodeSchedule = require('node-schedule');
const { setTimeout } = require('timers/promises');

// Data storage
let quizState = {
    activeQuizzes: {},  // Map of groupId -> quiz data
    quizHistory: {},    // Map of groupId -> array of past quizzes
    userStats: {},      // Map of userId -> quiz stats
    dailyLimits: {}     // Map of groupId -> count of quizzes today
};

// File paths
const QUIZ_FILE = config.animeQuizFile || path.join(config.databaseDir, 'animeQuiz.json');
const ANIME_DATA_FILE = path.join(config.databaseDir, 'animeQuizData.json');

// Quiz questions bank
let animeQuizBank = [];
let quizScheduleJobs = {};

/**
 * Initialize the anime quiz module
 */
function initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(config.databaseDir)) {
        fs.mkdirSync(config.databaseDir, { recursive: true });
    }

    // Load quiz state data
    try {
        if (fs.existsSync(QUIZ_FILE)) {
            const data = fs.readFileSync(QUIZ_FILE, 'utf8');
            quizState = JSON.parse(data);
            console.log('Anime Quiz: Loaded quiz state data');
        } else {
            console.log('Anime Quiz: No existing quiz state data found, starting fresh');
            saveQuizState();
        }
    } catch (error) {
        console.error('Anime Quiz: Error loading quiz state data', error);
        quizState = {
            activeQuizzes: {},
            quizHistory: {},
            userStats: {},
            dailyLimits: {}
        };
        saveQuizState();
    }

    // Load quiz questions from file or generate if not exist
    loadOrGenerateQuizQuestions();

    // Schedule reset of daily limits at midnight
    nodeSchedule.scheduleJob('0 0 * * *', () => {
        console.log('Anime Quiz: Resetting daily quiz limits');
        quizState.dailyLimits = {};
        saveQuizState();
    });
}

/**
 * Load existing quiz questions or generate new ones
 */
async function loadOrGenerateQuizQuestions() {
    try {
        if (fs.existsSync(ANIME_DATA_FILE)) {
            const data = fs.readFileSync(ANIME_DATA_FILE, 'utf8');
            animeQuizBank = JSON.parse(data);
            console.log(`Anime Quiz: Loaded ${animeQuizBank.length} quiz questions from file`);
        } else {
            console.log('Anime Quiz: No quiz questions found, generating default questions');
            animeQuizBank = generateDefaultQuizQuestions();
            fs.writeFileSync(ANIME_DATA_FILE, JSON.stringify(animeQuizBank, null, 2));
            console.log(`Anime Quiz: Generated ${animeQuizBank.length} default quiz questions`);
        }
    } catch (error) {
        console.error('Anime Quiz: Error loading quiz questions', error);
        animeQuizBank = generateDefaultQuizQuestions();
        fs.writeFileSync(ANIME_DATA_FILE, JSON.stringify(animeQuizBank, null, 2));
    }
}

/**
 * Save quiz state to file
 */
function saveQuizState() {
    try {
        fs.writeFileSync(QUIZ_FILE, JSON.stringify(quizState, null, 2));
    } catch (error) {
        console.error('Anime Quiz: Error saving quiz state', error);
    }
}

/**
 * Generate a default set of anime quiz questions
 * @returns {array} Array of quiz question objects
 */
function generateDefaultQuizQuestions() {
    // Basic default questions to start with
    return [
        {
            question: "Which anime features a boy who wants to become the Pirate King?",
            options: ["One Piece", "Naruto", "Dragon Ball", "Bleach"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "In 'Attack on Titan', what are the giant humanoid creatures called?",
            options: ["Monsters", "Titans", "Giants", "Colossi"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Which anime features a world where people have superpowers called 'Quirks'?",
            options: ["One Punch Man", "Fairy Tail", "My Hero Academia", "Black Clover"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "What is the name of the main character in 'Naruto'?",
            options: ["Sasuke Uchiha", "Naruto Uzumaki", "Kakashi Hatake", "Sakura Haruno"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Which anime is about a high school student who finds a notebook that can kill people?",
            options: ["Tokyo Ghoul", "Death Parade", "Death Note", "Another"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "In 'Demon Slayer', what is Tanjiro's sister's name?",
            options: ["Nezuko", "Kanao", "Shinobu", "Mitsuri"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "What studio produced 'Spirited Away'?",
            options: ["Toei Animation", "Studio Ghibli", "Madhouse", "Kyoto Animation"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Which of these is NOT a Pokémon?",
            options: ["Pikachu", "Digimon", "Charmander", "Squirtle"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "What is the name of the ship in 'One Piece'?",
            options: ["Going Merry", "Thousand Sunny", "Both A and B", "Red Force"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Who is the creator of 'Dragon Ball'?",
            options: ["Masashi Kishimoto", "Eiichiro Oda", "Akira Toriyama", "Tite Kubo"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "What is the name of Goku's signature attack in 'Dragon Ball'?",
            options: ["Spirit Bomb", "Kamehameha", "Final Flash", "Galick Gun"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Which of these anime is set in a virtual reality game?",
            options: ["No Game No Life", "Sword Art Online", "Overlord", "All of the above"],
            correctAnswer: 3,
            difficulty: "medium"
        },
        {
            question: "What is the highest-grossing anime film of all time?",
            options: ["Your Name", "Spirited Away", "Demon Slayer: Mugen Train", "Princess Mononoke"],
            correctAnswer: 2,
            difficulty: "hard"
        },
        {
            question: "Which anime features a character named Saitama who can defeat any enemy with one punch?",
            options: ["Hunter x Hunter", "One Punch Man", "Mob Psycho 100", "Jujutsu Kaisen"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "In 'Death Note', what is the name of the Shinigami who drops the Death Note in the human world?",
            options: ["Rem", "Ryuk", "Gelus", "Sidoh"],
            correctAnswer: 1,
            difficulty: "medium"
        }
    ];
}

/**
 * Add a new quiz question to the question bank
 * @param {object} questionData The question data object
 * @returns {boolean} Success status
 */
function addQuizQuestion(questionData) {
    try {
        // Validate question format
        if (!questionData.question || !Array.isArray(questionData.options) || 
            questionData.options.length < 2 || typeof questionData.correctAnswer !== 'number') {
            return false;
        }
        
        // Add to question bank
        animeQuizBank.push(questionData);
        
        // Save to file
        fs.writeFileSync(ANIME_DATA_FILE, JSON.stringify(animeQuizBank, null, 2));
        return true;
    } catch (error) {
        console.error('Anime Quiz: Error adding new question', error);
        return false;
    }
}

/**
 * Start a new quiz in a group
 * @param {object} params Parameters object
 * @returns {object} Quiz start result
 */
async function startQuiz({ sock, remoteJid, sender }) {
    // Check if there's already an active quiz in this group
    if (quizState.activeQuizzes[remoteJid]) {
        return {
            success: false,
            error: 'quiz_already_active',
            message: "There's already an active quiz in this group! Answer that one first."
        };
    }
    
    // Check daily quiz limit for this group
    if (!quizState.dailyLimits[remoteJid]) {
        quizState.dailyLimits[remoteJid] = 0;
    }
    
    const quizSettings = config.animeGames.quiz;
    if (quizState.dailyLimits[remoteJid] >= quizSettings.maxQuestionsPerDay) {
        return {
            success: false,
            error: 'daily_limit_reached',
            message: `This group has reached the daily quiz limit (${quizSettings.maxQuestionsPerDay} quizzes). Try again tomorrow!`
        };
    }
    
    // Select a random question
    if (animeQuizBank.length === 0) {
        return {
            success: false,
            error: 'no_questions',
            message: "No quiz questions available. Please try again later."
        };
    }
    
    // Get a random question that hasn't been used recently in this group
    const recentQuestions = (quizState.quizHistory[remoteJid] || []).slice(-10);
    let recentQuestionIds = recentQuestions.map(q => q.questionId);
    
    // Filter out recent questions if possible
    let availableQuestions = animeQuizBank.filter((_, index) => !recentQuestionIds.includes(index));
    
    // If all questions have been used recently, just pick any random one
    if (availableQuestions.length === 0) {
        availableQuestions = animeQuizBank;
    }
    
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const questionIndex = animeQuizBank.indexOf(availableQuestions[randomIndex]);
    const selectedQuestion = availableQuestions[randomIndex];
    
    // Create option text with A, B, C, D labels
    const optionLabels = ['A', 'B', 'C', 'D'];
    let optionsText = selectedQuestion.options.map((option, index) => 
        `${optionLabels[index]}. ${option}`
    ).join('\n');
    
    // Create quiz in active quizzes map
    const quizId = `quiz_${Date.now()}`;
    const quiz = {
        questionId: questionIndex,
        question: selectedQuestion.question,
        options: selectedQuestion.options,
        correctAnswer: selectedQuestion.correctAnswer,
        correctLetter: optionLabels[selectedQuestion.correctAnswer],
        startTime: Date.now(),
        answers: {},
        status: 'active',
        initiatedBy: sender
    };
    
    quizState.activeQuizzes[remoteJid] = quiz;
    
    // Increment daily quiz count
    quizState.dailyLimits[remoteJid]++;
    
    // Save quiz state
    saveQuizState();
    
    // Send the quiz message
    const quizMessage = `📝 *ANIME QUIZ TIME!* 📝\n\n*Question:*\n${selectedQuestion.question}\n\n*Options:*\n${optionsText}\n\n⏰ You have ${quizSettings.timeToAnswer} seconds to answer by sending A, B, C, or D!`;
    
    await sock.sendMessage(remoteJid, { text: quizMessage });
    
    // Schedule quiz timeout
    scheduleQuizTimeout(sock, remoteJid, quizSettings.timeToAnswer);
    
    return {
        success: true,
        message: "Quiz started successfully!",
        quiz
    };
}

/**
 * Schedule a timeout for a quiz
 * @param {object} sock WA socket
 * @param {string} remoteJid Chat ID
 * @param {number} timeSeconds Seconds until timeout
 */
function scheduleQuizTimeout(sock, remoteJid, timeSeconds) {
    // Clear any existing timeout for this chat
    if (quizScheduleJobs[remoteJid]) {
        quizScheduleJobs[remoteJid].cancel();
    }
    
    // Schedule a new timeout
    quizScheduleJobs[remoteJid] = nodeSchedule.scheduleJob(
        new Date(Date.now() + (timeSeconds * 1000)), 
        async () => {
            await endQuiz({ sock, remoteJid, timeExpired: true });
        }
    );
}

/**
 * End a quiz and announce results
 * @param {object} params Parameters object
 * @returns {object} Quiz end result
 */
async function endQuiz({ sock, remoteJid, timeExpired = false }) {
    // Check if there's an active quiz
    const quiz = quizState.activeQuizzes[remoteJid];
    if (!quiz) {
        return {
            success: false,
            error: 'no_active_quiz',
            message: "There's no active quiz in this group."
        };
    }
    
    // Cancel any active timeout
    if (quizScheduleJobs[remoteJid]) {
        quizScheduleJobs[remoteJid].cancel();
        quizScheduleJobs[remoteJid] = null;
    }
    
    // Mark quiz as ended
    quiz.status = 'ended';
    quiz.endTime = Date.now();
    
    // Find winners (if any)
    const correctAnswers = Object.entries(quiz.answers)
        .filter(([_, answerData]) => answerData.isCorrect)
        .sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp
    
    // Prepare result message
    let resultMessage = '';
    
    if (timeExpired) {
        resultMessage = '⏰ *Time is up!* ⏰\n\n';
    }
    
    resultMessage += `*Quiz Results*\n\n`;
    resultMessage += `Question: ${quiz.question}\n`;
    resultMessage += `Correct Answer: ${quiz.correctLetter}. ${quiz.options[quiz.correctAnswer]}\n\n`;
    
    // Handle winners
    if (correctAnswers.length > 0) {
        resultMessage += '*Winners:*\n';
        
        // List winners with their response times
        correctAnswers.forEach(([userId, answerData], index) => {
            const responseTime = (answerData.timestamp - quiz.startTime) / 1000;
            resultMessage += `${index + 1}. @${userId.split('@')[0]} (${responseTime.toFixed(1)}s)`;
            
            // Add special indicator for first correct answer
            if (index === 0) {
                resultMessage += ' 🥇';
            }
            
            resultMessage += '\n';
            
            // Update user stats
            updateUserStats(userId, true);
        });
    } else {
        resultMessage += '*No one answered correctly!* 😔\n';
    }
    
    // Total participants
    const totalParticipants = Object.keys(quiz.answers).length;
    resultMessage += `\nTotal participants: ${totalParticipants}`;
    
    // Add quiz to history
    if (!quizState.quizHistory[remoteJid]) {
        quizState.quizHistory[remoteJid] = [];
    }
    
    // Store minimal quiz data in history
    quizState.quizHistory[remoteJid].push({
        questionId: quiz.questionId,
        startTime: quiz.startTime,
        endTime: quiz.endTime,
        participants: totalParticipants,
        winners: correctAnswers.length
    });
    
    // Limit history size
    if (quizState.quizHistory[remoteJid].length > 50) {
        quizState.quizHistory[remoteJid] = quizState.quizHistory[remoteJid].slice(-50);
    }
    
    // Remove from active quizzes
    delete quizState.activeQuizzes[remoteJid];
    
    // Save state
    saveQuizState();
    
    // Send results message
    const mentionedJids = correctAnswers.map(([userId]) => userId);
    await sock.sendMessage(remoteJid, { 
        text: resultMessage,
        mentions: mentionedJids
    });
    
    // Schedule next quiz if auto-quiz is enabled for this group
    // (This feature can be implemented later)
    
    return {
        success: true,
        message: "Quiz ended successfully",
        winners: correctAnswers.map(([userId]) => userId)
    };
}

/**
 * Process a quiz answer from a user
 * @param {object} params Parameters object
 * @returns {boolean} True if the message was processed as a quiz answer
 */
async function handleQuizAnswer({ sock, sender, message, remoteJid, messageContent }) {
    // Check if there's an active quiz in this group
    const quiz = quizState.activeQuizzes[remoteJid];
    if (!quiz || quiz.status !== 'active') {
        return false; // No active quiz, not a quiz answer
    }
    
    // Check if this user already answered
    if (quiz.answers[sender]) {
        return true; // Already answered, but still a quiz answer
    }
    
    // Clean and normalize the message content
    const cleanAnswer = messageContent.trim().toUpperCase();
    
    // Check if the message is a valid option (A, B, C, D)
    const validOptions = ['A', 'B', 'C', 'D', '1', '2', '3', '4']; 
    if (!validOptions.includes(cleanAnswer)) {
        return false; // Not a valid quiz answer format
    }
    
    // Convert numeric answers to letter format (1->A, 2->B, etc.)
    let letterAnswer = cleanAnswer;
    if (cleanAnswer >= '1' && cleanAnswer <= '4') {
        letterAnswer = String.fromCharCode('A'.charCodeAt(0) + parseInt(cleanAnswer) - 1);
    }
    
    // Convert letter to index (A->0, B->1, etc.)
    const answerIndex = letterAnswer.charCodeAt(0) - 'A'.charCodeAt(0);
    
    // Check if valid option index
    if (answerIndex < 0 || answerIndex >= quiz.options.length) {
        return false; // Invalid option
    }
    
    // Record this user's answer
    const isCorrect = answerIndex === quiz.correctAnswer;
    quiz.answers[sender] = {
        answer: answerIndex,
        letter: letterAnswer,
        isCorrect,
        timestamp: Date.now()
    };
    
    // Award points to user if correct
    if (isCorrect) {
        const pointsSystem = require('./pointsSystem');
        const result = pointsSystem.awardQuizPoints(sender);
        
        if (result.success) {
            // Acknowledge the correct answer with feedback
            const feedbackMsg = `✅ Correct, @${sender.split('@')[0]}! ${result.message}`;
            await sock.sendMessage(remoteJid, { 
                text: feedbackMsg,
                mentions: [sender]
            });
        }
    } else {
        // Wrong answer feedback (optional, can be removed for less spam)
        const feedbackMsg = `❌ @${sender.split('@')[0]} answered ${letterAnswer}`;
        await sock.sendMessage(remoteJid, { 
            text: feedbackMsg,
            mentions: [sender]
        });
    }
    
    // Save state
    saveQuizState();
    
    // If all users have answered, end the quiz early
    // (This logic can be adjusted depending on desired behavior)
    
    return true; // Successfully processed as a quiz answer
}

/**
 * Update user quiz statistics
 * @param {string} userId User ID
 * @param {boolean} correct Whether their answer was correct
 */
function updateUserStats(userId, correct) {
    // Initialize user stats if not exists
    if (!quizState.userStats[userId]) {
        quizState.userStats[userId] = {
            totalAnswered: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            streakCurrent: 0,
            streakBest: 0,
            lastQuizTimestamp: 0
        };
    }
    
    const stats = quizState.userStats[userId];
    stats.totalAnswered++;
    stats.lastQuizTimestamp = Date.now();
    
    if (correct) {
        stats.correctAnswers++;
        stats.streakCurrent++;
        stats.streakBest = Math.max(stats.streakBest, stats.streakCurrent);
    } else {
        stats.incorrectAnswers++;
        stats.streakCurrent = 0;
    }
    
    // Save state
    saveQuizState();
}

/**
 * Get quiz statistics for a user
 * @param {string} userId User ID
 * @returns {object} User quiz stats
 */
function getUserStats(userId) {
    return quizState.userStats[userId] || {
        totalAnswered: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        streakCurrent: 0,
        streakBest: 0,
        lastQuizTimestamp: 0
    };
}

/**
 * Get leaderboard for quiz performance
 * @param {number} limit Number of users to include
 * @returns {array} Array of user stats objects
 */
function getLeaderboard(limit = 10) {
    return Object.entries(quizState.userStats)
        .map(([userId, stats]) => ({
            userId,
            correctAnswers: stats.correctAnswers,
            totalAnswered: stats.totalAnswered,
            accuracy: stats.totalAnswered > 0 ? (stats.correctAnswers / stats.totalAnswered * 100).toFixed(1) : 0,
            streakBest: stats.streakBest
        }))
        .sort((a, b) => b.correctAnswers - a.correctAnswers)
        .slice(0, limit);
}

module.exports = {
    initialize,
    startQuiz,
    endQuiz,
    handleQuizAnswer,
    addQuizQuestion,
    getUserStats,
    getLeaderboard
};