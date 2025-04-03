const database = require('../lib/database');
const contactManager = require('../lib/contacts');

/**
 * Add a label to a contact
 */
async function addLabel(sock, remoteJid, number, label) {
    try {
        const normalizedNumber = database.normalizeNumber(number);
        const contact = contactManager.addLabel(normalizedNumber, label);
        
        await sock.sendMessage(remoteJid, { 
            text: `✅ Label "${label}" added to contact ${normalizedNumber}.`
        });
    } catch (error) {
        console.error('Error adding label:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error adding label: ${error.message}`
        });
    }
}

/**
 * Remove a label from a contact
 */
async function removeLabel(sock, remoteJid, number, label) {
    try {
        const normalizedNumber = database.normalizeNumber(number);
        const contact = contactManager.removeLabel(normalizedNumber, label);
        
        if (!contact) {
            await sock.sendMessage(remoteJid, { 
                text: `⚠️ Contact ${normalizedNumber} not found.`
            });
            return;
        }
        
        await sock.sendMessage(remoteJid, { 
            text: `✅ Label "${label}" removed from contact ${normalizedNumber}.`
        });
    } catch (error) {
        console.error('Error removing label:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error removing label: ${error.message}`
        });
    }
}

/**
 * List all labels for a contact
 */
async function listLabels(sock, remoteJid, number) {
    try {
        const normalizedNumber = database.normalizeNumber(number);
        const contact = contactManager.getContactInfo(normalizedNumber);
        
        if (!contact) {
            await sock.sendMessage(remoteJid, { 
                text: `⚠️ Contact ${normalizedNumber} not found.`
            });
            return;
        }
        
        const labels = contact.labels || [];
        
        await sock.sendMessage(remoteJid, { 
            text: `📝 *Labels for ${normalizedNumber}*:\n\n` +
                 (labels.length > 0 ? `• ${labels.join('\n• ')}` : 'No labels assigned.')
        });
    } catch (error) {
        console.error('Error listing labels:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error listing labels: ${error.message}`
        });
    }
}

/**
 * Set contact information
 */
async function setContactInfo(sock, remoteJid, number, fieldValuePairs) {
    try {
        const normalizedNumber = database.normalizeNumber(number);
        const data = {};
        
        // Parse field=value pairs
        for (const pair of fieldValuePairs) {
            const [field, value] = pair.split('=');
            if (field && value) {
                // Handle nested properties with dot notation
                if (field.includes('.')) {
                    const [parentField, childField] = field.split('.');
                    data[parentField] = data[parentField] || {};
                    data[parentField][childField] = value;
                } else {
                    data[field] = value;
                }
            }
        }
        
        // Update contact
        const contact = contactManager.setContactInfo(normalizedNumber, data);
        
        await sock.sendMessage(remoteJid, { 
            text: `✅ Contact information updated for ${normalizedNumber}.`
        });
    } catch (error) {
        console.error('Error setting contact info:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error setting contact info: ${error.message}`
        });
    }
}

/**
 * Get contact information
 */
async function getContactInfo(sock, remoteJid, number) {
    try {
        const normalizedNumber = database.normalizeNumber(number);
        const contact = contactManager.getContactInfo(normalizedNumber);
        
        if (!contact) {
            await sock.sendMessage(remoteJid, { 
                text: `⚠️ Contact ${normalizedNumber} not found.`
            });
            return;
        }
        
        // Format contact info
        let contactInfo = `👤 *Contact Info: ${normalizedNumber}*\n\n`;
        
        // Add basic info
        contactInfo += `• Number: ${contact.number}\n`;
        contactInfo += `• Labels: ${contact.labels?.length > 0 ? contact.labels.join(', ') : 'None'}\n`;
        contactInfo += `• Engagement: ${contact.engagement || 0}\n`;
        contactInfo += `• Last Interaction: ${contact.lastInteraction ? new Date(contact.lastInteraction).toLocaleString() : 'Never'}\n`;
        
        // Add metadata if available
        if (contact.metadata && Object.keys(contact.metadata).length > 0) {
            contactInfo += `\n*Metadata:*\n`;
            for (const [key, value] of Object.entries(contact.metadata)) {
                if (typeof value !== 'object') {
                    contactInfo += `• ${key}: ${value}\n`;
                }
            }
        }
        
        await sock.sendMessage(remoteJid, { text: contactInfo });
    } catch (error) {
        console.error('Error getting contact info:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error getting contact info: ${error.message}`
        });
    }
}

/**
 * Find contacts by criteria
 */
async function findContacts(sock, remoteJid, args) {
    try {
        const criteria = {};
        
        // Parse criteria
        for (const arg of args) {
            const [field, value] = arg.split('=');
            if (field && value) {
                criteria[field] = value;
            }
        }
        
        // Find matching contacts
        const matches = contactManager.findContacts(criteria);
        
        if (matches.length === 0) {
            await sock.sendMessage(remoteJid, { 
                text: `⚠️ No contacts found matching the criteria.`
            });
            return;
        }
        
        // Format results
        let resultsMessage = `🔍 *Found ${matches.length} contacts matching criteria:*\n\n`;
        
        for (let i = 0; i < matches.length; i++) {
            const contact = matches[i];
            resultsMessage += `*${i+1}. ${contact.number}*\n`;
            resultsMessage += `• Labels: ${contact.labels?.length > 0 ? contact.labels.join(', ') : 'None'}\n`;
            resultsMessage += `• Engagement: ${contact.engagement || 0}\n\n`;
            
            // Limit to 10 contacts to avoid message too long
            if (i >= 9 && matches.length > 10) {
                resultsMessage += `...and ${matches.length - 10} more contacts.`;
                break;
            }
        }
        
        await sock.sendMessage(remoteJid, { text: resultsMessage });
    } catch (error) {
        console.error('Error finding contacts:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error finding contacts: ${error.message}`
        });
    }
}

/**
 * Show statistics for a contact
 */
async function showStats(sock, remoteJid, number) {
    try {
        const normalizedNumber = database.normalizeNumber(number);
        const stats = contactManager.getContactStats(normalizedNumber);
        
        if (!stats.exists) {
            await sock.sendMessage(remoteJid, { 
                text: `⚠️ Contact ${normalizedNumber} not found in the database.`
            });
            return;
        }
        
        // Format stats message
        const statsMessage = `📊 *Stats for ${normalizedNumber}*\n\n` +
            `• Engagement Level: ${stats.engagement || 0}\n` +
            `• Last Interaction: ${stats.lastInteraction || 'Never'}\n` +
            `• Labels: ${stats.labels?.length > 0 ? stats.labels.join(', ') : 'None'}\n\n` +
            
            `⚠️ *Warning Status:*\n` +
            `• Warnings: ${stats.warnings.warnings || 0}\n` +
            `• Strikes: ${stats.warnings.strikes || 0}\n` +
            `• Status: ${stats.warnings.banned ? '🚫 BANNED' : '✅ ACTIVE'}`;
        
        await sock.sendMessage(remoteJid, { text: statsMessage });
    } catch (error) {
        console.error('Error showing stats:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error showing stats: ${error.message}`
        });
    }
}

module.exports = {
    addLabel,
    removeLabel,
    listLabels,
    setContactInfo,
    getContactInfo,
    findContacts,
    showStats
};
