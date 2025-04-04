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
    ]
};

module.exports = config;
