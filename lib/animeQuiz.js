/**
 * Anime Quiz Game Module
 * Provides anime-related quiz questions and manages game sessions
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const pointsSystem = require('./pointsSystem');

// File path for storing quiz data
const QUIZ_DATA_FILE = path.join(config.databaseDir, 'animeQuizData.json');

// Active quiz sessions
const activeQuizzes = new Map();

// Define difficulty levels
const DIFFICULTY = {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard',
    WEEB: 'weeb' // For the true otakus
};

// Quiz question categories
const CATEGORIES = {
    CHARACTERS: 'characters',
    SERIES: 'series',
    STUDIOS: 'studios',
    QUOTES: 'quotes',
    OPENINGS: 'openings',
    GENRES: 'genres',
    VOICE_ACTORS: 'voice_actors',
    MANGA: 'manga'
};

// Default quiz questions - these will be used if no saved questions exist
const DEFAULT_QUIZ_QUESTIONS = [
    // EASY difficulty
    {
        question: "Which anime features a boy who eats a Devil Fruit and becomes a rubber human?",
        options: ["One Piece", "Naruto", "Dragon Ball", "My Hero Academia"],
        answer: 0,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.EASY
    },
    {
        question: "In 'Attack on Titan', what are the giant humanoid creatures called?",
        options: ["Demons", "Hollows", "Titans", "Ghouls"],
        answer: 2,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.EASY
    },
    {
        question: "Which of these is NOT a Pokémon?",
        options: ["Pikachu", "Naruto", "Squirtle", "Jigglypuff"],
        answer: 1,
        category: CATEGORIES.CHARACTERS,
        difficulty: DIFFICULTY.EASY
    },
    {
        question: "Which anime features high school students with special abilities called 'Quirks'?",
        options: ["Dragon Ball Z", "One Punch Man", "My Hero Academia", "Hunter x Hunter"],
        answer: 2,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.EASY
    },
    {
        question: "What is the name of Monkey D. Luffy's pirate crew in 'One Piece'?",
        options: ["Red-Haired Pirates", "Heart Pirates", "Straw Hat Pirates", "Beast Pirates"],
        answer: 2,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.EASY
    },
    
    // MEDIUM difficulty
    {
        question: "Which studio produced 'Your Name' (Kimi no Na wa)?",
        options: ["Studio Ghibli", "CoMix Wave Films", "Kyoto Animation", "Madhouse"],
        answer: 1,
        category: CATEGORIES.STUDIOS,
        difficulty: DIFFICULTY.MEDIUM
    },
    {
        question: "In 'Death Note', what is the name of the Shinigami who drops the Death Note?",
        options: ["Rem", "Ryuk", "Sidoh", "Gelus"],
        answer: 1,
        category: CATEGORIES.CHARACTERS,
        difficulty: DIFFICULTY.MEDIUM
    },
    {
        question: "What is the power system called in 'Hunter x Hunter'?",
        options: ["Chakra", "Nen", "Quirk", "Jutsu"],
        answer: 1,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.MEDIUM
    },
    {
        question: "Which anime studio produced 'Demon Slayer' (Kimetsu no Yaiba)?",
        options: ["MAPPA", "Ufotable", "A-1 Pictures", "Bones"],
        answer: 1,
        category: CATEGORIES.STUDIOS,
        difficulty: DIFFICULTY.MEDIUM
    },
    {
        question: "Who is the creator of 'One Piece'?",
        options: ["Masashi Kishimoto", "Eiichiro Oda", "Tite Kubo", "Hiromu Arakawa"],
        answer: 1,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.MEDIUM
    },
    
    // HARD difficulty
    {
        question: "Which of these anime was NOT directed by Makoto Shinkai?",
        options: ["Your Name", "Weathering With You", "A Silent Voice", "5 Centimeters Per Second"],
        answer: 2,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.HARD
    },
    {
        question: "In 'Neon Genesis Evangelion', what is the name of the organization that operates the EVA units?",
        options: ["SEELE", "WILLE", "NERV", "GEHIRN"],
        answer: 2,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.HARD
    },
    {
        question: "Which manga artist created 'JoJo's Bizarre Adventure'?",
        options: ["Hirohiko Araki", "Kentaro Miura", "Junji Ito", "Naoki Urasawa"],
        answer: 0,
        category: CATEGORIES.MANGA,
        difficulty: DIFFICULTY.HARD
    },
    {
        question: "What is the real name of L in 'Death Note'?",
        options: ["L Lawliet", "Light Yagami", "Nate River", "Beyond Birthday"],
        answer: 0,
        category: CATEGORIES.CHARACTERS,
        difficulty: DIFFICULTY.HARD
    },
    {
        question: "Which anime features the character 'Johan Liebert' as its main antagonist?",
        options: ["Black Lagoon", "Psycho-Pass", "Monster", "Ergo Proxy"],
        answer: 2,
        category: CATEGORIES.CHARACTERS,
        difficulty: DIFFICULTY.HARD
    },
    
    // WEEB difficulty (for true fans)
    {
        question: "What was the first anime film to be nominated for an Academy Award for Best Animated Feature?",
        options: ["Princess Mononoke", "Spirited Away", "Your Name", "Akira"],
        answer: 1,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.WEEB
    },
    {
        question: "In 'Cowboy Bebop', what is the registration number of the Bebop ship?",
        options: ["BB-01", "BPP-9571", "MK-88", "CB-3738"],
        answer: 2,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.WEEB
    },
    {
        question: "Who provided the voice for Spike Spiegel in the original Japanese version of 'Cowboy Bebop'?",
        options: ["Koichi Yamadera", "Toru Furuya", "Kazuhiko Inoue", "Akira Kamiya"],
        answer: 0,
        category: CATEGORIES.VOICE_ACTORS,
        difficulty: DIFFICULTY.WEEB
    },
    {
        question: "Which Studio Ghibli film featured the song 'Country Road'?",
        options: ["Spirited Away", "Whisper of the Heart", "Princess Mononoke", "Kiki's Delivery Service"],
        answer: 1,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.WEEB
    },
    {
        question: "Which of these is NOT a work by Satoshi Kon?",
        options: ["Perfect Blue", "Paprika", "Tokyo Godfathers", "Ghost in the Shell"],
        answer: 3,
        category: CATEGORIES.SERIES,
        difficulty: DIFFICULTY.WEEB
    }
];

// Quiz database (will load from file if available)
let quizQuestions = [...DEFAULT_QUIZ_QUESTIONS];

/**
 * Initialize the anime quiz module
 */
function initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(config.databaseDir)) {
        fs.mkdirSync(config.databaseDir, { recursive: true });
    }
    
    // Load quiz questions from file if exists
    if (fs.existsSync(QUIZ_DATA_FILE)) {
        try {
            const loadedQuestions = JSON.parse(fs.readFileSync(QUIZ_DATA_FILE, 'utf8'));
            quizQuestions = loadedQuestions;
            console.log('Anime Quiz: Questions loaded successfully');
        } catch (error) {
            console.error('Anime Quiz: Error loading questions:', error);
            // Fallback to default questions
            quizQuestions = [...DEFAULT_QUIZ_QUESTIONS];
        }
    } else {
        // First time, save default questions
        saveQuizData();
        console.log('Anime Quiz: Created default questions');
    }
    
    return true;
}

/**
 * Save quiz data to file
 */
function saveQuizData() {
    try {
        fs.writeFileSync(QUIZ_DATA_FILE, JSON.stringify(quizQuestions, null, 2));
    } catch (error) {
        console.error('Anime Quiz: Error saving quiz data:', error);
    }
}

/**
 * Get a random quiz question, optionally filtered by difficulty or category
 * @param {string} difficulty - Optional difficulty level
 * @param {string} category - Optional category
 * @returns {object} - Quiz question object
 */
function getRandomQuestion(difficulty = null, category = null) {
    let filteredQuestions = [...quizQuestions];
    
    // Filter by difficulty if specified
    if (difficulty) {
        filteredQuestions = filteredQuestions.filter(q => q.difficulty === difficulty);
    }
    
    // Filter by category if specified
    if (category) {
        filteredQuestions = filteredQuestions.filter(q => q.category === category);
    }
    
    // If no questions match the criteria, return a random question from all questions
    if (filteredQuestions.length === 0) {
        return quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    }
    
    // Return a random question from the filtered list
    return filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
}

/**
 * Start a new quiz in a chat
 * @param {string} chatId - The chat ID
 * @param {string} difficulty - Optional difficulty level
 * @param {string} category - Optional category
 * @returns {object} - New quiz session information
 */
function startQuiz(chatId, difficulty = null, category = null) {
    // Check if there's already an active quiz in this chat
    if (activeQuizzes.has(chatId)) {
        return { 
            success: false, 
            error: 'There is already an active quiz in this chat. Answer it or wait for it to expire.'
        };
    }
    
    // Get a random question
    const question = getRandomQuestion(difficulty, category);
    
    // Create a new quiz session
    const quizSession = {
        question: question.question,
        options: question.options,
        correctAnswer: question.answer,
        category: question.category,
        difficulty: question.difficulty,
        startTime: Date.now(),
        endTime: Date.now() + (60 * 1000), // 1 minute to answer
        participants: new Set(),
        answered: false,
        winner: null
    };
    
    // Store the quiz session
    activeQuizzes.set(chatId, quizSession);
    
    // Set a timeout to end the quiz if no one answers
    setTimeout(() => {
        const session = activeQuizzes.get(chatId);
        if (session && !session.answered) {
            activeQuizzes.delete(chatId);
        }
    }, 60 * 1000);
    
    // Format options A, B, C, D
    const formattedOptions = question.options.map((option, index) => 
        `${String.fromCharCode(65 + index)}. ${option}`
    ).join('\n');
    
    return {
        success: true,
        question: question.question,
        options: formattedOptions,
        difficulty: question.difficulty,
        category: question.category,
        timeLimit: '60 seconds'
    };
}

/**
 * Answer a quiz question
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user ID
 * @param {string} answer - The answer (A, B, C, D or the option text)
 * @returns {object} - Result of the answer attempt
 */
function answerQuiz(chatId, userId, answer) {
    // Check if there's an active quiz in this chat
    if (!activeQuizzes.has(chatId)) {
        return { 
            success: false, 
            error: 'There is no active quiz in this chat. Start one with .animequiz'
        };
    }
    
    const quizSession = activeQuizzes.get(chatId);
    
    // Check if quiz is already answered
    if (quizSession.answered) {
        return { 
            success: false, 
            error: 'This quiz has already been answered. Start a new one with .animequiz'
        };
    }
    
    // Check if quiz has expired
    if (Date.now() > quizSession.endTime) {
        activeQuizzes.delete(chatId);
        return { 
            success: false, 
            error: 'This quiz has expired. Start a new one with .animequiz'
        };
    }
    
    // Add user to participants
    quizSession.participants.add(userId);
    
    // Process the answer (convert A,B,C,D to index)
    let answerIndex = -1;
    
    if (answer.length === 1 && answer.match(/[A-D]/i)) {
        // Convert A,B,C,D to 0,1,2,3
        answerIndex = answer.toUpperCase().charCodeAt(0) - 65;
    } else {
        // Try to match the answer text
        answerIndex = quizSession.options.findIndex(
            option => option.toLowerCase() === answer.toLowerCase()
        );
    }
    
    // Check if answer is correct
    const isCorrect = answerIndex === quizSession.correctAnswer;
    
    // Award points for participation regardless of correctness
    const cleanUserId = userId.split('@')[0];
    pointsSystem.awardPoints(cleanUserId, 'ANIME_QUIZ_PARTICIPATION', chatId);
    
    if (isCorrect) {
        // Mark quiz as answered
        quizSession.answered = true;
        quizSession.winner = userId;
        
        // Award points for correct answer
        pointsSystem.awardPoints(cleanUserId, 'ANIME_QUIZ_CORRECT', chatId);
        
        // Remove quiz session after correct answer
        activeQuizzes.delete(chatId);
        
        return {
            success: true,
            correct: true,
            answeredBy: cleanUserId,
            correctAnswer: quizSession.options[quizSession.correctAnswer],
            pointsAwarded: pointsSystem.POINT_VALUES.ANIME_QUIZ_CORRECT
        };
    } else {
        // Incorrect answer
        return {
            success: true,
            correct: false,
            message: "That's not the right answer. Try again!"
        };
    }
}

/**
 * End an active quiz without answer
 * @param {string} chatId - The chat ID
 * @returns {object} - Result of ending the quiz
 */
function endQuiz(chatId) {
    // Check if there's an active quiz in this chat
    if (!activeQuizzes.has(chatId)) {
        return { 
            success: false, 
            error: 'There is no active quiz in this chat to end.'
        };
    }
    
    const quizSession = activeQuizzes.get(chatId);
    const correctAnswer = quizSession.options[quizSession.correctAnswer];
    
    // Remove quiz session
    activeQuizzes.delete(chatId);
    
    return {
        success: true,
        correctAnswer: correctAnswer,
        participants: Array.from(quizSession.participants).length
    };
}

/**
 * Add a new question to the quiz database
 * @param {object} questionData - The new question data
 * @returns {object} - Result of adding the question
 */
function addQuestion(questionData) {
    // Validate question data
    if (!questionData.question || !questionData.options || !Array.isArray(questionData.options) ||
        questionData.options.length < 2 || questionData.answer === undefined) {
        return {
            success: false,
            error: 'Invalid question format. Need question, options array, and answer index.'
        };
    }
    
    // Add default values if not provided
    const newQuestion = {
        question: questionData.question,
        options: questionData.options,
        answer: questionData.answer,
        category: questionData.category || CATEGORIES.SERIES,
        difficulty: questionData.difficulty || DIFFICULTY.MEDIUM
    };
    
    // Add to questions array
    quizQuestions.push(newQuestion);
    
    // Save to file
    saveQuizData();
    
    return {
        success: true,
        questionCount: quizQuestions.length
    };
}

/**
 * Get quiz statistics
 * @returns {object} - Quiz statistics
 */
function getQuizStats() {
    // Count questions by difficulty
    const difficultyStats = {};
    Object.values(DIFFICULTY).forEach(diff => {
        difficultyStats[diff] = quizQuestions.filter(q => q.difficulty === diff).length;
    });
    
    // Count questions by category
    const categoryStats = {};
    Object.values(CATEGORIES).forEach(cat => {
        categoryStats[cat] = quizQuestions.filter(q => q.category === cat).length;
    });
    
    return {
        totalQuestions: quizQuestions.length,
        byDifficulty: difficultyStats,
        byCategory: categoryStats
    };
}

module.exports = {
    initialize,
    startQuiz,
    answerQuiz,
    endQuiz,
    addQuestion,
    getQuizStats,
    DIFFICULTY,
    CATEGORIES
};