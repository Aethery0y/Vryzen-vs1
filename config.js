// Configuration settings for the WhatsApp bot
const config = {
    // API keys
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    
    // Database paths
    databaseDir: './data',
    contactsFile: './data/contacts.json',
    warningsFile: './data/warnings.json',
    settingsFile: './data/settings.json',
    
    // Bot settings
    botOwners: ['+918810502592'], // Owner number
    defaultPublicAccess: true, // Whether the bot is publicly accessible by default
    
    // Warning system
    maxWarnings: 3, // Number of warnings before a strike
    maxStrikes: 2,  // Number of strikes before a ban
    
    // Anime news settings
    animeNewsApiUrl: 'https://api.jikan.moe/v4/anime/seasons/now',
    animeNewsInterval: 10, // Minutes between news updates
    
    // Group management
    addContactsDelay: 60000, // Delay in ms between adding contacts (1 minute)
    contactBatchSize: 4,     // How many contacts to add at once
    
    // Bad words list for profanity filter
    badWords: [
        'mf', 'motherf', 'mothaf', 'f u', 'fu', 'bs', 'bitch', 'bastard', 'asshole', 
        'shit', 'fuck', 'dick', 'pussy', 'whore', 'slut'
    ]
};

module.exports = config;
