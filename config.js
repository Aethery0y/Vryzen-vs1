// Configuration settings for the WhatsApp bot
const config = {
    // API keys
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    
    // Database paths
    databaseDir: './data',
    contactsFile: './data/contacts.json',
    warningsFile: './data/warnings.json',
    settingsFile: './data/settings.json',
    animeQuizFile: './data/animeQuiz.json',
    animeCardsFile: './data/animeCards.json',
    
    // Bot settings
    botOwners: ['+918810502592', '+918920659106'], // Owner numbers
    botAdmins: ['+918810502592', '+918920659106'], // Admin numbers (includes owners by default)
    defaultPublicAccess: true, // Whether the bot is publicly accessible by default
    
    // Message handling settings
    messageHandling: {
        // Ability to force the bot to treat all replies as replies to the bot (useful for debugging)
        forceReplyDetection: true,
        // Keywords that trigger the bot's attention when included in a message
        triggerKeywords: ['bot', 'assistant', 'help'],
        // Only respond to messages when explicitly mentioned (reply or mention)
        strictResponseMode: true
    },
    
    // Warning system
    maxWarnings: 3, // Number of warnings before a strike
    maxStrikes: 2,  // Number of strikes before a ban
    
    // Anime news settings
    animeNewsApiUrl: 'https://api.jikan.moe/v4/anime?status=airing&sfw=true&limit=20',
    animeNewsInterval: 10, // Minutes between news updates
    
    // Group management
    addContactsDelay: 60000, // Delay in ms between adding contacts (1 minute)
    contactBatchSize: 4,     // How many contacts to add at once
    
    // Bad words list for profanity filter
    badWords: [
        'mf', 'motherf', 'mothaf', 'f u', 'fu', 'bs', 'bitch', 'bastard', 'asshole', 
        'shit', 'fuck', 'dick', 'pussy', 'whore', 'slut'
    ],
    
    // Anime game settings
    animeGames: {
        // Points system settings
        points: {
            dailyBonus: 50,
            messagePoints: 2,
            quizPoints: 25,
            cardRarityPoints: {
                common: 10,
                uncommon: 20,
                rare: 40,
                epic: 80,
                legendary: 150
            },
            maxPointsPerDay: 300
        },
        
        // Quiz settings
        quiz: {
            questionInterval: 30, // Minutes between quiz questions in a group
            timeToAnswer: 60, // Seconds to answer a quiz question
            maxQuestionsPerDay: 20
        },
        
        // Card game settings
        cards: {
            dailyFreeCards: 3,
            cardGachaInterval: 6, // Hours between free card gacha
            tradeRatio: 3, // Number of lower tier cards needed to trade up
            maxInventorySize: 100 // Max cards in inventory
        }
    }
};

module.exports = config;
