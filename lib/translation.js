/**
 * Enhanced translation module for WhatsApp bot
 */
const natural = require('natural');
const ai = require('./ai');
const database = require('./database');

// Create a language detection tokenizer
const { PorterStemmer } = natural;

// Language name mapping (ISO code to full name)
const languageMap = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'bn': 'Bengali',
    'ur': 'Urdu',
    'te': 'Telugu',
    'ta': 'Tamil',
    'mr': 'Marathi',
    'gu': 'Gujarati',
    'ml': 'Malayalam',
    'pa': 'Punjabi',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'sw': 'Swahili',
    'yo': 'Yoruba',
    'ig': 'Igbo',
    'ha': 'Hausa',
    'tr': 'Turkish',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'fi': 'Finnish',
    'da': 'Danish',
    'no': 'Norwegian',
    'pl': 'Polish',
    'hu': 'Hungarian',
    'cs': 'Czech',
    'sk': 'Slovak',
    'bg': 'Bulgarian',
    'uk': 'Ukrainian',
    'hr': 'Croatian',
    'sr': 'Serbian',
    'sl': 'Slovenian',
    'ro': 'Romanian',
    'he': 'Hebrew',
    'id': 'Indonesian',
    'ms': 'Malay',
    'fil': 'Filipino'
};

/**
 * Detect the most likely language of a text
 * 
 * @param {string} text - Text to analyze
 * @returns {string|null} - Detected language name or null if detection fails
 */
function detectLanguage(text) {
    try {
        // This is a simple implementation. For production, a more sophisticated
        // language detection library would be better.
        // For now, this uses basic patterns that work for demonstration
        
        // Set of common words by language
        const langPatterns = {
            'en': ['the', 'is', 'and', 'in', 'to', 'have', 'it', 'for', 'that', 'you'],
            'es': ['el', 'la', 'los', 'las', 'es', 'en', 'y', 'que', 'de', 'por', 'con'],
            'fr': ['le', 'la', 'les', 'est', 'et', 'en', 'que', 'un', 'dans', 'pour'],
            'de': ['der', 'die', 'das', 'ist', 'und', 'in', 'zu', 'den', 'mit', 'für'],
            'pt': ['o', 'a', 'os', 'as', 'é', 'em', 'que', 'um', 'para', 'com', 'se'],
            'it': ['il', 'la', 'i', 'le', 'è', 'e', 'che', 'di', 'in', 'per', 'con'],
            'hi': ['है', 'की', 'में', 'का', 'और', 'को', 'से', 'के', 'एक', 'पर', 'यह'],
            'zh': ['的', '是', '了', '在', '和', '有', '我', '这', '个', '你', '们'],
            'ja': ['は', 'の', 'に', 'を', 'た', 'が', 'で', 'て', 'と', 'も', 'です'],
            'ko': ['은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과']
        };
        
        // Tokenize and normalize text
        const lowerText = text.toLowerCase();
        const words = lowerText.match(/\b\w+\b/g) || [];
        
        // Count word frequency by language
        const scores = {};
        
        for (const [lang, patterns] of Object.entries(langPatterns)) {
            scores[lang] = 0;
            for (const word of words) {
                if (patterns.includes(word)) {
                    scores[lang]++;
                }
            }
            
            // Weight by total patterns
            scores[lang] = scores[lang] / patterns.length;
        }
        
        // Find language with highest score
        let bestLang = null;
        let bestScore = 0;
        
        for (const [lang, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestLang = lang;
            }
        }
        
        // If score is too low, we're not confident
        if (bestScore < 0.05) {
            // Try to detect specific character sets
            if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic
            if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
            if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Cyrillic (Russian)
            if (/[\u0E00-\u0E7F]/.test(text)) return 'th'; // Thai
            if (/[\u3040-\u309F]|[\u30A0-\u30FF]/.test(text)) return 'ja'; // Japanese
            if (/[\u1100-\u11FF]|[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
            if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'; // Chinese
            
            return null; // Could not detect confidently
        }
        
        return bestLang;
    } catch (error) {
        console.error('Error detecting language:', error);
        return null;
    }
}

/**
 * Translates text to the target language
 * 
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code or name
 * @returns {Promise<Object>} - Translation result
 */
async function translateText(text, targetLang) {
    try {
        if (!text || text.trim() === '') {
            return {
                success: false,
                message: "No text provided for translation."
            };
        }
        
        // Clean up target language
        let cleanTargetLang = targetLang.toLowerCase().trim();
        
        // Normalize language name if it's a code
        let displayLanguage = targetLang;
        if (languageMap[cleanTargetLang]) {
            displayLanguage = languageMap[cleanTargetLang];
        } else {
            // Try to find by name
            for (const [code, name] of Object.entries(languageMap)) {
                if (name.toLowerCase() === cleanTargetLang) {
                    cleanTargetLang = code;
                    displayLanguage = name;
                    break;
                }
            }
        }
        
        // Detect source language
        const detectedLangCode = detectLanguage(text);
        let detectedLang = 'unknown';
        
        if (detectedLangCode && languageMap[detectedLangCode]) {
            detectedLang = languageMap[detectedLangCode];
        }
        
        // Use Gemini AI for translation
        const translatePrompt = `Translate the following text from ${detectedLang} to ${displayLanguage}. 
Only return the translated text without any explanations, notes, or original text.

Text to translate:
${text}`;
        
        try {
            const translation = await ai.getResponse(translatePrompt);
            
            // Track this translation in history
            saveTranslationHistory(text, translation, detectedLangCode, cleanTargetLang);
            
            return { 
                success: true, 
                message: `*Translated from ${detectedLang} to ${displayLanguage}:*\n\n${translation}`,
                detectedLanguage: detectedLang,
                targetLanguage: displayLanguage,
                originalText: text,
                translatedText: translation
            };
        } catch (error) {
            console.error('Error getting AI translation:', error);
            return { 
                success: false, 
                message: "Failed to translate text. Please try again later." 
            };
        }
    } catch (error) {
        console.error('Error translating text:', error);
        return { 
            success: false, 
            message: "An error occurred during translation." 
        };
    }
}

/**
 * Save translation to history
 * 
 * @param {string} originalText - Original text
 * @param {string} translatedText - Translated text
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 */
function saveTranslationHistory(originalText, translatedText, sourceLanguage, targetLanguage) {
    try {
        // Get existing translation history
        let translationHistory = database.getData('translationHistory') || [];
        
        // Add new translation
        translationHistory.push({
            timestamp: Date.now(),
            originalText, 
            translatedText,
            sourceLanguage,
            targetLanguage
        });
        
        // Limit history size to 100 entries
        if (translationHistory.length > 100) {
            translationHistory = translationHistory.slice(-100);
        }
        
        // Save back to database
        database.saveData('translationHistory', translationHistory);
    } catch (error) {
        console.error('Error saving translation history:', error);
    }
}

/**
 * Get translation history
 * 
 * @param {number} limit - Maximum number of history entries to return
 * @returns {Array} - Translation history
 */
function getTranslationHistory(limit = 10) {
    try {
        const translationHistory = database.getData('translationHistory') || [];
        return translationHistory.slice(-limit);
    } catch (error) {
        console.error('Error getting translation history:', error);
        return [];
    }
}

/**
 * Get list of supported languages
 * 
 * @returns {Object} - Supported languages map
 */
function getSupportedLanguages() {
    return languageMap;
}

module.exports = {
    translateText,
    detectLanguage,
    getTranslationHistory,
    getSupportedLanguages
};