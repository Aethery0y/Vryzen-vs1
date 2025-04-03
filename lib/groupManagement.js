const database = require('./database');
const config = require('../config');

/**
 * Save all group members to contacts database
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @returns {Promise<Array>} List of saved contacts
 */
async function saveAllGroupMembers(sock, groupId) {
    try {
        // Fetch group metadata
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants || [];
        
        // Save each participant
        const savedContacts = [];
        
        for (const participant of participants) {
            const number = participant.id.split('@')[0];
            const contact = database.saveContact(number, {
                // Add default values for new contacts
                labels: ['group_member'],
                // Set the group as metadata
                metadata: {
                    ...participant,
                    group: groupMetadata.subject
                }
            });
            
            savedContacts.push(contact);
        }
        
        return savedContacts;
    } catch (error) {
        console.error('Error saving group members:', error);
        throw error;
    }
}

/**
 * Add all saved contacts to a group
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @returns {Promise<Object>} Result of the operation
 */
async function addAllContactsToGroup(sock, groupId) {
    try {
        // Get all contacts
        const allContacts = database.getAllContacts();
        const contactNumbers = Object.keys(allContacts);
        
        // Get current group members
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants || [];
        const existingMembers = new Set(participants.map(p => database.normalizeNumber(p.id)));
        
        // Filter contacts not already in the group
        const contactsToAdd = contactNumbers.filter(number => {
            return !existingMembers.has(database.normalizeNumber(number));
        });
        
        // Add contacts in batches
        const results = {
            total: contactsToAdd.length,
            added: 0,
            failed: 0,
            errors: []
        };
        
        // Process in batches
        for (let i = 0; i < contactsToAdd.length; i += config.contactBatchSize) {
            const batch = contactsToAdd.slice(i, i + config.contactBatchSize);
            
            try {
                // Format numbers to WhatsApp format
                const formattedNumbers = batch.map(number => {
                    // Remove + if present and ensure it ends with @s.whatsapp.net
                    const cleaned = number.replace(/^\+/, '');
                    return `${cleaned}@s.whatsapp.net`;
                });
                
                // Add participants to group
                await sock.groupParticipantsUpdate(
                    groupId,
                    formattedNumbers,
                    "add"
                );
                
                results.added += batch.length;
            } catch (error) {
                results.failed += batch.length;
                results.errors.push(error.message);
            }
            
            // Wait before adding the next batch to avoid WhatsApp rate limits
            if (i + config.contactBatchSize < contactsToAdd.length) {
                await new Promise(resolve => setTimeout(resolve, config.addContactsDelay));
            }
        }
        
        return results;
    } catch (error) {
        console.error('Error adding contacts to group:', error);
        throw error;
    }
}

/**
 * Tag all members in a group with a custom message
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @param {string} message - Message to send with the tag
 * @returns {Promise<Object>} Result of the operation
 */
async function tagAllGroupMembers(sock, groupId, message) {
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants || [];
        
        if (participants.length === 0) {
            return { success: false, message: 'No participants found in the group' };
        }
        
        // Create mentions list
        const mentions = participants.map(p => p.id);
        
        // Create message with mentions
        const tagMessage = message ? `${message}\n\n` : 'Attention everyone!\n\n';
        
        // Add each participant as a tag
        const taggedMessage = tagMessage + participants.map(p => {
            // Get display name or use number
            const displayName = p.notify || p.id.split('@')[0];
            return `@${p.id.split('@')[0]}`;
        }).join(' ');
        
        // Send message with mentions
        await sock.sendMessage(groupId, {
            text: taggedMessage,
            mentions: mentions
        });
        
        return { success: true, tagged: participants.length };
    } catch (error) {
        console.error('Error tagging group members:', error);
        throw error;
    }
}

module.exports = {
    saveAllGroupMembers,
    addAllContactsToGroup,
    tagAllGroupMembers
};
