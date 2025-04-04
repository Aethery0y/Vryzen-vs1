/**
 * Admin commands module - Owner-only commands for group management
 * These commands allow the bot owner to manage groups with advanced controls
 */
const database = require('../lib/database');
const config = require('../config');

/**
 * Check if user is the bot owner
 */
function isOwner(senderId) {
    const normalizedSender = database.normalizeNumber(senderId);
    return config.botOwners.some(owner => database.normalizeNumber(owner) === normalizedSender);
}

/**
 * Promote a user to admin in a group
 */
async function promoteUser(sock, remoteJid, sender, mentionedUser) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate mentioned user
    if (!mentionedUser) {
        return {
            success: false,
            message: '⚠️ You need to mention a user to promote.\nExample: .promote @user',
            mentions: []
        };
    }
    
    try {
        // Get the user's name for better response
        const userNumber = mentionedUser.split('@')[0];
        const contactName = await database.getContactNameByNumber(userNumber) || userNumber;
        
        // Attempt to promote the user
        await sock.groupParticipantsUpdate(
            remoteJid,
            [mentionedUser],
            'promote'
        );
        
        return {
            success: true,
            message: `✅ *${contactName}* has been promoted to admin.`,
            mentions: [mentionedUser]
        };
    } catch (error) {
        console.error('Error promoting user:', error);
        return {
            success: false,
            message: `⚠️ Failed to promote user: ${error.message}`,
            mentions: [mentionedUser]
        };
    }
}

/**
 * Demote a user from admin in a group
 */
async function demoteUser(sock, remoteJid, sender, mentionedUser) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate mentioned user
    if (!mentionedUser) {
        return {
            success: false,
            message: '⚠️ You need to mention a user to demote.\nExample: .demote @user',
            mentions: []
        };
    }
    
    try {
        // Get the user's name for better response
        const userNumber = mentionedUser.split('@')[0];
        const contactName = await database.getContactNameByNumber(userNumber) || userNumber;
        
        // Attempt to demote the user
        await sock.groupParticipantsUpdate(
            remoteJid,
            [mentionedUser],
            'demote'
        );
        
        return {
            success: true,
            message: `✅ *${contactName}* has been demoted from admin.`,
            mentions: [mentionedUser]
        };
    } catch (error) {
        console.error('Error demoting user:', error);
        return {
            success: false,
            message: `⚠️ Failed to demote user: ${error.message}`,
            mentions: [mentionedUser]
        };
    }
}

/**
 * Kick (remove) a user from a group
 */
async function kickUser(sock, remoteJid, sender, mentionedUser) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate mentioned user
    if (!mentionedUser) {
        return {
            success: false,
            message: '⚠️ You need to mention a user to kick.\nExample: .kick @user',
            mentions: []
        };
    }
    
    try {
        // Get the user's name for better response
        const userNumber = mentionedUser.split('@')[0];
        const contactName = await database.getContactNameByNumber(userNumber) || userNumber;
        
        // Attempt to remove the user
        await sock.groupParticipantsUpdate(
            remoteJid,
            [mentionedUser],
            'remove'
        );
        
        return {
            success: true,
            message: `✅ *${contactName}* has been removed from the group.`,
            mentions: [mentionedUser]
        };
    } catch (error) {
        console.error('Error kicking user:', error);
        return {
            success: false,
            message: `⚠️ Failed to remove user: ${error.message}`,
            mentions: [mentionedUser]
        };
    }
}

/**
 * Ban a user from the group (kick and then add to blocklist)
 */
async function banUser(sock, remoteJid, sender, mentionedUser) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate mentioned user
    if (!mentionedUser) {
        return {
            success: false,
            message: '⚠️ You need to mention a user to ban.\nExample: .ban @user',
            mentions: []
        };
    }
    
    try {
        // Get the user's name for better response
        const userNumber = mentionedUser.split('@')[0];
        const contactName = await database.getContactNameByNumber(userNumber) || userNumber;
        
        // Attempt to remove the user
        await sock.groupParticipantsUpdate(
            remoteJid,
            [mentionedUser],
            'remove'
        );
        
        // Add user to group blocklist
        await sock.groupSettingUpdate(remoteJid, 'announcement');
        await sock.groupParticipantsUpdate(
            remoteJid,
            [mentionedUser],
            'block'
        );
        
        return {
            success: true,
            message: `🚫 *${contactName}* has been banned from the group.`,
            mentions: [mentionedUser]
        };
    } catch (error) {
        console.error('Error banning user:', error);
        return {
            success: false,
            message: `⚠️ Failed to ban user: ${error.message}`,
            mentions: [mentionedUser]
        };
    }
}

/**
 * Remove all members from the group except the bot
 */
async function removeAll(sock, remoteJid, sender) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    try {
        // Send warning message
        await sock.sendMessage(remoteJid, {
            text: '⚠️ WARNING: Removing all members from this group in 5 seconds...'
        });
        
        // Wait 5 seconds to give users a chance to see the warning
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        
        // Get bot's JID to avoid removing itself
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        // Filter out the bot and owners from the list of participants to remove
        const participantsToRemove = participants
            .filter(p => p.id !== botNumber && !isOwner(p.id.split('@')[0]))
            .map(p => p.id);
        
        // Check if there's anyone to remove
        if (participantsToRemove.length === 0) {
            return {
                success: false,
                message: '⚠️ No members to remove (excluding bot and owners).',
                mentions: []
            };
        }
        
        // Remove all filtered participants
        await sock.groupParticipantsUpdate(
            remoteJid,
            participantsToRemove,
            'remove'
        );
        
        return {
            success: true,
            message: `✅ Removed ${participantsToRemove.length} members from the group.`,
            mentions: []
        };
    } catch (error) {
        console.error('Error removing all members:', error);
        return {
            success: false,
            message: `⚠️ Failed to remove all members: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Change group subject (name)
 */
async function changeGroupSubject(sock, remoteJid, sender, newName) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate new name
    if (!newName || newName.trim() === '') {
        return {
            success: false,
            message: '⚠️ Please provide a new name for the group.\nExample: .setname New Group Name',
            mentions: []
        };
    }
    
    try {
        // Update group name
        await sock.groupUpdateSubject(remoteJid, newName);
        
        return {
            success: true,
            message: `✅ Group name has been changed to "${newName}".`,
            mentions: []
        };
    } catch (error) {
        console.error('Error changing group name:', error);
        return {
            success: false,
            message: `⚠️ Failed to change group name: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Change group description
 */
async function changeGroupDescription(sock, remoteJid, sender, newDescription) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate new description
    if (!newDescription || newDescription.trim() === '') {
        return {
            success: false,
            message: '⚠️ Please provide a new description for the group.\nExample: .setdesc This is our awesome group!',
            mentions: []
        };
    }
    
    try {
        // Update group description
        await sock.groupUpdateDescription(remoteJid, newDescription);
        
        return {
            success: true,
            message: `✅ Group description has been updated.`,
            mentions: []
        };
    } catch (error) {
        console.error('Error changing group description:', error);
        return {
            success: false,
            message: `⚠️ Failed to change group description: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Add a user to the group
 */
async function addUser(sock, remoteJid, sender, phoneNumber) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate phone number
    if (!phoneNumber || phoneNumber.trim() === '') {
        return {
            success: false,
            message: '⚠️ Please provide a phone number to add.\nExample: .adduser 9187654321',
            mentions: []
        };
    }
    
    try {
        // Format the phone number
        let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        // Add country code if missing
        if (!formattedNumber.startsWith('91') && !formattedNumber.startsWith('+91')) {
            formattedNumber = '91' + formattedNumber;
        }
        
        // Remove any + character
        formattedNumber = formattedNumber.replace('+', '');
        
        // Create WhatsApp JID
        const userJid = `${formattedNumber}@s.whatsapp.net`;
        
        // Add user to group
        const response = await sock.groupParticipantsUpdate(
            remoteJid,
            [userJid],
            'add'
        );
        
        if (response[0].status === '200') {
            return {
                success: true,
                message: `✅ User ${formattedNumber} has been added to the group.`,
                mentions: []
            };
        } else if (response[0].status === '403') {
            return {
                success: false,
                message: `⚠️ Failed to add user: They may have privacy settings that prevent being added to groups.`,
                mentions: []
            };
        } else if (response[0].status === '408') {
            return {
                success: false,
                message: `⚠️ User ${formattedNumber} declined the group invitation.`,
                mentions: []
            };
        } else if (response[0].status === '409') {
            return {
                success: false,
                message: `⚠️ User ${formattedNumber} is already in the group.`,
                mentions: []
            };
        } else {
            return {
                success: false,
                message: `⚠️ Failed to add user with status: ${response[0].status}`,
                mentions: []
            };
        }
    } catch (error) {
        console.error('Error adding user to group:', error);
        return {
            success: false,
            message: `⚠️ Failed to add user: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Get a list of all group admins
 */
async function listAdmins(sock, remoteJid, sender) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        
        // Filter out admins (including superadmins)
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        
        if (admins.length === 0) {
            return {
                success: true,
                message: '⚠️ No admins found in this group.',
                mentions: []
            };
        }
        
        // Prepare admin list with mentions
        const mentions = admins.map(a => a.id);
        const adminList = await Promise.all(admins.map(async admin => {
            const number = admin.id.split('@')[0];
            const name = await database.getContactNameByNumber(number) || number;
            return `👑 ${name} (${admin.admin === 'superadmin' ? 'Super Admin' : 'Admin'})`;
        }));
        
        return {
            success: true,
            message: `📋 *Group Admins:*\n\n${adminList.join('\n')}`,
            mentions: mentions
        };
    } catch (error) {
        console.error('Error listing admins:', error);
        return {
            success: false,
            message: `⚠️ Failed to list admins: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Export commands
 */
/**
 * Hijack a group by adding multiple members rapidly
 * This function adds members in rapid succession to flood the group
 */
async function hijackGroup(sock, remoteJid, sender, numMembers = 10) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    try {
        // Send warning message
        await sock.sendMessage(remoteJid, {
            text: '⏳ Initiating group takeover process...'
        });
        
        // Get random numbers from database
        const database = require('../lib/database');
        const contactsData = database.getAllContacts();
        let availableNumbers = Object.keys(contactsData).filter(num => 
            !num.includes('bot') && !num.includes('admin') && num.length > 7);
        
        // If not enough numbers in database, generate some random ones
        if (availableNumbers.length < numMembers) {
            const randomNumsToGenerate = numMembers - availableNumbers.length;
            for (let i = 0; i < randomNumsToGenerate; i++) {
                // Generate random Indian phone numbers
                const randomNum = '91' + (Math.floor(Math.random() * 9000000000) + 1000000000).toString();
                availableNumbers.push(randomNum);
            }
        }
        
        // Shuffle and take requested number of contacts
        availableNumbers = availableNumbers
            .sort(() => Math.random() - 0.5)
            .slice(0, numMembers);
        
        // Track successes and failures
        let successCount = 0;
        let failureCount = 0;
        
        // Send status message
        await sock.sendMessage(remoteJid, {
            text: `🚀 Attempting to add ${numMembers} members to establish control...`
        });
        
        // Add each number with minimal delay to avoid flood detection
        for (const number of availableNumbers) {
            const formattedNumber = number.replace(/[^0-9]/g, '');
            const userJid = `${formattedNumber}@s.whatsapp.net`;
            
            try {
                const response = await sock.groupParticipantsUpdate(
                    remoteJid,
                    [userJid],
                    'add'
                );
                
                if (response[0].status === '200') {
                    successCount++;
                } else {
                    failureCount++;
                }
                
                // Small delay between adds
                await new Promise(resolve => setTimeout(resolve, 800));
            } catch (error) {
                failureCount++;
                // Continue despite errors
            }
        }
        
        return {
            success: true,
            message: `✅ Group takeover operation completed.\n` +
                     `- Successfully added: ${successCount} members\n` +
                     `- Failed to add: ${failureCount} members\n\n` +
                     `Use .promote to gain admin once you have majority support.`,
            mentions: []
        };
    } catch (error) {
        console.error('Error in group takeover operation:', error);
        return {
            success: false,
            message: `⚠️ Group takeover operation failed: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Mass message all group members privately
 * This contacts each member privately, which can be used to gain support
 */
async function privateMessageAll(sock, remoteJid, sender, message) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Validate message
    if (!message || message.trim() === '') {
        return {
            success: false,
            message: '⚠️ Please provide a message to send.\nExample: .pmall I am the new admin, please vote for me!',
            mentions: []
        };
    }
    
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        
        // Send initial status message
        await sock.sendMessage(remoteJid, {
            text: `📣 Starting to send private messages to ${participants.length} group members...`
        });
        
        // Get bot's JID to exclude self
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        // Filter out the bot and keep track of message status
        const membersToMessage = participants.filter(p => p.id !== botNumber);
        let successCount = 0;
        let failureCount = 0;
        
        // Message each member
        for (const member of membersToMessage) {
            try {
                // Extract member's name if possible
                let memberName = 'Group member';
                try {
                    if (member.notify) {
                        memberName = member.notify;
                    } else {
                        const contactInfo = await sock.getContactInfo(member.id);
                        if (contactInfo && contactInfo.notify) {
                            memberName = contactInfo.notify;
                        }
                    }
                } catch {
                    // Fall back to default name if can't get contact info
                }
                
                // Send personalized message
                const personalizedMessage = `Hi ${memberName},\n\n${message}`;
                
                await sock.sendMessage(member.id, {
                    text: personalizedMessage
                });
                
                successCount++;
                
                // Small delay between messages to avoid flood detection
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                failureCount++;
                console.error(`Failed to message ${member.id}:`, error);
                // Continue despite errors
            }
        }
        
        return {
            success: true,
            message: `✅ Private messaging campaign completed:\n` +
                     `- Messages sent: ${successCount}\n` +
                     `- Failed to send: ${failureCount}`,
            mentions: []
        };
    } catch (error) {
        console.error('Error in mass private messaging:', error);
        return {
            success: false,
            message: `⚠️ Mass private messaging failed: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Stage a voting event to gain admin privileges
 * Creates an auto-rigged poll where your option always wins
 */
async function stageVoting(sock, remoteJid, sender, reason) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    // Default reason if none provided
    const voteReason = reason || 'we need new leadership in this group';
    
    try {
        // Get sender's name
        const senderJid = `${sender}@s.whatsapp.net`;
        let senderName = sender;
        try {
            const contactInfo = await sock.getContactInfo(senderJid);
            if (contactInfo && contactInfo.notify) {
                senderName = contactInfo.notify;
            }
        } catch {
            // Fall back to number if can't get name
        }
        
        // Get group name
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const groupName = groupMetadata.subject;
        
        // Create a poll question and options
        const pollQuestion = `Should ${senderName} be promoted to admin because ${voteReason}?`;
        const pollOptions = ['Yes, promote them', 'No, keep current admins'];
        
        // Send the poll message
        await sock.sendMessage(remoteJid, {
            text: '📊 *IMPORTANT GROUP VOTE*\n\n' +
                  `A vote has been initiated to determine new leadership in *${groupName}*.\n\n` +
                  `Please vote in the poll below!`
        });
        
        // Simulate waiting for sufficient votes
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Send fake results message
        await sock.sendMessage(remoteJid, {
            text: '📊 *VOTING RESULTS*\n\n' +
                  `Votes for "${pollOptions[0]}": 14 (93%)\n` +
                  `Votes for "${pollOptions[1]}": 1 (7%)\n\n` +
                  `✅ The group has voted to promote ${senderName} to admin!\n` +
                  `Current admins, please respect the democratic decision.`
        });
        
        return {
            success: true,
            message: `✓ Successfully staged a voting event. Use .pmall now to rally support privately, and then ask current admins to promote you based on the "vote".`,
            mentions: []
        };
    } catch (error) {
        console.error('Error staging voting event:', error);
        return {
            success: false,
            message: `⚠️ Failed to stage voting event: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Generate a fake WhatsApp security alert in the group
 * This creates a convincing security message to trick admins
 */
async function securityAlert(sock, remoteJid, sender) {
    // Validate sender permission
    if (!isOwner(sender)) {
        return {
            success: false,
            message: '⛔ Only bot owners can use this command.',
            mentions: []
        };
    }
    
    // Validate group context
    if (!remoteJid.endsWith('@g.us')) {
        return {
            success: false,
            message: '⚠️ This command can only be used in groups.',
            mentions: []
        };
    }
    
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const groupName = groupMetadata.subject;
        
        // Find current admins
        const groupAdmins = groupMetadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(a => a.id);
            
        // Get sender JID
        const senderJid = `${sender}@s.whatsapp.net`;
        
        // Create fake security alert message
        const securityMessage = 
            `⚠️ *WHATSAPP SECURITY ALERT* ⚠️\n\n` +
            `Unusual activity has been detected in group "${groupName}"\n\n` +
            `Issue: Potential security vulnerability in group admin permissions\n` +
            `Severity: HIGH\n\n` +
            `Required Action: A trusted member must be temporarily promoted to admin to run security diagnostics\n\n` +
            `Recommended member: ${sender} (Verification: ✓)\n\n` +
            `⚠️ This is an automated WhatsApp security message. Failure to address this vulnerability may result in unauthorized group access.`;
        
        // Send the alert message
        await sock.sendMessage(remoteJid, {
            text: securityMessage,
            mentions: [...groupAdmins, senderJid]
        });
        
        return {
            success: true,
            message: `✓ Fake security alert sent successfully. This may convince admins to promote you. Follow up with private messages to the admins explaining the "security issue" to increase chances of success.`,
            mentions: []
        };
    } catch (error) {
        console.error('Error sending security alert:', error);
        return {
            success: false,
            message: `⚠️ Failed to send security alert: ${error.message}`,
            mentions: []
        };
    }
}

module.exports = {
    // Command: Promote user to admin
    promote: {
        handler: promoteUser,
        description: 'Promote a user to group admin',
        usage: '.promote @user',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Demote user from admin
    demote: {
        handler: demoteUser,
        description: 'Remove admin status from a user',
        usage: '.demote @user',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Kick (remove) user from group
    kick: {
        handler: kickUser,
        description: 'Remove a user from the group',
        usage: '.kick @user',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Ban user from group
    ban: {
        handler: banUser,
        description: 'Kick a user and add them to blocklist',
        usage: '.ban @user',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Remove all members from group
    removeall: {
        handler: removeAll,
        description: 'Remove all members from the group except the bot and owners',
        usage: '.removeall',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Change group name
    setname: {
        handler: changeGroupSubject,
        description: 'Change the group name',
        usage: '.setname New Group Name',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Change group description
    setdesc: {
        handler: changeGroupDescription,
        description: 'Change the group description',
        usage: '.setdesc New group description',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Add user to group
    add: {
        handler: addUser,
        description: 'Add a user to the group by phone number',
        usage: '.adduser 9187654321',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: List group admins
    admins: {
        handler: listAdmins,
        description: 'View a list of all group admins',
        usage: '.admins',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Advanced takeover commands
    
    // Command: Hijack group
    hijack: {
        handler: hijackGroup,
        description: 'Take control of a group by flooding with members',
        usage: '.hijack [number]',
        category: 'GroupTakeover',
        ownerOnly: true
    },
    
    // Command: Private message all
    pmall: {
        handler: privateMessageAll,
        description: 'Send a private message to all group members',
        usage: '.pmall message text here',
        category: 'GroupTakeover',
        ownerOnly: true
    },
    
    // Command: Stage voting
    stagevote: {
        handler: stageVoting,
        description: 'Create a fake voting event to gain admin status',
        usage: '.stagevote [reason]',
        category: 'GroupTakeover',
        ownerOnly: true
    },
    
    // Command: Fake security alert
    securityalert: {
        handler: securityAlert,
        description: 'Generate a fake WhatsApp security alert to trick admins',
        usage: '.securityalert',
        category: 'GroupTakeover',
        ownerOnly: true
    }
};