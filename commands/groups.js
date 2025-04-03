const database = require('../lib/database');
const groupManagement = require('../lib/groupManagement');

/**
 * Save all group members to contacts database
 */
async function saveAllMembers(sock, groupId) {
    try {
        // Send status message
        await sock.sendMessage(groupId, { 
            text: '⏳ Saving all group members to contacts...'
        });
        
        // Save members
        const savedContacts = await groupManagement.saveAllGroupMembers(sock, groupId);
        
        // Send success message
        await sock.sendMessage(groupId, { 
            text: `✅ Successfully saved ${savedContacts.length} contacts from this group.`
        });
    } catch (error) {
        console.error('Error saving group members:', error);
        
        // Send error message
        await sock.sendMessage(groupId, { 
            text: `❌ Error saving group members: ${error.message}`
        });
    }
}

/**
 * Add all saved contacts to the current group
 */
async function addAllToGroup(sock, groupId) {
    try {
        // Send status message
        await sock.sendMessage(groupId, { 
            text: '⏳ Starting to add saved contacts to this group...\n' +
                 'This will be done in batches of 4 every minute to avoid WhatsApp limitations.'
        });
        
        // Add contacts
        const results = await groupManagement.addAllContactsToGroup(sock, groupId);
        
        // Send results message
        const resultMessage = `✅ Finished adding contacts to group\n\n` +
                             `• Total contacts: ${results.total}\n` +
                             `• Successfully added: ${results.added}\n` +
                             `• Failed to add: ${results.failed}\n` +
                             (results.errors.length > 0 ? 
                              `\n⚠️ Errors encountered:\n${results.errors.join('\n')}` : '');
        
        await sock.sendMessage(groupId, { text: resultMessage });
    } catch (error) {
        console.error('Error adding contacts to group:', error);
        
        // Send error message
        await sock.sendMessage(groupId, { 
            text: `❌ Error adding contacts to group: ${error.message}`
        });
    }
}

/**
 * Tag all members in the group with a custom message
 */
async function tagAll(sock, groupId, message) {
    try {
        // Get default message if none provided
        const tagMessage = message || 'Attention everyone! 📢';
        
        // Tag members
        await groupManagement.tagAllGroupMembers(sock, groupId, tagMessage);
    } catch (error) {
        console.error('Error tagging group members:', error);
        
        // Send error message
        await sock.sendMessage(groupId, { 
            text: `❌ Error tagging group members: ${error.message}`
        });
    }
}

module.exports = {
    saveAllMembers,
    addAllToGroup,
    tagAll
};
