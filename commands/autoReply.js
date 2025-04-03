/**
 * Auto-reply commands for WhatsApp bot
 */
const autoReplyLib = require('../lib/autoReply');
const database = require('../lib/database');
const { generateText } = require('../lib/ai');

/**
 * Create a new auto-reply rule
 */
async function createAutoReply(sock, message, args) {
    const { remoteJid, sender, isGroup } = message;
    
    // Format: .autoreply2 pattern => response [opts]
    const fullText = Array.isArray(args) ? args.join(' ') : args;
    const parts = fullText.split('=>').map(part => part.trim());
    
    if (parts.length < 2) {
        return { 
            success: false, 
            message: '⚠️ Usage: .autoreply2 pattern => response [options]\n\n' +
                     'Options (optional):\n' +
                     '- scope:global/group/private\n' +
                     '- regex:true/false\n' +
                     '- case:true/false\n' +
                     '- exact:true/false'
        };
    }
    
    const pattern = parts[0];
    const responseWithOptions = parts[1];
    
    // Extract options if available
    const responseOptionParts = responseWithOptions.split(/\s+(?=[a-zA-Z]+:)/);
    const response = responseOptionParts[0].trim();
    
    // Parse options
    const options = {};
    
    for (let i = 1; i < responseOptionParts.length; i++) {
        const optPart = responseOptionParts[i].trim();
        const [optName, optValue] = optPart.split(':');
        
        if (optName && optValue) {
            if (optName === 'scope') {
                options.scope = optValue;
            } else if (optName === 'regex') {
                options.regex = optValue.toLowerCase() === 'true';
            } else if (optName === 'case') {
                options.caseSensitive = optValue.toLowerCase() === 'true';
            } else if (optName === 'exact') {
                options.exact = optValue.toLowerCase() === 'true';
            }
        }
    }
    
    // Set default scope based on context
    if (!options.scope) {
        options.scope = isGroup ? 'group' : 'private';
    }
    
    // Set group ID if scope is group
    if (options.scope === 'group' && isGroup) {
        options.groupId = remoteJid;
    }
    
    try {
        // Create the rule
        const ruleData = {
            pattern,
            response,
            scope: options.scope || 'group',
            groupId: options.groupId,
            regex: options.regex || false,
            exact: options.exact || false,
            caseSensitive: options.caseSensitive || false,
            createdBy: sender,
            createdAt: new Date().toISOString()
        };
        
        const result = autoReplyLib.createRule(ruleData);
        
        if (result.success) {
            return { 
                success: true, 
                message: `✅ Auto-reply rule created (ID: ${result.rule.id})\n\n` +
                         `Pattern: ${pattern}\n` +
                         `Response: ${response}\n` +
                         `Scope: ${options.scope || 'group'}\n` +
                         `RegEx: ${options.regex ? 'Yes' : 'No'}\n` +
                         `Case-sensitive: ${options.caseSensitive ? 'Yes' : 'No'}\n` +
                         `Exact match: ${options.exact ? 'Yes' : 'No'}`
            };
        } else {
            return { success: false, message: `⚠️ ${result.message}` };
        }
    } catch (error) {
        console.error('Error creating auto-reply rule:', error);
        return { success: false, message: `⚠️ Error: ${error.message}` };
    }
}

/**
 * Delete an auto-reply rule
 */
async function deleteAutoReply(sock, message, args) {
    const { remoteJid, sender } = message;
    
    if (args.length < 1) {
        return { success: false, message: '⚠️ Usage: .delautoreply <rule_id>' };
    }
    
    const ruleId = parseInt(args[0]);
    
    if (isNaN(ruleId)) {
        return { success: false, message: '⚠️ Invalid rule ID. Must be a number.' };
    }
    
    try {
        const result = autoReplyLib.deleteRule(ruleId);
        
        if (result.success) {
            return { success: true, message: `✅ Auto-reply rule #${ruleId} deleted successfully.` };
        } else {
            return { success: false, message: `⚠️ ${result.message}` };
        }
    } catch (error) {
        console.error('Error deleting auto-reply rule:', error);
        return { success: false, message: `⚠️ Error: ${error.message}` };
    }
}

/**
 * Enable or disable an auto-reply rule
 */
async function toggleAutoReply(sock, message, args) {
    const { remoteJid, sender } = message;
    
    if (args.length < 2) {
        return { success: false, message: '⚠️ Usage: .togglereply <rule_id> <true/false>' };
    }
    
    const ruleId = parseInt(args[0]);
    const enabled = args[1].toLowerCase() === 'true';
    
    if (isNaN(ruleId)) {
        return { success: false, message: '⚠️ Invalid rule ID. Must be a number.' };
    }
    
    try {
        const result = autoReplyLib.toggleRule(ruleId, enabled);
        
        if (result.success) {
            return { 
                success: true, 
                message: `✅ Auto-reply rule #${ruleId} ${enabled ? 'enabled' : 'disabled'} successfully.` 
            };
        } else {
            return { success: false, message: `⚠️ ${result.message}` };
        }
    } catch (error) {
        console.error('Error toggling auto-reply rule:', error);
        return { success: false, message: `⚠️ Error: ${error.message}` };
    }
}

/**
 * List auto-reply rules
 */
async function listAutoReplies(sock, message, args) {
    const { remoteJid, sender, isGroup } = message;
    
    // Parse filter options
    const filters = {};
    
    if (isGroup) {
        filters.groupId = remoteJid;
    }
    
    if (args.length > 0) {
        if (['global', 'group', 'private'].includes(args[0].toLowerCase())) {
            filters.scope = args[0].toLowerCase();
            
            // If showing global rules or rules for a specific scope other than the current group
            if (filters.scope === 'global' || (filters.scope === 'group' && args.length > 1)) {
                delete filters.groupId;
                
                if (filters.scope === 'group' && args.length > 1) {
                    filters.groupId = args[1];
                }
            }
        }
    }
    
    try {
        const result = autoReplyLib.listRules(filters);
        
        if (result.success && result.rules.length > 0) {
            // Format the rules list
            let response = `📝 *Auto-Reply Rules*\n`;
            
            if (filters.scope) {
                response += `Scope: ${filters.scope}\n`;
            }
            
            if (filters.groupId) {
                const groupName = database.getGroupName(filters.groupId) || filters.groupId;
                response += `Group: ${groupName}\n`;
            }
            
            response += `\n`;
            
            result.rules.forEach(rule => {
                response += `*ID: ${rule.id}*\n`;
                response += `Pattern: ${rule.pattern}\n`;
                response += `Response: ${rule.response}\n`;
                
                if (rule.scope !== 'global') {
                    response += `Scope: ${rule.scope}\n`;
                    
                    if (rule.scope === 'group' && rule.groupId) {
                        const groupName = database.getGroupName(rule.groupId) || rule.groupId.split('@')[0];
                        response += `Group: ${groupName}\n`;
                    }
                }
                
                if (rule.regex) response += `RegEx: Yes\n`;
                if (rule.exact) response += `Exact Match: Yes\n`;
                if (rule.caseSensitive) response += `Case Sensitive: Yes\n`;
                
                response += `Status: ${rule.enabled ? 'Enabled' : 'Disabled'}\n\n`;
            });
            
            return { success: true, message: response };
        } else if (result.success) {
            return { 
                success: true, 
                message: `⚠️ No auto-reply rules found for the specified filters.` 
            };
        } else {
            return { success: false, message: `⚠️ ${result.message}` };
        }
    } catch (error) {
        console.error('Error listing auto-reply rules:', error);
        return { success: false, message: `⚠️ Error: ${error.message}` };
    }
}

/**
 * Create an AI-generated auto-reply rule
 */
async function generateAutoReply(sock, message, args) {
    const { remoteJid, sender, isGroup, quotedMsg } = message;
    
    if (!quotedMsg) {
        return { 
            success: false, 
            message: '⚠️ You must reply to a message to generate an auto-reply rule.' 
        };
    }
    
    // Extract the message text to use as the pattern
    const messageText = quotedMsg.conversation || 
                     quotedMsg.extendedTextMessage?.text || 
                     quotedMsg.imageMessage?.caption || 
                     quotedMsg.videoMessage?.caption || '';
    
    if (!messageText) {
        return { 
            success: false, 
            message: '⚠️ Cannot extract text from this message type.' 
        };
    }
    
    // Get response template from arguments
    const responseTemplate = args.join(' ');
    
    if (!responseTemplate) {
        return { 
            success: false, 
            message: '⚠️ Usage: .genreply <your response>\n(Reply to the trigger message)' 
        };
    }
    
    try {
        // Create examples for AI pattern generation
        const examples = [
            { pattern: messageText, response: responseTemplate }
        ];
        
        // Generate rule using AI
        const result = await autoReplyLib.generateRule({
            examples,
            scope: isGroup ? 'group' : 'private',
            groupId: isGroup ? remoteJid : null
        });
        
        if (result.success) {
            return { 
                success: true, 
                message: `✅ AI-generated auto-reply rule created (ID: ${result.rule.id})\n\n` +
                         `Pattern: ${result.rule.pattern}\n` +
                         `Response: ${result.rule.response}\n` +
                         `Scope: ${result.rule.scope}\n` +
                         `RegEx: ${result.rule.regex ? 'Yes' : 'No'}\n` +
                         `Case-sensitive: ${result.rule.caseSensitive ? 'Yes' : 'No'}\n` +
                         `Exact match: ${result.rule.exact ? 'Yes' : 'No'}`
            };
        } else {
            return { success: false, message: `⚠️ ${result.message}` };
        }
    } catch (error) {
        console.error('Error generating auto-reply rule:', error);
        return { success: false, message: `⚠️ Error: ${error.message}` };
    }
}

module.exports = {
    createAutoReply,
    deleteAutoReply,
    toggleAutoReply,
    listAutoReplies,
    generateAutoReply
};