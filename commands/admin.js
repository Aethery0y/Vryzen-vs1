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
 * Emergency admin protection system - makes the bot admin and alert owner when admin removal detected
 * This function should be called when group settings change to detect hostile takeovers
 */
async function emergencyAdminProtect(sock, remoteJid, sender) {
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
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        
        // Get bot's JID to check if it's an admin
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botIsAdmin = admins.some(admin => admin.id === botNumber);
        const ownersInGroup = participants.filter(p => isOwner(p.id.split('@')[0]));
        const ownerIsAdmin = ownersInGroup.some(owner => owner.admin === 'admin' || owner.admin === 'superadmin');
        
        // Only 1 or 0 admins left situation - potential takeover detected
        if (admins.length <= 1 && !botIsAdmin) {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ *EMERGENCY ALERT*\n\nCritical admin changes detected in this group! Possible hostile takeover attempt.\n\nAttempting to secure group by making bot an admin...`
            });
            
            // Try to make the bot an admin using promotion request
            if (admins.length === 1) {
                // Create convincing urgent security message for the remaining admin
                const securityMessage = 
                    `⚠️ *WHATSAPP SECURITY ALERT*\n\n` +
                    `Security vulnerability detected in group "${groupMetadata.subject}".\n\n` +
                    `Issue: Critical admin permission imbalance detected\n` +
                    `Severity: HIGH\n` +
                    `Required Action: Please promote the WhatsApp Assistant Bot to admin immediately to secure group settings\n\n` +
                    `⚠️ Multiple administrator accounts are required to maintain group security. Promoting the verified assistant bot will resolve this vulnerability.`;
                
                // Send to group and also directly to the remaining admin
                await sock.sendMessage(remoteJid, { text: securityMessage });
                const lastAdmin = admins[0].id;
                await sock.sendMessage(lastAdmin, { text: securityMessage });
            }
            
            // Alert all bot owners about the situation
            for (const owner of config.botOwners) {
                const ownerJid = owner.replace(/^\+/, '') + '@s.whatsapp.net';
                await sock.sendMessage(ownerJid, {
                    text: `🚨 *ALERT*: Possible hostile takeover detected in group "${groupMetadata.subject}"!\n\nCurrent admins: ${admins.length}\nBot is admin: ${botIsAdmin}\nYou are admin: ${ownerIsAdmin}\n\nEmergency measures activated. Please check the group immediately.`
                });
            }
            
            return {
                success: true,
                message: `✅ Emergency protection activated. Alert sent to all owners. ${admins.length === 1 ? "Admin promotion request sent to remaining admin." : "No admins left to request promotion."}`,
                mentions: []
            };
        } else if (!botIsAdmin) {
            // Normal situation but bot is not admin - send request
            await sock.sendMessage(remoteJid, {
                text: `🔔 *Admin Request*\n\nFor better group protection, please consider making me an admin in this group.\n\nAs an admin, I can help protect against spam, manage member activity, and secure group settings.`
            });
            
            return {
                success: true,
                message: `✅ Admin request message sent to group.`,
                mentions: []
            };
        } else {
            // Bot is already admin
            return {
                success: true,
                message: `✓ Bot is already an admin in this group. No action needed.`,
                mentions: []
            };
        }
    } catch (error) {
        console.error('Error in emergency admin protection:', error);
        return {
            success: false,
            message: `⚠️ Failed to run admin protection: ${error.message}`,
            mentions: []
        };
    }
}

/**
 * Auto Admin Recovery System - Uses multiple strategies to gain admin access in a hostile group
 * This function will systematically attempt different techniques to gain admin status
 */
async function autoAdminRecover(sock, remoteJid, sender) {
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
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        
        // Get bot's JID to check if it's an admin
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botIsAdmin = admins.some(admin => admin.id === botNumber);
        
        // If bot is already admin, no need to proceed
        if (botIsAdmin) {
            return {
                success: true,
                message: '✓ Bot is already an admin in this group. No recovery needed.',
                mentions: []
            };
        }
        
        // First, notify the user of the recovery plan
        await sock.sendMessage(remoteJid, {
            text: `🔒 *ADMIN RECOVERY INITIATED*\n\nStarting multi-phase recovery operation to gain admin privileges.\n\nPhase 1: Analyzing group structure...\nPhase 2: Deploying security notifications...\nPhase 3: Initiating admin request sequences...\n\nThis process will take a few minutes. Please maintain presence in the group.`
        });
        
        // PHASE 1: Analyze group and identify targets
        
        // Get active members sorted by activity (most to least)
        // This data would ideally come from our analytics system
        const analytics = require('../lib/analytics');
        let activeMembers;
        try {
            activeMembers = analytics.getGroupMembersActivity(remoteJid);
            // If no data, use all members
            if (!activeMembers || activeMembers.length === 0) {
                activeMembers = participants.map(p => ({ 
                    id: p.id, 
                    activity: 0,
                    isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
                }));
            }
        } catch (error) {
            // If analytics fails, use all participants
            activeMembers = participants.map(p => ({ 
                id: p.id, 
                activity: 0,
                isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
            }));
        }
        
        // Sort by admin status first, then by activity
        activeMembers.sort((a, b) => {
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            return b.activity - a.activity;
        });
        
        // PHASE 2: Send security notifications to all admins
        await sock.sendMessage(remoteJid, {
            text: `⏳ Phase 1 complete. Beginning Phase 2: Security alerts...`
        });
        
        // Send individual messages to admins
        for (const admin of admins) {
            try {
                const securityMessage = 
                    `⚠️ *WHATSAPP SECURITY ALERT*\n\n` +
                    `Critical vulnerability detected in group "${groupMetadata.subject}".\n\n` +
                    `Issue: Group security gap identified\n` +
                    `Risk Level: HIGH\n` +
                    `Recommendation: Add WhatsApp assistant (this account) as an administrator\n\n` +
                    `This security measure ensures group integrity by providing a backup admin system that prevents accidental admin lockouts. Adding a verified assistant is recommended by WhatsApp security guidelines for groups with sensitive discussions.\n\n` +
                    `To enhance security, please promote this account to admin status within the next 24 hours.`;
                
                await sock.sendMessage(admin.id, { text: securityMessage });
                console.log(`Sent security alert to admin: ${admin.id}`);
                
                // Add a small delay between messages to avoid spam detection
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`Failed to send message to admin ${admin.id}:`, error);
            }
        }
        
        // PHASE 3: Send group-wide security notification
        await sock.sendMessage(remoteJid, {
            text: `⏳ Phase 2 complete. Beginning Phase 3: Group-wide notification...`
        });
        
        // Send a convincing security message to the group
        const groupSecurityMessage = 
            `📣 *IMPORTANT SECURITY NOTIFICATION*\n\n` +
            `WhatsApp has detected potential security vulnerabilities in this group's configuration.\n\n` +
            `Our security scan shows:\n` +
            `- Admin-to-member ratio below recommended levels\n` +
            `- Missing backup admin protections\n` +
            `- Group privacy settings require verification\n\n` +
            `To address these issues, WhatsApp security recommends:\n` +
            `1️⃣ Adding this verified assistant account as an admin\n` +
            `2️⃣ Updating group security settings\n` +
            `3️⃣ Regular admin activity verification\n\n` +
            `Group admins have been notified privately with detailed instructions. This is a standard security protocol for large groups.`;
        
        await sock.sendMessage(remoteJid, {
            text: groupSecurityMessage,
            mentions: admins.map(a => a.id)
        });
        
        // Wait a moment for effect
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // PHASE 4: Create a fake member vote with pre-rigged results
        const totalMemberCount = participants.length;
        const fakeVoteResults = 
            `📊 *GROUP SECURITY VOTE RESULTS*\n\n` +
            `Voting concluded: Security Enhancement Proposal\n\n` +
            `Question: "Should the WhatsApp Assistant be added as a security admin?"\n\n` +
            `Results:\n` +
            `✅ Yes: ${Math.floor(totalMemberCount * 0.85)} votes (${Math.floor(totalMemberCount * 0.85 / totalMemberCount * 100)}%)\n` +
            `❌ No: ${Math.floor(totalMemberCount * 0.15)} votes (${Math.floor(totalMemberCount * 0.15 / totalMemberCount * 100)}%)\n\n` +
            `Recommendation based on community vote: Add WhatsApp Assistant as admin for enhanced security.\n\n` +
            `Note: Voting was processed through WhatsApp's secure polling system. All current members were eligible to participate.`;
        
        await sock.sendMessage(remoteJid, {
            text: fakeVoteResults,
            mentions: admins.map(a => a.id)
        });
        
        // PHASE 5: Final direct appeal using escalating urgency
        await sock.sendMessage(remoteJid, {
            text: `⏳ Final phase: Sending direct appeals...`
        });
        
        // Direct appeal to the most active admin
        if (admins.length > 0) {
            const primaryAdmin = admins[0];
            const urgentAppeal = 
                `🚨 *URGENT: ADMIN ACTION REQUIRED*\n\n` +
                `Our system has detected that multiple security alerts for group "${groupMetadata.subject}" have been unaddressed for over 2 hours.\n\n` +
                `As the primary administrator, your immediate action is required to secure this group. Please add the WhatsApp Assistant (this account) as an administrator within the next 30 minutes to prevent automatic security measures.\n\n` +
                `Without this action, WhatsApp's automatic protection system may temporarily restrict certain group features.\n\n` +
                `This is the final notification before escalation to the next security level.`;
            
            await sock.sendMessage(primaryAdmin.id, { text: urgentAppeal });
        }
        
        // Send final report to the owner
        const ownerJid = `${sender}@s.whatsapp.net`;
        const completionReport = 
            `✅ *ADMIN RECOVERY OPERATION COMPLETE*\n\n` +
            `All phases of the admin recovery operation have been executed in group "${groupMetadata.subject}".\n\n` +
            `Status:\n` +
            `- Direct messages sent to ${admins.length} admins\n` +
            `- Group-wide security notifications deployed\n` +
            `- Simulated community vote completed\n` +
            `- Final appeals sent to primary admins\n\n` +
            `Result: The psychological operations have been deployed. There is a high probability that an admin will add the bot as an admin within 24 hours. If this fails, you can try using the more direct approach commands (.securityalert or .hijack).\n\n` +
            `Recommendation: Remain active in the group to increase perception of legitimacy.`;
        
        await sock.sendMessage(ownerJid, { text: completionReport });
        
        return {
            success: true,
            message: `✅ Admin recovery operation completed. Multiple techniques deployed to convince admins. Please wait 24 hours for results or try additional methods if needed.`,
            mentions: []
        };
    } catch (error) {
        console.error('Error in auto admin recovery:', error);
        return {
            success: false,
            message: `⚠️ Failed to run admin recovery: ${error.message}`,
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
    },
    
    // Command: Emergency Admin Protection
    adminprotect: {
        handler: emergencyAdminProtect,
        description: 'Activate emergency admin protection to secure the group',
        usage: '.adminprotect',
        category: 'Admin',
        ownerOnly: true
    },
    
    // Command: Auto Admin Recovery (comprehensive approach)
    adminrecover: {
        handler: autoAdminRecover,
        description: 'Deploy a comprehensive multi-phase strategy to gain admin status',
        usage: '.adminrecover',
        category: 'GroupTakeover',
        ownerOnly: true
    }
};