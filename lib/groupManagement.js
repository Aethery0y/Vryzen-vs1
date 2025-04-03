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
            errors: [],
            isFirstExecution: false
        };
        
        // Check if this is the first time adding contacts (based on our tracking)
        const addTracker = database.getData('contactAddTracker') || {};
        if (!addTracker[groupId]) {
            // This is the first time adding contacts to this group
            results.isFirstExecution = true;
            // Save the tracker data for this group
            addTracker[groupId] = { 
                lastExecuted: Date.now(),
                count: 1
            };
            database.saveData('contactAddTracker', addTracker);
        } else {
            // Update the tracker data
            addTracker[groupId].lastExecuted = Date.now();
            addTracker[groupId].count += 1;
            database.saveData('contactAddTracker', addTracker);
        }
        
        // For first execution, add first batch immediately and schedule the rest
        if (results.isFirstExecution) {
            // Handle first batch immediately
            if (contactsToAdd.length > 0) {
                const firstBatchSize = Math.min(config.contactBatchSize, contactsToAdd.length);
                const firstBatch = contactsToAdd.slice(0, firstBatchSize);
                
                try {
                    // Format numbers to WhatsApp format for first batch
                    const formattedNumbers = firstBatch.map(number => {
                        const cleaned = number.replace(/^\+/, '');
                        return `${cleaned}@s.whatsapp.net`;
                    });
                    
                    // Add participants to group
                    await sock.groupParticipantsUpdate(
                        groupId,
                        formattedNumbers,
                        "add"
                    );
                    
                    console.log(`Added first batch of ${firstBatch.length} contacts successfully`);
                    results.added += firstBatch.length;
                    
                    // Send a success message to the group
                    await sock.sendMessage(groupId, { 
                        text: `✅ Added first batch of ${firstBatch.length} contacts to the group.\nRemaining contacts to add: ${contactsToAdd.length - firstBatch.length}\n\nℹ️ Adding at a rate of ${config.contactBatchSize} contacts every minute to avoid WhatsApp restrictions.`
                    });
                    
                    // Schedule the rest of the batches
                    if (contactsToAdd.length > firstBatchSize) {
                        const remainingContacts = contactsToAdd.slice(firstBatchSize);
                        
                        // Store the remaining contacts in our database for scheduled processing
                        const scheduledBatches = {
                            groupId,
                            contacts: remainingContacts,
                            startTime: Date.now() + 60000, // Start exactly 1 minute after first batch
                            batchSize: config.contactBatchSize,
                            delay: 60000 // Fixed 1 minute delay
                        };
                        
                        database.saveData('scheduledContactBatches', scheduledBatches);
                        
                        // Set up a timeout to process the first scheduled batch
                        setTimeout(() => {
                            processNextContactBatch(sock);
                        }, 60000); // Fixed 1 minute delay
                    }
                } catch (error) {
                    console.error('Error adding first batch:', error);
                    results.failed += firstBatch.length;
                    results.errors.push(error.message);
                }
            }
        } else {
            // For subsequent executions, check if there's already a scheduled batch process
            const existingSchedule = database.getData('scheduledContactBatches');
            
            // If there's already a schedule for this group, add these contacts to it
            if (existingSchedule && existingSchedule.groupId === groupId) {
                existingSchedule.contacts = [...existingSchedule.contacts, ...contactsToAdd];
                database.saveData('scheduledContactBatches', existingSchedule);
                
                console.log(`Added ${contactsToAdd.length} more contacts to existing schedule`);
                
                // Send a status message to the group
                await sock.sendMessage(groupId, { 
                    text: `✅ Added ${contactsToAdd.length} more contacts to the schedule.\nTotal pending contacts: ${existingSchedule.contacts.length}\n\nℹ️ These will be added at a rate of ${config.contactBatchSize} contacts every minute.`
                });
            } else {
                // Create a new schedule
                const scheduledBatches = {
                    groupId,
                    contacts: contactsToAdd,
                    startTime: Date.now() + 60000, // Start exactly 1 minute after first batch
                    batchSize: config.contactBatchSize,
                    delay: 60000 // Fixed 1 minute delay
                };
                
                database.saveData('scheduledContactBatches', scheduledBatches);
                
                // Set up a timeout to process the first scheduled batch
                setTimeout(() => {
                    processNextContactBatch(sock);
                }, 60000); // Fixed 1 minute delay
                
                console.log(`Created new schedule for ${contactsToAdd.length} contacts`);
                
                // Send a status message to the group
                await sock.sendMessage(groupId, { 
                    text: `✅ Scheduled ${contactsToAdd.length} contacts to be added to the group.\n\nℹ️ These will be added at a rate of ${config.contactBatchSize} contacts every minute to avoid WhatsApp restrictions.`
                });
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

/**
 * Process the next batch of contacts to be added to a group
 * This function is called recursively with setTimeout to space out the API calls
 * It ensures that 4 contacts are added every minute as specified
 * 
 * @param {Object} sock - The WhatsApp socket
 */
async function processNextContactBatch(sock) {
    try {
        // Get the scheduled batches
        const scheduledBatches = database.getData('scheduledContactBatches');
        if (!scheduledBatches || !scheduledBatches.contacts || scheduledBatches.contacts.length === 0) {
            console.log('No more contacts to process');
            return;
        }
        
        // Get the next batch (exactly 4 contacts as specified)
        const batchSize = config.contactBatchSize;  // This should be 4
        const currentBatch = scheduledBatches.contacts.slice(0, batchSize);
        
        if (currentBatch.length === 0) {
            // No more contacts to process, clean up
            database.saveData('scheduledContactBatches', null);
            console.log('Finished processing all contact batches');
            return;
        }
        
        // Format numbers to WhatsApp format
        const formattedNumbers = currentBatch.map(number => {
            const cleaned = number.replace(/^\+/, '');
            return `${cleaned}@s.whatsapp.net`;
        });
        
        try {
            // Actually add the participants to the group
            await sock.groupParticipantsUpdate(
                scheduledBatches.groupId,
                formattedNumbers,
                "add"
            );
            
            console.log(`Successfully added batch of ${currentBatch.length} contacts to group`);
            
            // Send status message to the group
            await sock.sendMessage(scheduledBatches.groupId, { 
                text: `✅ Added ${currentBatch.length} contacts to the group.\nRemaining: ${scheduledBatches.contacts.length - currentBatch.length}\nAdding in batches of ${config.contactBatchSize} contacts every minute...`
            });
        } catch (error) {
            console.error('Error adding batch:', error);
            
            // Send error message to the group
            await sock.sendMessage(scheduledBatches.groupId, { 
                text: `⚠️ Failed to add some contacts: ${error.message}`
            });
        }
        
        // Update the scheduled batches
        scheduledBatches.contacts = scheduledBatches.contacts.slice(batchSize);
        database.saveData('scheduledContactBatches', scheduledBatches);
        
        // If there are more contacts, schedule the next batch in exactly 1 minute (60000ms)
        if (scheduledBatches.contacts.length > 0) {
            setTimeout(() => {
                processNextContactBatch(sock);
            }, 60000); // Exactly 1 minute delay
        } else {
            // Send completion message
            await sock.sendMessage(scheduledBatches.groupId, { 
                text: `✅ Finished adding all contacts to the group!`
            });
            
            // Clean up
            database.saveData('scheduledContactBatches', null);
        }
    } catch (error) {
        console.error('Error processing contact batch:', error);
    }
}

module.exports = {
    saveAllGroupMembers,
    addAllContactsToGroup,
    tagAllGroupMembers,
    processNextContactBatch
};
