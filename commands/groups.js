/**
 * WhatsApp Group Command Handlers
 * 
 * This module provides command handlers for various group-related functions:
 * - Saving group members to contacts
 * - Adding contacts to groups
 * - Tagging all members
 * - Generating vCard files
 * 
 * NOTE: The automatic contact addition features (scheduleAutoAddition and stopAutoAddition)
 * have been disabled for security reasons as requested. These functions now return
 * error messages informing users that this functionality has been removed.
 */

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
 * Fetch random phone numbers from saved contacts
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} chatId - The chat JID to send the result to
 * @param {number} count - Number of random contacts to fetch
 * @returns {Promise<void>}
 */
async function fetchRandomNumbers(sock, chatId, count = 4) {
    try {
        // Send initial status message
        await sock.sendMessage(chatId, { 
            text: `⏳ Fetching ${count} random phone numbers from your saved contacts...`
        });
        
        // Get all contacts from the database
        const allContacts = database.getAllContacts();
        const contactNumbers = Object.keys(allContacts);
        
        if (contactNumbers.length === 0) {
            await sock.sendMessage(chatId, { 
                text: `❌ No contacts found in the database. Use '.save all' in a group to save members first.`
            });
            return;
        }
        
        // Shuffle the array to get random contacts
        const shuffled = [...contactNumbers].sort(() => 0.5 - Math.random());
        
        // Take only the number of contacts requested
        const selectedCount = Math.min(count, shuffled.length);
        const randomContacts = shuffled.slice(0, selectedCount);
        
        // Format the numbers nicely
        let resultMessage = `✅ Here are ${selectedCount} random phone numbers from your saved contacts:\n\n`;
        
        randomContacts.forEach((number, index) => {
            const contact = allContacts[number];
            const name = contact.name || 'Unknown';
            const labels = contact.labels?.join(', ') || 'No labels';
            
            resultMessage += `*${index + 1}. ${number}*\n`;
            resultMessage += `• Name: ${name}\n`;
            resultMessage += `• Labels: ${labels}\n\n`;
        });
        
        // Add copy-friendly format at the end
        resultMessage += `*Copy-friendly format:*\n${randomContacts.join(',')}`;
        
        // Send the result
        await sock.sendMessage(chatId, { text: resultMessage });
        
    } catch (error) {
        console.error('Error fetching random numbers:', error);
        
        // Send error message
        await sock.sendMessage(chatId, { 
            text: `❌ Error fetching random numbers: ${error.message}`
        });
    }
}

/**
 * Add specific phone numbers to the group
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @param {string} numbersString - Comma-separated phone numbers
 * @returns {Promise<void>}
 */
async function addNumbersToGroup(sock, groupId, numbersString) {
    try {
        // Send initial status message
        await sock.sendMessage(groupId, { 
            text: '⏳ Processing the phone numbers to add...'
        });
        
        // Parse the phone numbers - split by commas, spaces, or other separators
        const phoneNumbers = numbersString.split(/[\s,;]+/).filter(num => num.trim().length > 0);
        
        if (phoneNumbers.length === 0) {
            await sock.sendMessage(groupId, { 
                text: '⚠️ No valid phone numbers provided. Usage: .add "number1,number2,number3"'
            });
            return;
        }
        
        // Check if bot is admin in the group
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            const botNumber = sock.user.id.split(':')[0];
            const botJid = `${botNumber}@s.whatsapp.net`;
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
            const isAdmin = botParticipant && ['admin', 'superadmin'].includes(botParticipant.admin);
            
            if (!isAdmin) {
                // Send warning that bot is not admin
                await sock.sendMessage(groupId, {
                    text: `⚠️ I'm not an admin in this group.\n\nWhatsApp will generate invite links instead of directly adding members. Please make me an admin for direct additions.`
                });
            }
        } catch (metadataError) {
            console.error('Error checking group metadata:', metadataError);
        }
        
        // Add the specific numbers to the group
        const result = await groupManagement.addSpecificNumbersToGroup(sock, groupId, phoneNumbers);
        
        // Check if we got any results at all
        if (!result.success && !result.inviteLinks?.length) {
            await sock.sendMessage(groupId, { 
                text: `❌ ${result.message || 'Failed to add phone numbers to the group.'}`
            });
            return;
        }
        
        // Create summary message
        let summaryMessage = `📱 Results for ${result.total} phone numbers:\n\n`;
        
        // If we have direct adds, show them
        if (result.added > 0) {
            summaryMessage += `✅ Successfully added: ${result.added} contacts\n`;
        }
        
        // If we have failed adds without invite links, show them
        if (result.failed > 0) {
            // If we have invite links, these aren't failures - they're just alternative methods
            if (result.inviteLinks?.length === result.failed) {
                summaryMessage += `ℹ️ Generated invite links: ${result.inviteLinks.length} contacts\n`;
            } else {
                const realFailures = result.failed - (result.inviteLinks?.length || 0);
                if (realFailures > 0) {
                    summaryMessage += `❌ Failed to add: ${realFailures} contacts\n`;
                }
            }
        }
        
        // If we have invite links, include them - this is a success!
        if (result.inviteLinks && result.inviteLinks.length > 0) {
            summaryMessage += `\n📲 WhatsApp invite links (valid for 6 days):\n`;
            summaryMessage += result.inviteLinks.slice(0, 5).join('\n');
            
            if (result.inviteLinks.length > 5) {
                summaryMessage += `\n...and ${result.inviteLinks.length - 5} more`;
            }
            
            summaryMessage += `\n\nℹ️ Note: Invite links need to be manually shared with the contacts.`;
        }
        
        await sock.sendMessage(groupId, { text: summaryMessage });
        
    } catch (error) {
        console.error('Error adding specific numbers to group:', error);
        
        // Send error message
        await sock.sendMessage(groupId, { 
            text: `❌ Error adding phone numbers: ${error.message}`
        });
    }
}

/**
 * Schedule automatic addition of saved contacts at a rate of one per minute
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @returns {Promise<void>}
 */
/**
 * This feature has been disabled for security reasons
 * @deprecated
 */
async function scheduleAutoAddition(sock, groupId) {
    try {
        await sock.sendMessage(groupId, { 
            text: '⚠️ The automatic contact addition feature has been disabled for security reasons.'
        });
    } catch (error) {
        console.error('Error sending auto-add disabled message:', error);
    }
}

/**
 * This feature has been disabled for security reasons
 * @deprecated
 */
async function stopAutoAddition(sock, groupId) {
    try {
        await sock.sendMessage(groupId, { 
            text: '⚠️ The automatic contact addition feature has been disabled for security reasons.'
        });
        
        // Clear any existing auto-add data if it exists
        const scheduledRandomAdds = database.getData('scheduledRandomAdds');
        if (scheduledRandomAdds) {
            scheduledRandomAdds.isActive = false;
            database.saveData('scheduledRandomAdds', scheduledRandomAdds);
        }
    } catch (error) {
        console.error('Error sending auto-add disabled message:', error);
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

/**
 * Save all group contacts to the user's device using vCard format
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @param {Object} msg - The original message for replying
 * @returns {Promise<void>}
 */
async function saveAllContactsToDevice(sock, groupId, msg) {
    try {
        // Send initial status message
        await sock.sendMessage(groupId, { 
            text: '⏳ Generating contact file with all group members...',
            quoted: msg
        });
        
        // Generate the vCard file for all group members
        const result = await groupManagement.generateGroupMembersVCard(sock, groupId);
        
        if (!result.success) {
            await sock.sendMessage(groupId, { 
                text: `❌ ${result.message || 'Failed to generate contacts file.'}`,
                quoted: msg
            });
            return;
        }
        
        // Send success message
        await sock.sendMessage(groupId, { 
            text: `✅ Successfully generated contacts file with ${result.memberCount} group members.`,
            quoted: msg
        });
        
        // Send the actual vCard file
        await sock.sendMessage(groupId, {
            document: result.vCardBuffer,
            fileName: result.fileName,
            mimetype: 'text/vcard',
            caption: `📱 ${result.memberCount} contacts from this group.\n\nInstructions:\n1. Download this file\n2. Open it with your phone's contacts app\n3. All ${result.memberCount} contacts will be imported to your device`
        });
        
    } catch (error) {
        console.error('Error saving contacts to device:', error);
        
        // Send error message
        await sock.sendMessage(groupId, { 
            text: `❌ Error generating contacts file: ${error.message}`,
            quoted: msg
        });
    }
}

module.exports = {
    saveAllMembers,
    addNumbersToGroup,
    scheduleAutoAddition,
    stopAutoAddition,
    fetchRandomNumbers,
    tagAll,
    saveAllContactsToDevice
};
