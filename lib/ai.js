const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
// Use the correct model name for Gemini (use current supported models)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const modelFallback = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Canned responses for common questions to reduce API load
const CANNED_RESPONSES = {
  "who are you": "I'm a WhatsApp bot assistant powered by AI. I can help answer questions, provide information, and assist with various tasks.",
  "what can you do": "I can answer questions, provide information, create stickers from images, share anime news, and help with group management. Try commands like .help, .sticker, or .animenews.",
  "how are you": "I'm functioning well, thank you for asking! How can I assist you today?",
  "what is your name": "I'm your AI WhatsApp assistant. You can call me Bot.",
  "hi there": "Hello! How can I help you today?",
  "good morning": "Good morning! How can I assist you today?",
  "good afternoon": "Good afternoon! How can I help you today?",
  "good evening": "Good evening! How can I assist you today?",
  "good night": "Good night! Feel free to message again when you need assistance.",
  "help me": "I'd be happy to help! What do you need assistance with? Or type .help to see all available commands."
};

// Rate limiting variables
const requestQueue = [];
let isProcessing = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 10000; // 10 seconds between requests

/**
 * Sleep for a specified duration
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process the queue of pending AI requests
 */
async function processQueue() {
    if (isProcessing || requestQueue.length === 0) return;
    
    isProcessing = true;
    
    try {
        // Rate limiting - ensure requests are spaced
        const now = Date.now();
        const timeElapsed = now - lastRequestTime;
        
        if (timeElapsed < MIN_REQUEST_INTERVAL) {
            await sleep(MIN_REQUEST_INTERVAL - timeElapsed);
        }
        
        const { message, context, resolve, reject } = requestQueue.shift();
        
        try {
            const response = await generateAIResponse(message, context);
            resolve(response);
        } catch (error) {
            reject(error);
        }
        
        lastRequestTime = Date.now();
    } catch (error) {
        console.error('Error processing queue:', error);
    } finally {
        isProcessing = false;
        // Process next item in queue if there are any
        if (requestQueue.length > 0) {
            processQueue();
        }
    }
}

/**
 * Actual function to generate AI response, with retries
 * 
 * @param {string} message - User message
 * @param {Array} context - Conversation context
 * @returns {Promise<string>} AI response
 */
async function generateAIResponse(message, context = []) {
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    // Check for canned responses to avoid API calls
    if (typeof message === 'string') {
        const lowerMessage = message.toLowerCase().trim();
        
        // Check for exact match canned responses
        if (CANNED_RESPONSES[lowerMessage]) {
            console.log('Using canned response for:', lowerMessage);
            return CANNED_RESPONSES[lowerMessage];
        }
        
        // Quick responses for basic messages without using the API
        if (lowerMessage === 'hi' || lowerMessage === 'hello' || lowerMessage === 'hey') {
            return "Hello! How can I help you today?";
        }
        
        if (lowerMessage === 'thanks' || lowerMessage === 'thank you' || lowerMessage === 'thx') {
            return "You're welcome! Let me know if you need anything else.";
        }
        
        // Check for partial matches in canned responses
        for (const key in CANNED_RESPONSES) {
            if (lowerMessage.includes(key) || key.includes(lowerMessage)) {
                console.log('Using partial match canned response for:', lowerMessage);
                return CANNED_RESPONSES[key];
            }
        }
    }
    
    while (attempts < maxAttempts) {
        try {
            // Exponential backoff for retries
            if (attempts > 0) {
                const backoffTime = Math.pow(2, attempts) * 1000;
                console.log(`Retrying AI request in ${backoffTime/1000} seconds (attempt ${attempts+1}/${maxAttempts})...`);
                await sleep(backoffTime);
            }
            
            // Use fallback model if initial attempt failed
            const chatModel = attempts === 0 ? model : modelFallback;
            let result;
            
            // If first attempt failed, use a simpler approach
            if (attempts > 0) {
                // For fallback attempt, don't use chat history - just direct generation
                result = await chatModel.generateContent(message, {
                    generationConfig: {
                        maxOutputTokens: 600,
                        temperature: 0.7,
                        topP: 0.9,
                        topK: 40,
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                });
            } else {
                // Create chat session with history for first attempt
                const chat = chatModel.startChat({
                    history: context.length > 0 ? context : [],
                    generationConfig: {
                        maxOutputTokens: 600, // Further reduced tokens for quota management
                        temperature: 0.7,
                        topP: 0.9,
                        topK: 40,
                    },
                });
                
                // Generate response with chat context - text only
                result = await chat.sendMessage(message, {
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                });
            }
            
            const response = result.response.text();
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`AI request attempt ${attempts+1} failed:`, error.message);
            attempts++;
            
            // If it's not a rate limit error, don't retry with the same approach
            if (error.status !== 429) {
                console.log('Non-rate-limit error. Trying alternative approach.');
            }
        }
    }
    
    // After all attempts fail, throw the last error
    console.error('All AI request attempts failed:', lastError);
    throw new Error('Failed to get response from AI after multiple attempts');
}

/**
 * Gets a response from the Gemini API with rate limiting
 * 
 * @param {string} message - The message from the user
 * @param {Array} context - Previous messages for context
 * @returns {Promise<string>} - The AI response
 */
async function getResponse(message, context = []) {
    try {
        // Queue the request and return a promise
        return new Promise((resolve, reject) => {
            requestQueue.push({ message, context, resolve, reject });
            processQueue(); // Start processing if not already
        });
    } catch (error) {
        console.error('Error getting response from Gemini API:', error);
        throw new Error('Failed to get response from AI');
    }
}

module.exports = {
    getResponse
};
