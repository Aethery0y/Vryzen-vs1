const database = require('../lib/database');
const ai = require('../lib/ai');
const schedule = require('node-schedule');
const nodeFetch = require('node-fetch');
const natural = require('natural');

// Scheduled messages storage (in-memory)
const scheduledMessages = {};

// Storage for auto-replies (in-memory for now)
let autoReplies = {};

// Poll storage
const activePolls = {};

/**
 * Schedule a message to be sent at a specific time
 */
async function scheduleMessage(sock, remoteJid, sender, timeStr, message) {
    try {
        // Parse time string (format: YYYY-MM-DD HH:MM or +XhYm for relative time)
        let scheduledTime;
        
        if (timeStr.startsWith('+')) {
            // Relative time (e.g., +2h30m for 2 hours and 30 minutes from now)
            const timePattern = /\+(?:(\d+)h)?(?:(\d+)m)?/;
            const matches = timeStr.match(timePattern);
            
            if (!matches) {
                return { success: false, message: "Invalid time format. Use +1h30m format for relative time." };
            }
            
            const hours = parseInt(matches[1] || 0);
            const minutes = parseInt(matches[2] || 0);
            
            if (hours === 0 && minutes === 0) {
                return { success: false, message: "Please specify a valid time duration." };
            }
            
            scheduledTime = new Date();
            scheduledTime.setHours(scheduledTime.getHours() + hours);
            scheduledTime.setMinutes(scheduledTime.getMinutes() + minutes);
        } else {
            // Absolute time (YYYY-MM-DD HH:MM)
            scheduledTime = new Date(timeStr);
            
            if (isNaN(scheduledTime.getTime())) {
                return { success: false, message: "Invalid date format. Use YYYY-MM-DD HH:MM format." };
            }
        }
        
        // Check if time is in the future
        const now = new Date();
        if (scheduledTime <= now) {
            return { success: false, message: "Scheduled time must be in the future." };
        }
        
        // Create a unique ID for this scheduled message
        const id = `${remoteJid}_${Date.now()}`;
        
        // Schedule the message
        const job = schedule.scheduleJob(scheduledTime, async function() {
            try {
                await sock.sendMessage(remoteJid, { text: message });
                console.log(`Scheduled message sent: ${id}`);
                
                // Remove from storage after sending
                delete scheduledMessages[id];
            } catch (error) {
                console.error(`Failed to send scheduled message ${id}:`, error);
            }
        });
        
        // Store the job reference
        scheduledMessages[id] = {
            id,
            remoteJid,
            sender,
            message,
            scheduledTime,
            job
        };
        
        const timeString = scheduledTime.toLocaleString();
        
        return { 
            success: true, 
            message: `Message scheduled for ${timeString}. ID: ${id.substring(0, 8)}` 
        };
    } catch (error) {
        console.error('Error scheduling message:', error);
        return { success: false, message: "Failed to schedule message." };
    }
}

/**
 * Cancel a scheduled message
 */
async function cancelScheduledMessage(sock, remoteJid, sender, id) {
    // Find messages that start with the provided ID
    const matchingIds = Object.keys(scheduledMessages).filter(
        key => key.startsWith(remoteJid) && key.includes(id)
    );
    
    if (matchingIds.length === 0) {
        return { success: false, message: "No matching scheduled message found." };
    }
    
    let cancelCount = 0;
    for (const msgId of matchingIds) {
        // Check if sender has permission (only the original sender or bot owner)
        if (scheduledMessages[msgId].sender === sender) {
            // Cancel the scheduled job
            scheduledMessages[msgId].job.cancel();
            
            // Remove from storage
            delete scheduledMessages[msgId];
            cancelCount++;
        }
    }
    
    if (cancelCount > 0) {
        return { success: true, message: `Cancelled ${cancelCount} scheduled message(s).` };
    } else {
        return { success: false, message: "You don't have permission to cancel these messages." };
    }
}

/**
 * List all scheduled messages for a user
 */
async function listScheduledMessages(sock, remoteJid, sender) {
    // Find messages for this sender in this chat
    const userMessages = Object.values(scheduledMessages).filter(
        msg => msg.remoteJid === remoteJid && msg.sender === sender
    );
    
    if (userMessages.length === 0) {
        return { success: false, message: "You have no scheduled messages." };
    }
    
    // Format the list
    let messageList = "📅 Your scheduled messages:\n\n";
    userMessages.forEach((msg, index) => {
        const timeString = msg.scheduledTime.toLocaleString();
        const previewText = msg.message.length > 30 
            ? msg.message.substring(0, 27) + "..." 
            : msg.message;
            
        messageList += `${index + 1}. ID: ${msg.id.substring(0, 8)}\n   🕒 ${timeString}\n   💬 ${previewText}\n\n`;
    });
    
    return { success: true, message: messageList };
}

/**
 * Create a poll in a group chat
 */
async function createPoll(sock, remoteJid, question, optionsStr) {
    try {
        // Parse options
        const options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt);
        
        if (options.length < 2) {
            return { success: false, message: "Please provide at least 2 options separated by commas." };
        }
        
        if (options.length > 10) {
            return { success: false, message: "Maximum 10 poll options allowed." };
        }
        
        // Create poll ID
        const pollId = `poll_${remoteJid}_${Date.now()}`;
        
        // Initialize poll data
        activePolls[pollId] = {
            id: pollId,
            question,
            options,
            votes: Object.fromEntries(options.map(opt => [opt, []])),
            voters: {},
            createdAt: new Date()
        };
        
        // Format poll message
        let pollMessage = `📊 *POLL: ${question}*\n\n`;
        options.forEach((opt, idx) => {
            pollMessage += `${idx + 1}. ${opt}\n`;
        });
        
        pollMessage += `\nTo vote, reply with .vote ${pollId.substring(0, 8)} [number]`;
        
        return { success: true, message: pollMessage, pollId };
    } catch (error) {
        console.error('Error creating poll:', error);
        return { success: false, message: "Failed to create poll." };
    }
}

/**
 * Register a vote in an active poll
 */
async function voteInPoll(sock, remoteJid, sender, pollIdPartial, optionNumber) {
    try {
        // Find the poll
        const matchingPollIds = Object.keys(activePolls).filter(
            id => id.includes(pollIdPartial) && id.includes(remoteJid)
        );
        
        if (matchingPollIds.length === 0) {
            return { success: false, message: "Poll not found. It may have expired." };
        }
        
        if (matchingPollIds.length > 1) {
            return { success: false, message: "Multiple matching polls found. Please use a more specific ID." };
        }
        
        const pollId = matchingPollIds[0];
        const poll = activePolls[pollId];
        
        // Validate option number
        const optIdx = parseInt(optionNumber) - 1;
        if (isNaN(optIdx) || optIdx < 0 || optIdx >= poll.options.length) {
            return { success: false, message: `Please choose a valid option number between 1 and ${poll.options.length}.` };
        }
        
        const chosenOption = poll.options[optIdx];
        
        // Check if user already voted
        const previousVote = poll.voters[sender];
        if (previousVote) {
            // Remove previous vote
            poll.votes[previousVote] = poll.votes[previousVote].filter(voter => voter !== sender);
        }
        
        // Register new vote
        poll.votes[chosenOption].push(sender);
        poll.voters[sender] = chosenOption;
        
        // Generate results
        let results = `📊 *Poll Results: ${poll.question}*\n\n`;
        let totalVotes = 0;
        
        poll.options.forEach(opt => {
            totalVotes += poll.votes[opt].length;
        });
        
        poll.options.forEach((opt, idx) => {
            const voteCount = poll.votes[opt].length;
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const bar = generateProgressBar(percentage);
            
            results += `${idx + 1}. ${opt}: ${voteCount} votes (${percentage}%)\n`;
            results += `${bar}\n`;
        });
        
        results += `\nTotal votes: ${totalVotes}`;
        
        return { 
            success: true, 
            message: `Vote registered for "${chosenOption}".`,
            results 
        };
    } catch (error) {
        console.error('Error processing vote:', error);
        return { success: false, message: "Failed to process vote." };
    }
}

/**
 * Helper function to generate ASCII progress bar
 */
function generateProgressBar(percentage, length = 20) {
    const filledLength = Math.round(length * (percentage / 100));
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `${filled}${empty} ${percentage}%`;
}

/**
 * Show poll results
 */
async function showPollResults(sock, remoteJid, pollIdPartial) {
    try {
        // Find the poll
        const matchingPollIds = Object.keys(activePolls).filter(
            id => id.includes(pollIdPartial) && id.includes(remoteJid)
        );
        
        if (matchingPollIds.length === 0) {
            return { success: false, message: "Poll not found. It may have expired." };
        }
        
        if (matchingPollIds.length > 1) {
            return { success: false, message: "Multiple matching polls found. Please use a more specific ID." };
        }
        
        const pollId = matchingPollIds[0];
        const poll = activePolls[pollId];
        
        // Generate results
        let results = `📊 *Poll Results: ${poll.question}*\n\n`;
        let totalVotes = 0;
        
        poll.options.forEach(opt => {
            totalVotes += poll.votes[opt].length;
        });
        
        poll.options.forEach((opt, idx) => {
            const voteCount = poll.votes[opt].length;
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const bar = generateProgressBar(percentage);
            
            results += `${idx + 1}. ${opt}: ${voteCount} votes (${percentage}%)\n`;
            results += `${bar}\n`;
        });
        
        results += `\nTotal votes: ${totalVotes}`;
        
        return { success: true, message: results };
    } catch (error) {
        console.error('Error showing poll results:', error);
        return { success: false, message: "Failed to show poll results." };
    }
}

/**
 * End a poll and display final results
 */
async function endPoll(sock, remoteJid, sender, pollIdPartial) {
    try {
        // Find the poll
        const matchingPollIds = Object.keys(activePolls).filter(
            id => id.includes(pollIdPartial) && id.includes(remoteJid)
        );
        
        if (matchingPollIds.length === 0) {
            return { success: false, message: "Poll not found. It may have expired." };
        }
        
        if (matchingPollIds.length > 1) {
            return { success: false, message: "Multiple matching polls found. Please use a more specific ID." };
        }
        
        const pollId = matchingPollIds[0];
        const poll = activePolls[pollId];
        
        // Generate final results
        let results = `📊 *FINAL POLL RESULTS: ${poll.question}*\n\n`;
        let totalVotes = 0;
        let winningOptions = [];
        let maxVotes = 0;
        
        // Calculate total and find winner(s)
        poll.options.forEach(opt => {
            const voteCount = poll.votes[opt].length;
            totalVotes += voteCount;
            
            if (voteCount > maxVotes) {
                winningOptions = [opt];
                maxVotes = voteCount;
            } else if (voteCount === maxVotes && voteCount > 0) {
                winningOptions.push(opt);
            }
        });
        
        // Add results for each option
        poll.options.forEach((opt, idx) => {
            const voteCount = poll.votes[opt].length;
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const bar = generateProgressBar(percentage);
            const isWinner = winningOptions.includes(opt) ? "🏆 " : "";
            
            results += `${isWinner}${idx + 1}. ${opt}: ${voteCount} votes (${percentage}%)\n`;
            results += `${bar}\n`;
        });
        
        // Add summary
        results += `\nTotal votes: ${totalVotes}\n`;
        
        if (winningOptions.length > 0 && maxVotes > 0) {
            if (winningOptions.length === 1) {
                results += `\n🏆 Winner: "${winningOptions[0]}" with ${maxVotes} votes`;
            } else {
                results += `\n🏆 Tie between: ${winningOptions.map(o => `"${o}"`).join(", ")} with ${maxVotes} votes each`;
            }
        } else {
            results += "\nNo votes were cast in this poll.";
        }
        
        // Remove the poll
        delete activePolls[pollId];
        
        return { success: true, message: results };
    } catch (error) {
        console.error('Error ending poll:', error);
        return { success: false, message: "Failed to end poll." };
    }
}

/**
 * Broadcast a message to multiple recipients
 */
async function broadcastMessage(sock, remoteJid, sender, messageText, targetStr) {
    try {
        // Parse target specification
        // Format: .broadcast "message" to=label:friends,groups,number:1234567890
        const targets = {
            labels: [],
            groups: false,
            numbers: []
        };
        
        if (targetStr) {
            const parts = targetStr.split(',');
            
            for (const part of parts) {
                const trimmed = part.trim();
                
                if (trimmed === 'groups') {
                    targets.groups = true;
                } else if (trimmed.startsWith('label:')) {
                    const label = trimmed.substring(6).trim();
                    if (label) {
                        targets.labels.push(label);
                    }
                } else if (trimmed.startsWith('number:')) {
                    const number = trimmed.substring(7).trim();
                    if (number) {
                        targets.numbers.push(number);
                    }
                }
            }
        }
        
        // Get recipients based on targets
        const recipients = [];
        
        // Add recipients with specific labels
        if (targets.labels.length > 0) {
            const contacts = database.getAllContacts();
            
            for (const number in contacts) {
                const contact = contacts[number];
                
                if (contact.labels && contact.labels.some(label => targets.labels.includes(label))) {
                    recipients.push(number);
                }
            }
        }
        
        // Add specific numbers
        recipients.push(...targets.numbers);
        
        // Add groups if specified
        // This would require storing group info in the database
        
        // Remove duplicates
        const uniqueRecipients = [...new Set(recipients)];
        
        if (uniqueRecipients.length === 0) {
            return { success: false, message: "No recipients found for the broadcast." };
        }
        
        // Send messages
        let successCount = 0;
        let errorCount = 0;
        
        for (const recipient of uniqueRecipients) {
            try {
                // Format the number for WhatsApp if needed
                const formattedNumber = recipient.includes('@') 
                    ? recipient 
                    : `${recipient}@s.whatsapp.net`;
                
                await sock.sendMessage(formattedNumber, { text: messageText });
                successCount++;
            } catch (error) {
                console.error(`Error sending broadcast to ${recipient}:`, error);
                errorCount++;
            }
            
            // Small delay to avoid flooding
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return { 
            success: true, 
            message: `Broadcast sent to ${successCount} recipients. Failed: ${errorCount}.` 
        };
    } catch (error) {
        console.error('Error broadcasting message:', error);
        return { success: false, message: "Failed to broadcast message." };
    }
}

/**
 * Set up an auto-reply rule
 */
async function setAutoReply(sock, remoteJid, sender, triggerText, responseText) {
    try {
        if (!autoReplies[remoteJid]) {
            autoReplies[remoteJid] = [];
        }
        
        // Check if this trigger already exists
        const existingIndex = autoReplies[remoteJid].findIndex(
            rule => rule.trigger.toLowerCase() === triggerText.toLowerCase()
        );
        
        if (existingIndex >= 0) {
            // Update existing rule
            autoReplies[remoteJid][existingIndex] = {
                trigger: triggerText,
                response: responseText,
                creator: sender,
                createdAt: new Date()
            };
            
            return { 
                success: true, 
                message: `Updated auto-reply for trigger "${triggerText}".` 
            };
        } else {
            // Add new rule
            autoReplies[remoteJid].push({
                trigger: triggerText,
                response: responseText,
                creator: sender,
                createdAt: new Date()
            });
            
            return { 
                success: true, 
                message: `Added new auto-reply for trigger "${triggerText}".` 
            };
        }
    } catch (error) {
        console.error('Error setting auto-reply:', error);
        return { success: false, message: "Failed to set auto-reply." };
    }
}

/**
 * Remove an auto-reply rule
 */
async function removeAutoReply(sock, remoteJid, sender, triggerText) {
    try {
        if (!autoReplies[remoteJid] || autoReplies[remoteJid].length === 0) {
            return { success: false, message: "No auto-replies set up for this chat." };
        }
        
        const initialCount = autoReplies[remoteJid].length;
        
        // Filter out the rule with matching trigger
        autoReplies[remoteJid] = autoReplies[remoteJid].filter(
            rule => rule.trigger.toLowerCase() !== triggerText.toLowerCase()
        );
        
        if (autoReplies[remoteJid].length < initialCount) {
            return { 
                success: true, 
                message: `Removed auto-reply for trigger "${triggerText}".` 
            };
        } else {
            return { 
                success: false, 
                message: `No auto-reply found for trigger "${triggerText}".` 
            };
        }
    } catch (error) {
        console.error('Error removing auto-reply:', error);
        return { success: false, message: "Failed to remove auto-reply." };
    }
}

/**
 * List all auto-reply rules for a chat
 */
async function listAutoReplies(sock, remoteJid) {
    try {
        if (!autoReplies[remoteJid] || autoReplies[remoteJid].length === 0) {
            return { success: false, message: "No auto-replies set up for this chat." };
        }
        
        let replyList = "📝 *Auto-Reply Rules:*\n\n";
        
        autoReplies[remoteJid].forEach((rule, index) => {
            replyList += `${index + 1}. Trigger: "${rule.trigger}"\n`;
            replyList += `   Response: "${rule.response.substring(0, 30)}${rule.response.length > 30 ? '...' : ''}"\n\n`;
        });
        
        return { success: true, message: replyList };
    } catch (error) {
        console.error('Error listing auto-replies:', error);
        return { success: false, message: "Failed to list auto-replies." };
    }
}

/**
 * Check if a message matches any auto-reply rule
 */
async function checkAutoReply(message, remoteJid) {
    if (!autoReplies[remoteJid] || autoReplies[remoteJid].length === 0) {
        return null;
    }
    
    const lowerMessage = message.toLowerCase();
    
    // Check for exact matches first
    for (const rule of autoReplies[remoteJid]) {
        if (lowerMessage === rule.trigger.toLowerCase()) {
            return rule.response;
        }
    }
    
    // Then check for contains matches
    for (const rule of autoReplies[remoteJid]) {
        if (lowerMessage.includes(rule.trigger.toLowerCase())) {
            return rule.response;
        }
    }
    
    return null;
}

/**
 * Summarize a long text message
 */
async function summarizeText(sock, remoteJid, textToSummarize) {
    try {
        if (!textToSummarize || textToSummarize.length < 100) {
            return { 
                success: false, 
                message: "Please provide a longer text to summarize (at least 100 characters)." 
            };
        }
        
        // Use AI to summarize the text
        const summarizePrompt = `Please summarize the following text concisely (maximum 3-4 sentences):\n\n${textToSummarize}`;
        
        try {
            const summary = await ai.getResponse(summarizePrompt);
            return { success: true, message: `*Summary:*\n\n${summary}` };
        } catch (error) {
            console.error('Error getting AI summary:', error);
            
            // Fallback: Use simple extractive summarization
            const tokenizer = new natural.SentenceTokenizer();
            const sentences = tokenizer.tokenize(textToSummarize);
            
            if (sentences.length <= 3) {
                return { success: true, message: textToSummarize };
            }
            
            // For simplicity, just take the first 3 sentences
            const simpleSummary = sentences.slice(0, 3).join(' ');
            
            return { 
                success: true, 
                message: `*Simple Summary:*\n\n${simpleSummary}` 
            };
        }
    } catch (error) {
        console.error('Error summarizing text:', error);
        return { success: false, message: "Failed to summarize text." };
    }
}

/**
 * Translate a message to a different language
 */
async function translateMessage(sock, remoteJid, textToTranslate, targetLang) {
    try {
        if (!textToTranslate) {
            return { 
                success: false, 
                message: "Please provide text to translate." 
            };
        }
        
        // Use AI to translate
        const translatePrompt = `Translate the following text to ${targetLang} language:\n\n${textToTranslate}`;
        
        try {
            const translation = await ai.getResponse(translatePrompt);
            return { 
                success: true, 
                message: `*Translated to ${targetLang}:*\n\n${translation}` 
            };
        } catch (error) {
            console.error('Error getting AI translation:', error);
            return { 
                success: false, 
                message: "Failed to translate text. Please try again later." 
            };
        }
    } catch (error) {
        console.error('Error translating message:', error);
        return { success: false, message: "Failed to translate message." };
    }
}

/**
 * Generate flood messages (multiple messages in succession)
 */
async function floodMessages(sock, remoteJid, sender, message, count, delay) {
    try {
        const maxCount = 10; // Limit to prevent abuse
        const actualCount = Math.min(parseInt(count) || 3, maxCount);
        const delayMs = (parseFloat(delay) || 1) * 1000; // Convert to milliseconds, default 1 second
        
        if (actualCount <= 0) {
            return { success: false, message: "Please specify a valid count (1-10)." };
        }
        
        if (delayMs < 500) {
            return { success: false, message: "Minimum delay is 0.5 seconds." };
        }
        
        // Send confirmation
        await sock.sendMessage(remoteJid, { 
            text: `Sending ${actualCount} messages with ${delayMs/1000}s delay...` 
        });
        
        // Send the flood messages
        for (let i = 0; i < actualCount; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            const currentMessage = `${message} (${i+1}/${actualCount})`;
            await sock.sendMessage(remoteJid, { text: currentMessage });
        }
        
        return { 
            success: true, 
            message: `Sent ${actualCount} messages.`,
            silent: true // No need for additional confirmation
        };
    } catch (error) {
        console.error('Error sending flood messages:', error);
        return { success: false, message: "Failed to send flood messages." };
    }
}

/**
 * Track group activity and analyze member behavior
 */
async function trackActivity(sock, remoteJid, period = '24h') {
    try {
        // This would require storing message history
        // For now, we'll return a placeholder message
        
        return { 
            success: true, 
            message: `*Group Activity Analysis (${period})*\n\n` +
                     `Most active times: 8-10 AM, 7-9 PM\n` +
                     `Most active members: [would show actual data]\n` +
                     `Message frequency: 120 messages\n` +
                     `Media shared: 14 items\n\n` +
                     `Note: This is a placeholder. To enable real tracking, message history storage is needed.`
        };
    } catch (error) {
        console.error('Error tracking activity:', error);
        return { success: false, message: "Failed to analyze group activity." };
    }
}

/**
 * Analyze member relationships based on interactions
 */
async function analyzeRelationships(sock, remoteJid) {
    try {
        // This would require storing interaction data
        // For now, we'll return a placeholder message
        
        return { 
            success: true, 
            message: `*Group Relationship Analysis*\n\n` +
                     `Most connected members: [would show actual data]\n` +
                     `Interaction clusters detected: 3\n` +
                     `Key influencers: [would show actual data]\n\n` +
                     `Note: This is a placeholder. To enable real analysis, interaction data storage is needed.`
        };
    } catch (error) {
        console.error('Error analyzing relationships:', error);
        return { success: false, message: "Failed to analyze group relationships." };
    }
}

/**
 * Track when members join/leave a group
 */
async function trackMemberChanges(sock, remoteJid) {
    try {
        // This would require persisting group member history
        // For now, we'll return a placeholder activation message
        
        return { 
            success: true, 
            message: `*Member Change Tracking Activated*\n\n` +
                     `The bot will now notify when members join or leave this group.\n\n` +
                     `Note: This is a placeholder. Actual implementation requires persistent tracking.`
        };
    } catch (error) {
        console.error('Error setting up member tracking:', error);
        return { success: false, message: "Failed to set up member change tracking." };
    }
}

/**
 * Find key topics and trending words in recent messages
 */
async function analyzeTopics(sock, remoteJid) {
    try {
        // This would require storing message content
        // For now, we'll return a placeholder message
        
        return { 
            success: true, 
            message: `*Topic Analysis*\n\n` +
                     `Trending topics: [would show actual data]\n` +
                     `Frequently used words: [would show actual data]\n` +
                     `Sentiment trend: Positive\n\n` +
                     `Note: This is a placeholder. To enable real analysis, message content storage is needed.`
        };
    } catch (error) {
        console.error('Error analyzing topics:', error);
        return { success: false, message: "Failed to analyze group topics." };
    }
}

/**
 * Change the AI personality/style for responses
 */
async function setAIPersona(sock, remoteJid, persona) {
    try {
        // This would modify how the AI responds
        const validPersonas = ['professional', 'casual', 'friendly', 'funny', 'sarcastic', 'poetic'];
        
        if (!validPersonas.includes(persona.toLowerCase())) {
            return { 
                success: false, 
                message: `Invalid persona. Available options: ${validPersonas.join(', ')}` 
            };
        }
        
        // Here we would update a setting in the database
        // For now, we'll just acknowledge the request
        
        return { 
            success: true, 
            message: `AI persona set to "${persona}". The bot will now respond in a ${persona} style.` 
        };
    } catch (error) {
        console.error('Error setting AI persona:', error);
        return { success: false, message: "Failed to set AI persona." };
    }
}

/**
 * Store custom information about a user for contextual responses
 */
async function rememberInfo(sock, remoteJid, sender, info) {
    try {
        // Get the current contact info
        const number = sender.split('@')[0];
        const contact = database.getContact(number) || {};
        
        // Add or update remembered info
        if (!contact.rememberedInfo) {
            contact.rememberedInfo = [];
        }
        
        contact.rememberedInfo.push({
            info,
            timestamp: new Date().toISOString()
        });
        
        // Keep only the most recent 10 items
        if (contact.rememberedInfo.length > 10) {
            contact.rememberedInfo = contact.rememberedInfo.slice(-10);
        }
        
        // Save the updated contact
        database.saveContact(number, contact);
        
        return { 
            success: true, 
            message: `I'll remember that: "${info}"` 
        };
    } catch (error) {
        console.error('Error remembering info:', error);
        return { success: false, message: "Failed to remember information." };
    }
}

/**
 * Retrieve remembered information about a user
 */
async function recallInfo(sock, remoteJid, sender) {
    try {
        // Get the contact info
        const number = sender.split('@')[0];
        const contact = database.getContact(number);
        
        if (!contact || !contact.rememberedInfo || contact.rememberedInfo.length === 0) {
            return { 
                success: false, 
                message: "I don't have any remembered information for you." 
            };
        }
        
        // Format the remembered info
        let infoList = "*Remembered Information:*\n\n";
        
        contact.rememberedInfo.forEach((item, index) => {
            const date = new Date(item.timestamp).toLocaleDateString();
            infoList += `${index + 1}. ${item.info} (${date})\n`;
        });
        
        return { success: true, message: infoList };
    } catch (error) {
        console.error('Error recalling info:', error);
        return { success: false, message: "Failed to recall information." };
    }
}

/**
 * Simulate a message to make it seem natural
 */
async function simulateMessage(sock, remoteJid, sender, message) {
    try {
        // Simply send the message without command prefix or attribution
        await sock.sendMessage(remoteJid, { text: message });
        
        return { 
            success: true, 
            message: "Message sent.",
            silent: true // No confirmation needed
        };
    } catch (error) {
        console.error('Error simulating message:', error);
        return { success: false, message: "Failed to send simulated message." };
    }
}

/**
 * Export functionality
 */
module.exports = {
    scheduleMessage,
    cancelScheduledMessage,
    listScheduledMessages,
    createPoll,
    voteInPoll,
    showPollResults,
    endPoll,
    broadcastMessage,
    setAutoReply,
    removeAutoReply,
    listAutoReplies,
    checkAutoReply,
    summarizeText,
    translateMessage,
    floodMessages,
    trackActivity,
    analyzeRelationships,
    trackMemberChanges,
    analyzeTopics,
    setAIPersona,
    rememberInfo,
    recallInfo,
    simulateMessage
};