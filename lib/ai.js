const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
// Use the correct model name for Gemini (use current supported models)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const modelFallback = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Canned responses for common questions to reduce API load 
// (Removed introduction message and simplified responses)
const CANNED_RESPONSES = {
  "what can you do": "I can answer questions, provide information, create stickers from images, and help with group management. Try commands like .help, .sticker, or .card draw.",
  "how are you": "I'm doing well, thank you for asking! How can I help you?",
  "what is your name": "You can call me Bot.",
  "hi there": "Hello! How can I help you?",
  "good morning": "Good morning! How can I help?",
  "good afternoon": "Good afternoon! What can I do for you?",
  "good evening": "Good evening! How can I assist?",
  "good night": "Good night!",
  "help me": "What do you need help with? Type .help to see all available commands."
};

// Rate limiting variables
const requestQueue = [];
let isProcessing = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 10000; // 10 seconds between requests

/**
 * Process raw AI responses to remove bot self-introductions
 * 
 * @param {string} response - The raw response from the AI
 * @returns {string} - The processed response
 */
function processResponse(response) {
    if (!response) return response;
    
    // Remove common introduction patterns
    const introPatterns = [
        /^(As a|I'm a|I am a).*?(AI|assistant|bot|WhatsApp bot|language model).*?\./i,
        /^(Hello|Hi).*?(I'm|I am).*?(AI|assistant|bot|WhatsApp bot|language model).*?\./i,
        /^(I'm|I am).*?(happy to help|here to help|here to assist).*?\./i
    ];
    
    let processedResponse = response;
    
    // Remove introduction phrases
    for (const pattern of introPatterns) {
        processedResponse = processedResponse.replace(pattern, '');
    }
    
    // Trim any extra whitespace and ensure the response starts with a capital letter
    processedResponse = processedResponse.trim();
    if (processedResponse.length > 0) {
        processedResponse = processedResponse.charAt(0).toUpperCase() + processedResponse.slice(1);
    }
    
    // Log if changes were made
    if (processedResponse !== response) {
        console.log('Cleaned AI response to remove self-introduction');
    }
    
    return processedResponse;
}

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
        
        // Only check for very specific partial matches with high relevance
        // (Much more restrictive to avoid inappropriate canned responses)
        for (const key in CANNED_RESPONSES) {
            // Only match if the message is very similar to the key
            // The message must contain the entire key, not just part of it
            if (lowerMessage === key || 
                (lowerMessage.includes(key) && lowerMessage.length <= key.length + 5)) {
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
                // But include system instructions to prevent bot self-identification
                const systemInstruction = "Answer the following question directly and to the point. Don't introduce yourself or say you're a bot.";
                result = await chatModel.generateContent([
                    { role: "system", parts: [{ text: systemInstruction }] },
                    { role: "user", parts: [{ text: message }] }
                ], {
                    generationConfig: {
                        maxOutputTokens: 1000, // Increased token limit for more detailed responses
                        temperature: 0.8,
                        topP: 0.95,
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
                        maxOutputTokens: 1000, // Increased token limit for more detailed responses
                        temperature: 0.8,
                        topP: 0.95,
                        topK: 40,
                    },
                    // Add system instructions to improve responses and prevent self-identification
                    systemInstruction: {
                        role: "system",
                        parts: [{
                            text: "You are a helpful WhatsApp assistant. Provide conversational, human-like responses that feel natural and engaging. Use casual language, occasional emojis, and varying sentence structures. Include some short sentences and conversational phrases like 'yeah', 'hmm', 'honestly', etc. Never introduce yourself as a bot or AI. Never mention being a WhatsApp bot. Focus on delivering valuable information while sounding like a real person texting."
                        }]
                    }
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
            
            // Get the raw response
            let response = result.response.text();
            
            // Process the response to remove any bot introductions
            response = processResponse(response);
            
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
