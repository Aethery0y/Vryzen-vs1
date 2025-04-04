/**
 * WhatsApp Group Management Library
 * 
 * This module handles various group-related functionality like:
 * - Saving group members to contacts database
 * - Adding contacts to groups
 * - Tagging all members in a group
 * - Generating vCard files for group members
 *
 * NOTE: The automatic contact addition feature has been disabled (scheduleRandomContactAddition) 
 * for security reasons as requested. These functions now return error messages informing users
 * that this functionality has been removed.
 */

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
        
        // Send initial status message
        await sock.sendMessage(groupId, { 
            text: `⏳ Checking your contacts database...\nFound ${contactNumbers.length} total contacts.`
        });
        
        // If no contacts, exit early
        if (contactNumbers.length === 0) {
            await sock.sendMessage(groupId, { 
                text: `❌ No contacts found! Please use '.save all' first to save group members.`
            });
            return {
                total: 0,
                added: 0,
                failed: 0,
                errors: ["No contacts found in database"],
                isFirstExecution: false
            };
        }
        
        // Get current group members
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants || [];
        const existingMembers = new Set(participants.map(p => p.id.split('@')[0]));
        
        await sock.sendMessage(groupId, { 
            text: `⏳ Found ${participants.length} existing members in this group. Filtering contacts...`
        });
        
        // Filter contacts not already in the group and format for WhatsApp
        const contactsToAdd = [];
        for (const number of contactNumbers) {
            // Clean the number - remove any non-digits and leading '+'
            const cleanNumber = number.replace(/\D/g, '').replace(/^\+/, '');
            // Don't add if already in the group
            if (!existingMembers.has(cleanNumber)) {
                contactsToAdd.push(`${cleanNumber}@s.whatsapp.net`);
            }
        }
        
        // Add contacts in batches
        const batchSize = config.contactBatchSize || 4;
        const results = {
            total: contactsToAdd.length,
            added: 0,
            failed: 0,
            errors: [],
            isFirstExecution: false,
            batchSize: batchSize
        };
        
        await sock.sendMessage(groupId, { 
            text: `✅ Filtered complete. Found ${contactsToAdd.length} contacts to add to this group.`
        });
        
        // If no contacts to add, exit early
        if (contactsToAdd.length === 0) {
            await sock.sendMessage(groupId, { 
                text: `ℹ️ All your saved contacts are already members of this group. Nothing to do.`
            });
            return results;
        }
        
        // Check if this is the first time adding contacts
        const addTracker = database.getData('contactAddTracker') || {};
        if (!addTracker[groupId]) {
            // This is the first time adding contacts to this group
            results.isFirstExecution = true;
            // Save the tracker data for this group
            addTracker[groupId] = { 
                lastExecuted: Date.now(),
                count: 1
            };
        } else {
            // Update the tracker data
            addTracker[groupId].lastExecuted = Date.now();
            addTracker[groupId].count += 1;
        }
        database.saveData('contactAddTracker', addTracker);
        
        // Add first batch immediately (both for first execution and subsequent ones)
        // Use the already defined batchSize
        const firstBatchSize = Math.min(results.batchSize, contactsToAdd.length);
        const firstBatch = contactsToAdd.slice(0, firstBatchSize);
        
        await sock.sendMessage(groupId, { 
            text: `⏳ Adding first batch of ${firstBatch.length} contacts to group...`
        });
        
        try {
            // Try to add the first batch to the group
            let result;
            try {
                result = await sock.groupParticipantsUpdate(
                    groupId,
                    firstBatch,
                    "add"
                );
                console.log('First batch add result:', JSON.stringify(result));
            } catch (addError) {
                console.error('Error in groupParticipantsUpdate:', addError);
                
                // Check if it's a bad-request error (typically means bot is not an admin)
                if (addError.message === 'bad-request' || (addError.data && addError.data === 400)) {
                    await sock.sendMessage(groupId, { 
                        text: `⚠️ Cannot add contacts because the bot is not an admin of this group.\n` +
                              `Please make the bot an admin, then try again with '.add all'.\n\n` +
                              `Note: WhatsApp requires admin privileges to add contacts.`
                    });
                    
                    // Stop processing
                    throw new Error('Bot requires admin rights in this group to add members');
                }
                
                // For other errors, create an empty result and continue
                result = [];
                await sock.sendMessage(groupId, { 
                    text: `⚠️ Error encountered: ${addError.message}\nAttempting to continue...`
                });
            }
            
            // Check if successful
            let successCount = 0;
            let failedCount = 0;
            let errorMessages = [];
            let inviteLinks = [];
            
            // Result is usually an array of objects with status codes
            if (Array.isArray(result)) {
                for (const status of result) {
                    if (status.status === 200) {
                        successCount++;
                    } else if (status.status === 403 && status.content && status.content.content) {
                        // Handle invite link situation (error 403 with add_request code)
                        try {
                            // Extract the invite code from the response
                            const addRequest = status.content.content.find(item => item.tag === 'add_request');
                            if (addRequest && addRequest.attrs && addRequest.attrs.code) {
                                const inviteCode = addRequest.attrs.code;
                                const jid = status.jid.split('@')[0];
                                inviteLinks.push(`Number: ${jid} - Invite Code: ${inviteCode}`);
                                
                                // We count this as a partial success since we got an invite link
                                errorMessages.push(`Generated invite link for ${jid}`);
                            } else {
                                failedCount++;
                                errorMessages.push(`Error 403: Need admin rights to add ${status.jid.split('@')[0]}`);
                            }
                        } catch (parseError) {
                            failedCount++;
                            errorMessages.push(`Error parsing invite link for ${status.jid}`);
                        }
                    } else {
                        failedCount++;
                        errorMessages.push(`Error code: ${status.status} - ${status.message || 'Permission denied'}`);
                    }
                }
            } else if (result && typeof result === 'object') {
                // Some versions return an object with success/failure counts
                successCount = result.success || 0;
                failedCount = result.failed || (firstBatch.length - successCount);
            } else {
                // Default to assuming success unless explicitly told otherwise
                successCount = firstBatch.length;
            }
            
            // If we have invite links, we'll send them as separate messages
            if (inviteLinks.length > 0) {
                await sock.sendMessage(groupId, {
                    text: `📱 WhatsApp generated invite links for ${inviteLinks.length} contacts.\n` +
                          `These contacts need to be invited manually using the codes below:\n\n` +
                          `${inviteLinks.join('\n')}\n\n` +
                          `Note: These invite codes expire after 6 days.`
                });
            }
            
            results.added += successCount;
            results.failed += failedCount;
            
            if (errorMessages.length > 0) {
                results.errors.push(...errorMessages);
            }
            
            // Send status of first batch
            await sock.sendMessage(groupId, { 
                text: `✅ First batch: ${successCount} contacts added successfully.` +
                      (failedCount > 0 ? `\n⚠️ Failed to add ${failedCount} contacts.` : '')
            });
        } catch (error) {
            console.error('Error adding first batch:', error);
            results.failed += firstBatch.length;
            results.errors.push(error.message);
            
            await sock.sendMessage(groupId, { 
                text: `❌ Error adding first batch: ${error.message}`
            });
        }
        
        // Schedule remaining contacts if any
        if (contactsToAdd.length > firstBatchSize) {
            const remainingContacts = contactsToAdd.slice(firstBatchSize);
            
            // Store the remaining contacts for scheduled processing
            const scheduledBatches = {
                groupId,
                contacts: remainingContacts,
                startTime: Date.now() + 120000, // Start in 2 minutes
                batchSize: results.batchSize,
                delay: 120000 // 2 minute delay
            };
            
            database.saveData('scheduledContactBatches', scheduledBatches);
            
            await sock.sendMessage(groupId, { 
                text: `⏳ Scheduled ${remainingContacts.length} more contacts to be added at a rate of ${scheduledBatches.batchSize} contacts every 2 minutes.`
            });
            
            // Set up a timeout to process the next batch
            setTimeout(() => {
                processNextContactBatch(sock);
            }, 120000); // 2 minute delay
        }
        
        return results;
    } catch (error) {
        console.error('Error adding contacts to group:', error);
        // Send error message
        await sock.sendMessage(groupId, { 
            text: `❌ Error with 'add all' command: ${error.message}\n\nPlease try again later.`
        });
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
 * It ensures that contacts are added in small batches every 2 minutes as specified
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
        
        // Get the group ID
        const { groupId } = scheduledBatches;
        
        // Get the next batch size (default to 4 if not specified)
        const batchSize = scheduledBatches.batchSize || config.contactBatchSize || 4;
        const currentBatch = scheduledBatches.contacts.slice(0, batchSize);
        
        if (currentBatch.length === 0) {
            // No more contacts to process, clean up
            database.saveData('scheduledContactBatches', null);
            console.log('Finished processing all contact batches');
            await sock.sendMessage(groupId, { 
                text: `✅ Finished adding all contacts to the group!`
            });
            return;
        }
        
        // Since we're now storing numbers already formatted with @s.whatsapp.net
        // we don't need to reformat them here. But let's ensure they're properly formatted
        // just in case the stored format changes.
        const formattedBatch = currentBatch.map(number => {
            if (number.includes('@s.whatsapp.net')) return number;
            const cleaned = number.replace(/\D/g, '').replace(/^\+/, '');
            return `${cleaned}@s.whatsapp.net`;
        });
        
        // Send status message
        await sock.sendMessage(groupId, { 
            text: `⏳ Adding batch of ${formattedBatch.length} contacts to group...`
        });
        
        try {
            // Try to add the participants to the group
            let result;
            try {
                result = await sock.groupParticipantsUpdate(
                    groupId,
                    formattedBatch,
                    "add"
                );
                console.log(`Batch add result:`, JSON.stringify(result));
            } catch (addError) {
                console.error('Error in groupParticipantsUpdate:', addError);
                
                // Check if it's a bad-request error (which could be due to not being an admin)
                if (addError.message === 'bad-request' || (addError.data && addError.data === 400)) {
                    await sock.sendMessage(groupId, { 
                        text: `⚠️ Cannot add contacts because the bot is not an admin of this group.\n` +
                              `Please make the bot an admin, then try again.\n\n` +
                              `Alternatively, you can invite these contacts manually.`
                    });
                    
                    // We'll throw the error to stop processing
                    throw new Error('Bot is not an admin in this group. Please add admin rights to use the add all feature.');
                }
                
                // For other errors, we'll create an empty result and continue
                result = [];
                await sock.sendMessage(groupId, { 
                    text: `⚠️ Error encountered: ${addError.message}\nTrying to continue anyway...`
                });
            }
            
            // Use the helper function to parse the results
            const parseResults = parseAddResults(result, formattedBatch);
            const { successCount, failedCount, errorMessages, inviteLinks } = parseResults;
            
            // If we have invite links, we'll send them as separate messages
            if (inviteLinks.length > 0) {
                await sock.sendMessage(groupId, {
                    text: `📱 Generated invite links for ${inviteLinks.length} contacts:\n\n` +
                          `${inviteLinks.join('\n')}\n\n` +
                          `These contacts need to be invited manually with these codes.`
                });
            }
            
            // Send status message to the group
            await sock.sendMessage(groupId, { 
                text: `✅ Added ${successCount} contacts to the group.` +
                      (failedCount > 0 ? `\n⚠️ ${failedCount} contacts failed to add.` : '') +
                      `\nRemaining: ${scheduledBatches.contacts.length - batchSize}\n` +
                      `Continuing in batches of ${batchSize} every 2 minutes...`
            });
            
            // If there were errors, log them in the console and possibly inform the group
            if (errorMessages.length > 0) {
                console.error('Errors adding contacts:', errorMessages);
                
                // Only send error details if there are fewer than 3 errors to avoid spamming
                if (errorMessages.length <= 3) {
                    await sock.sendMessage(groupId, { 
                        text: `⚠️ Errors encountered:\n${errorMessages.join('\n')}`
                    });
                }
            }
        } catch (error) {
            console.error('Error adding batch:', error);
            
            // Send error message to the group
            await sock.sendMessage(groupId, { 
                text: `⚠️ Failed to add contacts: ${error.message}`
            });
        }
        
        // Update the scheduled batches by removing the processed batch
        scheduledBatches.contacts = scheduledBatches.contacts.slice(batchSize);
        database.saveData('scheduledContactBatches', scheduledBatches);
        
        // If there are more contacts, schedule the next batch in exactly 2 minutes
        if (scheduledBatches.contacts.length > 0) {
            // Send info about next batch
            const remainingCount = scheduledBatches.contacts.length;
            const nextBatchSize = Math.min(batchSize, remainingCount);
            
            await sock.sendMessage(groupId, { 
                text: `⏳ Next batch of ${nextBatchSize} contacts will be added in 2 minutes. ${remainingCount - nextBatchSize} will remain after that.`
            });
            
            setTimeout(() => {
                processNextContactBatch(sock);
            }, 120000); // Exactly 2 minutes delay
        } else {
            // Send final completion message
            await sock.sendMessage(groupId, { 
                text: `✅ Successfully completed adding all contacts to the group!`
            });
            
            // Clean up
            database.saveData('scheduledContactBatches', null);
        }
    } catch (error) {
        console.error('Error processing contact batch:', error);
        
        // Try to get the group ID if possible to send an error message
        try {
            const scheduledBatches = database.getData('scheduledContactBatches');
            if (scheduledBatches && scheduledBatches.groupId) {
                await sock.sendMessage(scheduledBatches.groupId, { 
                    text: `❌ Error processing contact batch: ${error.message}\n\nThe process will automatically resume in 2 minutes.`
                });
                
                // Try again in 2 minutes
                setTimeout(() => {
                    processNextContactBatch(sock);
                }, 120000);
            }
        } catch (secondaryError) {
            console.error('Error sending error message:', secondaryError);
        }
    }
}

/**
 * Add specific phone numbers to a group
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @param {string|Array<string>} phoneNumbers - Phone number(s) to add (with or without country code)
 * @returns {Promise<Object>} Result of the operation
 */
async function addSpecificNumbersToGroup(sock, groupId, phoneNumbers) {
    try {
        // Convert single number to array if needed
        const numbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
        
        if (numbers.length === 0) {
            return {
                success: false,
                message: "No valid phone numbers provided"
            };
        }
        
        // Format numbers for WhatsApp API
        const formattedNumbers = numbers.map(number => {
            // Clean the number - remove any non-digits and leading '+'
            const cleanNumber = number.replace(/\D/g, '').replace(/^\+/, '');
            return `${cleanNumber}@s.whatsapp.net`;
        });
        
        // Get current group members to check if numbers are already in the group
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants || [];
        const existingMembers = new Set(participants.map(p => p.id.split('@')[0]));
        
        // Filter out numbers already in the group
        const numbersToAdd = formattedNumbers.filter(number => {
            const cleanNumber = number.split('@')[0];
            return !existingMembers.has(cleanNumber);
        });
        
        if (numbersToAdd.length === 0) {
            return {
                success: false,
                message: "All specified numbers are already in this group"
            };
        }
        
        // Add numbers immediately
        const result = await sock.groupParticipantsUpdate(
            groupId,
            numbersToAdd,
            "add"
        );
        
        // Use the helper function to parse the results
        const parsedResults = parseAddResults(result, numbersToAdd);
        const successCount = parsedResults.successCount;
        const failedCount = parsedResults.failedCount;
        const errors = parsedResults.errorMessages;
        const inviteLinks = parsedResults.inviteLinks;
        
        return {
            success: successCount > 0,
            added: successCount,
            failed: failedCount,
            errors,
            inviteLinks,
            total: numbersToAdd.length
        };
    } catch (error) {
        console.error('Error adding specific numbers to group:', error);
        return {
            success: false,
            message: error.message,
            error
        };
    }
}

/**
 * This function has been removed to disable the auto-adding feature
 * @deprecated
 */
async function scheduleRandomContactAddition(sock, groupId) {
    return {
        success: false,
        message: "Auto-adding contacts feature has been disabled for security reasons."
    };
}

/**
 * Parse the result from group participant addition
 * 
 * @param {Array|Object} result - The result from groupParticipantsUpdate
 * @param {Array} [contactBatch] - The batch of contacts that was processed
 * @returns {Object} Parsed results with success and failure counts
 */
function parseAddResults(result, contactBatch) {
    let successCount = 0;
    let failedCount = 0;
    let errorMessages = [];
    let inviteLinks = [];
    
    console.log('Random contact add result:', JSON.stringify(result));
    
    // Result is usually an array of objects with status codes
    if (Array.isArray(result)) {
        for (const status of result) {
            if (status.status === 200) {
                successCount++;
            } else if (status.status === 403 && status.content) {
                // Handle invite link situation (error 403 with add_request code)
                try {
                    // Extract the invite code from the response
                    let addRequest = null;
                    let inviteCode = null;
                    
                    // First, try to extract from content.content array
                    if (status.content.content && Array.isArray(status.content.content)) {
                        addRequest = status.content.content.find(item => item.tag === 'add_request');
                        if (addRequest && addRequest.attrs && addRequest.attrs.code) {
                            inviteCode = addRequest.attrs.code;
                        }
                    } 
                    // Try content directly if it has a tag property
                    else if (status.content.tag === 'add_request') {
                        if (status.content.attrs && status.content.attrs.code) {
                            inviteCode = status.content.attrs.code;
                        }
                    }
                    
                    // If we still don't have an invite code, try to find it in content
                    if (!inviteCode && typeof status.content === 'object') {
                        // Try to recursively find the code attribute
                        const findCodeInObject = (obj) => {
                            if (!obj || typeof obj !== 'object') return null;
                            
                            // If this object has attrs.code, use it
                            if (obj.attrs && obj.attrs.code) return obj.attrs.code;
                            
                            // Look in arrays
                            if (Array.isArray(obj.content)) {
                                for (const item of obj.content) {
                                    const found = findCodeInObject(item);
                                    if (found) return found;
                                }
                            }
                            
                            // Look in other object keys
                            for (const key in obj) {
                                if (key !== 'attrs' && typeof obj[key] === 'object') {
                                    const found = findCodeInObject(obj[key]);
                                    if (found) return found;
                                }
                            }
                            
                            return null;
                        };
                        
                        inviteCode = findCodeInObject(status.content);
                    }
                    
                    if (inviteCode) {
                        const jid = status.jid.split('@')[0];
                        inviteLinks.push(`https://chat.whatsapp.com/${inviteCode}`);
                        
                        // We count this as a "success" since we got an invite link, even though it's a 403
                        failedCount++;
                        errorMessages.push(`Generated invite link for ${jid}`);
                    } else {
                        failedCount++;
                        errorMessages.push(`Error 403: Need admin rights for ${status.jid.split('@')[0]}`);
                    }
                } catch (parseError) {
                    console.error('Error parsing invite response:', parseError, status);
                    failedCount++;
                    errorMessages.push(`Error parsing response for ${status.jid}`);
                }
            } else {
                failedCount++;
                let errorMsg = 'Permission denied';
                if (status.message) errorMsg = status.message;
                else if (status.content && status.content.attrs && status.content.attrs.error) {
                    errorMsg = status.content.attrs.error;
                }
                errorMessages.push(`Error: ${errorMsg}`);
            }
        }
    } else if (result && typeof result === 'object') {
        // Some versions return an object with success/failure counts
        successCount = result.success || 0;
        failedCount = result.failed || (contactBatch ? contactBatch.length - successCount : 0);
    } else {
        // Default to assuming success
        successCount = contactBatch ? contactBatch.length : 0;
    }
    
    return {
        successCount,
        failedCount,
        errorMessages,
        inviteLinks
    };
}

/**
 * This function has been removed to disable the auto-adding feature
 * @deprecated
 */
async function processNextRandomContact(sock) {
    // Disabled - no longer executes auto-adding
    console.log('Auto-adding contacts feature has been disabled');
    
    // Clear any existing auto-add data
    const scheduledRandomAdds = database.getData('scheduledRandomAdds');
    if (scheduledRandomAdds) {
        scheduledRandomAdds.isActive = false;
        database.saveData('scheduledRandomAdds', scheduledRandomAdds);
    }
    
    // If this was called from a group, send a notification
    if (sock && scheduledRandomAdds && scheduledRandomAdds.groupId) {
        try {
            await sock.sendMessage(scheduledRandomAdds.groupId, {
                text: `⚠️ The auto-adding contacts feature has been disabled for security reasons.`
            });
        } catch (error) {
            console.error('Error sending auto-add disabled notification:', error);
        }
    }
    
    return;
}

/**
 * Generate a vCard file with all group members to save in the user's device
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {string} groupId - The group JID
 * @returns {Promise<Object>} Result with file buffer and member count
 */
async function generateGroupMembersVCard(sock, groupId) {
    try {
        // Get group metadata to access all participants
        const groupMetadata = await sock.groupMetadata(groupId);
        
        if (!groupMetadata || !groupMetadata.participants || groupMetadata.participants.length === 0) {
            return {
                success: false,
                message: "No group members found or failed to fetch group metadata."
            };
        }
        
        // Get the group name for the file name
        const groupName = groupMetadata.subject || "WhatsApp Group";
        const sanitizedGroupName = groupName.replace(/[^a-zA-Z0-9]/g, "_");
        
        // Start building the vCard content
        let vCardContent = '';
        const members = [];
        
        // Process each participant
        for (const participant of groupMetadata.participants) {
            // Extract the phone number from the JID
            const jid = participant.id;
            const phoneNumber = jid.split('@')[0];
            
            // Skip numbers that don't look valid
            if (!phoneNumber || phoneNumber.length < 7) continue;
            
            // Get contact name if available
            let contactName = '';
            try {
                // Try to get the contact's actual name from WhatsApp
                const contact = await sock.getContact(jid);
                contactName = contact?.name || contact?.notify || phoneNumber;
            } catch (error) {
                // If we can't get the name, use the phone number
                contactName = phoneNumber;
            }
            
            // Add to the list of members
            members.push({
                phoneNumber,
                name: contactName
            });
            
            // Create vCard entry for this contact
            vCardContent += 'BEGIN:VCARD\r\n';
            vCardContent += 'VERSION:3.0\r\n';
            vCardContent += `FN:${contactName}\r\n`;
            vCardContent += `TEL;type=CELL:+${phoneNumber}\r\n`;
            vCardContent += 'END:VCARD\r\n';
        }
        
        // Convert the vCard content to a buffer
        const vCardBuffer = Buffer.from(vCardContent, 'utf-8');
        
        return {
            success: true,
            vCardBuffer,
            fileName: `${sanitizedGroupName}_contacts.vcf`,
            memberCount: members.length,
            members
        };
    } catch (error) {
        console.error('Error generating group members vCard:', error);
        return {
            success: false,
            message: error.message,
            error
        };
    }
}

module.exports = {
    saveAllGroupMembers,
    addAllContactsToGroup,
    tagAllGroupMembers,
    processNextContactBatch,
    addSpecificNumbersToGroup,
    scheduleRandomContactAddition,
    processNextRandomContact,
    generateGroupMembersVCard
};
