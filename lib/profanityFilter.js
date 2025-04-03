const natural = require('natural');
const database = require('./database');
const config = require('../config');

// Create tokenizer for splitting text
const tokenizer = new natural.WordTokenizer();

/**
 * Check if a message contains profanity
 * 
 * @param {string} message - Message to check
 * @param {string} sender - Sender's number
 * @returns {Object} Result with profanity status and warning message
 */
async function checkMessage(message, sender) {
    // Normalize the sender number
    const normalizedSender = database.normalizeNumber(sender);
    
    // Get user warnings
    const userWarnings = database.getWarnings(normalizedSender);
    
    // Check if user is banned
    if (userWarnings.banned) {
        return {
            hasProfanity: true,
            warningMessage: '⛔ You are banned from using this bot due to multiple violations of our profanity policy.'
        };
    }
    
    // Normalize message for checking
    const normalizedMessage = message.toLowerCase();
    
    // Tokenize message into words
    const words = tokenizer.tokenize(normalizedMessage);
    
    // Check for bad words
    const foundBadWords = [];
    
    // Direct bad word check
    for (const badWord of config.badWords) {
        if (normalizedMessage.includes(badWord)) {
            foundBadWords.push(badWord);
        }
    }
    
    // Check if any bad words were found
    if (foundBadWords.length > 0) {
        // Add warning to user
        const updatedWarnings = database.addWarning(normalizedSender);
        
        // Create appropriate warning message
        let warningMessage = '';
        
        if (updatedWarnings.banned) {
            warningMessage = `⛔ *BANNED*: You have been banned from using this bot due to multiple violations of our profanity policy.`;
        } else if (updatedWarnings.strikes > 0) {
            warningMessage = `⚠️ *WARNING*: Please refrain from using inappropriate language.\n` +
                             `Strike ${updatedWarnings.strikes}/${config.maxStrikes} issued. ` +
                             `Warning ${updatedWarnings.warnings}/${config.maxWarnings}.`;
        } else {
            warningMessage = `⚠️ *WARNING*: Please refrain from using inappropriate language.\n` +
                             `Warning ${updatedWarnings.warnings}/${config.maxWarnings} issued.`;
        }
        
        return {
            hasProfanity: true,
            warningMessage
        };
    }
    
    // No profanity found
    return {
        hasProfanity: false,
        warningMessage: ''
    };
}

module.exports = {
    checkMessage
};
