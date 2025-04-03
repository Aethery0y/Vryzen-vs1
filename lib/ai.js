const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
// Use the correct model name for Gemini
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

/**
 * Gets a response from the Gemini API
 * 
 * @param {string} message - The message from the user
 * @param {Array} context - Previous messages for context
 * @returns {Promise<string>} - The AI response
 */
async function getResponse(message, context = []) {
    try {
        // Create chat session with history if available
        const chat = model.startChat({
            history: context.length > 0 ? context : [],
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
            },
        });

        // Generate response
        const result = await chat.sendMessage(message);
        const response = result.response.text();
        
        return response;
    } catch (error) {
        console.error('Error getting response from Gemini API:', error);
        throw new Error('Failed to get response from AI');
    }
}

module.exports = {
    getResponse
};
