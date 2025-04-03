/**
 * Smart auto-reply module for WhatsApp bot
 */
const natural = require('natural');
const database = require('./database');
const contacts = require('./contacts');
const ai = require('./ai');

// Initialize tokenizer for text analysis
const tokenizer = new natural.WordTokenizer();

/**
 * Create a new auto-reply rule
 * 
 * @param {Object} rule - Auto-reply rule configuration
 * @param {string} rule.pattern - Text pattern to match (can include wildcards with *)
 * @param {string} rule.response - Response message
 * @param {string} rule.scope - Rule scope ('global', 'group', 'private')
 * @param {string} rule.groupId - Group ID if scope is 'group'
 * @param {boolean} rule.regex - Whether pattern is regex
 * @param {boolean} rule.exact - Whether pattern requires exact match
 * @param {boolean} rule.caseSensitive - Whether pattern is case-sensitive
 * @returns {Object} Result with created rule
 */
function createRule(rule) {
    try {
        if (!rule.pattern || !rule.response) {
            return {
                success: false,
                message: "Pattern and response are required."
            };
        }
        
        // Get existing rules
        const rules = database.getData('autoReplyRules') || [];
        
        // Create new rule with defaults
        const newRule = {
            id: Date.now(),
            pattern: rule.pattern,
            response: rule.response,
            scope: rule.scope || 'global',
            groupId: rule.groupId || null,
            regex: rule.regex || false,
            exact: rule.exact || false,
            caseSensitive: rule.caseSensitive || false,
            created: Date.now(),
            hits: 0,
            enabled: true
        };
        
        // Add to rules list
        rules.push(newRule);
        
        // Save rules
        database.saveData('autoReplyRules', rules);
        
        return {
            success: true,
            message: "Auto-reply rule created successfully.",
            rule: newRule
        };
    } catch (error) {
        console.error('Error creating auto-reply rule:', error);
        return {
            success: false,
            message: "Failed to create auto-reply rule."
        };
    }
}

/**
 * Delete an auto-reply rule
 * 
 * @param {number} ruleId - Rule ID to delete
 * @returns {Object} Result
 */
function deleteRule(ruleId) {
    try {
        // Get existing rules
        let rules = database.getData('autoReplyRules') || [];
        
        // Find rule index
        const index = rules.findIndex(r => r.id === parseInt(ruleId));
        
        if (index === -1) {
            return {
                success: false,
                message: "Rule not found."
            };
        }
        
        // Remove rule
        rules.splice(index, 1);
        
        // Save rules
        database.saveData('autoReplyRules', rules);
        
        return {
            success: true,
            message: "Auto-reply rule deleted successfully."
        };
    } catch (error) {
        console.error('Error deleting auto-reply rule:', error);
        return {
            success: false,
            message: "Failed to delete auto-reply rule."
        };
    }
}

/**
 * Enable or disable an auto-reply rule
 * 
 * @param {number} ruleId - Rule ID to update
 * @param {boolean} enabled - Whether rule should be enabled
 * @returns {Object} Result
 */
function toggleRule(ruleId, enabled) {
    try {
        // Get existing rules
        let rules = database.getData('autoReplyRules') || [];
        
        // Find rule index
        const index = rules.findIndex(r => r.id === parseInt(ruleId));
        
        if (index === -1) {
            return {
                success: false,
                message: "Rule not found."
            };
        }
        
        // Update rule
        rules[index].enabled = enabled;
        
        // Save rules
        database.saveData('autoReplyRules', rules);
        
        return {
            success: true,
            message: `Auto-reply rule ${enabled ? 'enabled' : 'disabled'} successfully.`
        };
    } catch (error) {
        console.error('Error toggling auto-reply rule:', error);
        return {
            success: false,
            message: "Failed to update auto-reply rule."
        };
    }
}

/**
 * List all auto-reply rules
 * 
 * @param {Object} filters - Optional filters
 * @param {string} filters.scope - Filter by scope
 * @param {string} filters.groupId - Filter by group ID
 * @returns {Object} Result with rules list
 */
function listRules(filters = {}) {
    try {
        // Get existing rules
        const rules = database.getData('autoReplyRules') || [];
        
        // Apply filters
        let filteredRules = [...rules];
        
        if (filters.scope) {
            filteredRules = filteredRules.filter(r => r.scope === filters.scope);
        }
        
        if (filters.groupId) {
            filteredRules = filteredRules.filter(r => r.groupId === filters.groupId);
        }
        
        return {
            success: true,
            count: filteredRules.length,
            rules: filteredRules
        };
    } catch (error) {
        console.error('Error listing auto-reply rules:', error);
        return {
            success: false,
            message: "Failed to list auto-reply rules."
        };
    }
}

/**
 * Process message for auto-reply
 * 
 * @param {Object} messageContext - Message context
 * @param {string} messageContext.text - Message text
 * @param {boolean} messageContext.isGroup - Whether message is in a group
 * @param {string} messageContext.groupId - Group ID if in a group
 * @param {string} messageContext.sender - Sender ID
 * @returns {Object} Result with matched reply if any
 */
function processMessage(messageContext) {
    try {
        const { text, isGroup, groupId, sender } = messageContext;
        
        if (!text || text.trim() === '') {
            return { match: false };
        }
        
        // Get rules
        const rules = database.getData('autoReplyRules') || [];
        
        // Filter to enabled rules that match this context
        const applicableRules = rules.filter(rule => {
            // Skip disabled rules
            if (!rule.enabled) {
                return false;
            }
            
            // Check scope
            if (rule.scope === 'group' && (!isGroup || rule.groupId !== groupId)) {
                return false;
            }
            
            if (rule.scope === 'private' && isGroup) {
                return false;
            }
            
            return true;
        });
        
        // Try to match rules
        for (const rule of applicableRules) {
            let matches = false;
            
            if (rule.regex) {
                // Regular expression matching
                try {
                    const flags = rule.caseSensitive ? '' : 'i';
                    const regex = new RegExp(rule.pattern, flags);
                    matches = regex.test(text);
                } catch (e) {
                    console.error('Invalid regex pattern:', rule.pattern, e);
                    // Skip this rule
                    continue;
                }
            } else if (rule.exact) {
                // Exact matching
                matches = rule.caseSensitive 
                    ? text === rule.pattern
                    : text.toLowerCase() === rule.pattern.toLowerCase();
            } else {
                // Basic wildcard matching
                const pattern = rule.pattern
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                try {
                    const flags = rule.caseSensitive ? '' : 'i';
                    const regex = new RegExp(`^${pattern}$`, flags);
                    matches = regex.test(text);
                } catch (e) {
                    console.error('Invalid wildcard pattern:', rule.pattern, e);
                    // Try simple includes matching instead
                    matches = rule.caseSensitive
                        ? text.includes(rule.pattern)
                        : text.toLowerCase().includes(rule.pattern.toLowerCase());
                }
            }
            
            if (matches) {
                // Update hit count
                rule.hits++;
                database.saveData('autoReplyRules', rules);
                
                // Return the matched rule's response
                return {
                    match: true,
                    rule,
                    response: processResponse(rule.response, { text, sender, isGroup, groupId })
                };
            }
        }
        
        // No matches found
        return { match: false };
    } catch (error) {
        console.error('Error processing message for auto-reply:', error);
        return { match: false };
    }
}

/**
 * Process response template with variables
 * 
 * @param {string} template - Response template
 * @param {Object} context - Message context
 * @returns {string} Processed response
 */
function processResponse(template, context) {
    try {
        let response = template;
        
        // Basic variable replacements
        response = response.replace(/\{sender\}/g, context.sender.split('@')[0]);
        response = response.replace(/\{message\}/g, context.text);
        response = response.replace(/\{time\}/g, new Date().toLocaleTimeString());
        response = response.replace(/\{date\}/g, new Date().toLocaleDateString());
        
        // More complex replacements could be added here
        
        return response;
    } catch (error) {
        console.error('Error processing response template:', error);
        return template; // Return original if error
    }
}

/**
 * Create an AI-generated auto-reply rule based on example data
 * 
 * @param {Object} options - Rule generation options
 * @param {Array} options.examples - Array of example messages and responses
 * @param {string} options.scope - Rule scope ('global', 'group', 'private')
 * @param {string} options.groupId - Group ID if scope is 'group'
 * @returns {Promise<Object>} Result with created rule
 */
async function generateRule(options) {
    try {
        const { examples, scope, groupId } = options;
        
        if (!examples || examples.length < 1) {
            return {
                success: false,
                message: "At least one example message and response is required."
            };
        }
        
        // Format examples for AI
        const examplesText = examples.map((ex, i) => 
            `Example ${i+1}:\nMessage: "${ex.message}"\nResponse: "${ex.response}"`
        ).join('\n\n');
        
        // Create AI prompt
        const prompt = `Analyze these examples of message patterns and responses:

${examplesText}

Create a pattern that would match the example messages. The pattern can use:
- * for wildcard matching
- ? for single character matching
- Standard regex syntax if that would be better

Return ONLY a JSON object with these fields:
- pattern: The pattern to match messages
- response: The response template
- regex: true if using regex, false if using wildcards
- exact: true if exact match is needed
- caseSensitive: whether the pattern is case-sensitive

The response can include variables like {sender}, {message}, {time}.
Only return the JSON object, nothing else.`;
        
        // Get AI response
        const aiResponse = await ai.getResponse(prompt);
        
        let ruleData;
        try {
            // Parse JSON from AI response
            ruleData = JSON.parse(aiResponse);
        } catch (error) {
            console.error('Error parsing AI rule response:', error);
            // Try to extract JSON using regex
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    ruleData = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    return {
                        success: false,
                        message: "Failed to generate a valid rule pattern. Try providing different examples."
                    };
                }
            } else {
                return {
                    success: false,
                    message: "Failed to generate a valid rule pattern. Try providing different examples."
                };
            }
        }
        
        // Validate required fields
        if (!ruleData || !ruleData.pattern || !ruleData.response) {
            return {
                success: false,
                message: "AI generated an incomplete rule. Try providing clearer examples."
            };
        }
        
        // Create the rule
        return createRule({
            pattern: ruleData.pattern,
            response: ruleData.response,
            scope: scope || 'global',
            groupId: groupId || null,
            regex: ruleData.regex || false,
            exact: ruleData.exact || false,
            caseSensitive: ruleData.caseSensitive || false
        });
    } catch (error) {
        console.error('Error generating auto-reply rule:', error);
        return {
            success: false,
            message: "Failed to generate auto-reply rule."
        };
    }
}

module.exports = {
    createRule,
    deleteRule,
    toggleRule,
    listRules,
    processMessage,
    generateRule
};