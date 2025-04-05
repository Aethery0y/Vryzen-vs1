/**
 * Anti-Bullying and Group Protection Commands
 * 
 * This module provides powerful commands to deal with abusive users, toxic group owners,
 * and other problematic behaviors on WhatsApp. These commands include shadow muting,
 * evidence collection, group takeover protocols, and group migration tools.
 */

const shadowMute = require('../lib/shadowMute');
const evidenceCollection = require('../lib/evidenceCollection');
// Removed ToS-violating modules
// const groupTakeover = require('../lib/groupTakeover');
// const groupClone = require('../lib/groupClone');
const { isUserAdmin, isUserGroupOwner } = require('./admin');
const analytics = require('../lib/analytics');
const connectionHelper = require('../lib/connectionHelper');

/**
 * Shadow Mute Command - Silently filter messages from specific users
 * 
 * This lets a user mute another user's messages without the target knowing
 * 
 * @param {Object} options - Command options
 * @param {Object} options.sock - Socket connection
 * @param {Object} options.message - Message object
 * @param {string} options.args - Command arguments
 * @param {string} options.sender - Sender JID
 * @param {string} options.groupJid - Group JID if in a group
 * @param {boolean} options.isGroupAdmin - If sender is a group admin
 * @returns {Object} Command response
 */
async function shadowMuteHandler(options) {
    const { sock, message, args, sender, groupJid, isGroupAdmin } = options;
    const senderName = message.pushName || 'User';

    // Check if in a group 
    if (!groupJid) {
        return { 
            replyMessage: "🔇 Shadow muting only works in groups." 
        };
    }

    // Parse command arguments
    const argParts = args.trim().split(' ');
    const command = argParts[0] ? argParts[0].toLowerCase() : 'help';
    
    if (command === 'help' || command === '') {
        return {
            replyMessage: `🔇 *Shadow Mute Commands*

.shadowmute @user - Mute messages from a specific user
.shadowmute unmute @user - Remove a user from your shadow mute list
.shadowmute list - Show all users you've shadow muted
.shadowmute help - Show this help message

Shadow muting lets you filter out messages from specific users without them knowing. Only you will stop seeing their messages - others will still see them.`
        };
    }
    
    // Handle subcommands
    if (command === 'unmute') {
        // Extract mentioned users
        const mentionedUsers = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentionedUsers.length === 0) {
            return { 
                replyMessage: "⚠️ Please mention the user you want to unmute with @user." 
            };
        }
        
        const unmutedUsers = [];
        
        for (const userJid of mentionedUsers) {
            const success = shadowMute.unmuteUser(sender, userJid, groupJid);
            
            if (success) {
                unmutedUsers.push(userJid.split('@')[0]);
            }
        }
        
        if (unmutedUsers.length > 0) {
            return {
                replyMessage: `✅ You've removed ${unmutedUsers.join(', ')} from your shadow mute list.`
            };
        } else {
            return {
                replyMessage: "❌ Failed to unmute any users. They may not be on your mute list."
            };
        }
    }
    
    if (command === 'list') {
        const mutedUsers = shadowMute.getMutedUsers(sender, groupJid);
        
        if (mutedUsers.length === 0) {
            return {
                replyMessage: "📋 You haven't shadow muted anyone in this group."
            };
        }
        
        // Format muted users for display
        const formattedUsers = mutedUsers.map(jid => {
            const number = jid.split('@')[0];
            return `• ${number}`;
        });
        
        return {
            replyMessage: `🔇 *Your Shadow Muted Users*\n\n${formattedUsers.join('\n')}`
        };
    }
    
    // Default action - mute mentioned users
    const mentionedUsers = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    if (mentionedUsers.length === 0) {
        return { 
            replyMessage: "⚠️ Please mention the user you want to shadow mute with @user." 
        };
    }
    
    const mutedUsers = [];
    
    for (const userJid of mentionedUsers) {
        const success = shadowMute.muteUser(sender, userJid, groupJid);
        
        if (success) {
            mutedUsers.push(userJid.split('@')[0]);
        }
    }
    
    if (mutedUsers.length > 0) {
        return {
            replyMessage: `🔇 You've shadow muted ${mutedUsers.join(', ')}. You won't see their messages anymore, but they won't know they've been muted.`
        };
    } else {
        return {
            replyMessage: "❌ Failed to shadow mute users."
        };
    }
}

/**
 * Evidence Collection Command - Gather and document problematic messages
 * 
 * @param {Object} options - Command options
 * @param {Object} options.sock - Socket connection
 * @param {Object} options.message - Message object
 * @param {string} options.args - Command arguments
 * @param {string} options.sender - Sender JID
 * @param {string} options.groupJid - Group JID if in a group
 * @returns {Object} Command response
 */
async function evidenceHandler(options) {
    const { sock, message, args, sender, groupJid } = options;
    const senderName = message.pushName || 'User';
    
    // Parse command arguments
    const argParts = args.trim().split(' ');
    const command = argParts[0] ? argParts[0].toLowerCase() : 'help';
    
    if (command === 'help' || command === '') {
        return {
            replyMessage: `📸 *Evidence Collection Commands*

.evidence start @user - Start tracking messages from a user
.evidence stop @user - Stop tracking a user
.evidence stop [sessionId] - Stop a specific tracking session
.evidence list - List your active tracking sessions
.evidence report [sessionId] - Generate report from collected evidence
.evidence export [sessionId] - Export evidence as HTML file
.evidence help - Show this help message

This tool automatically captures and logs messages from problematic users to create documentation of their behavior.`
        };
    }
    
    // Handle subcommands
    if (command === 'start') {
        // Extract mentioned users
        const mentionedUsers = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentionedUsers.length === 0) {
            return { 
                replyMessage: "⚠️ Please mention the user you want to track with @user." 
            };
        }
        
        // Start tracking each mentioned user
        let successCount = 0;
        let sessionIds = [];
        
        for (const userJid of mentionedUsers) {
            const result = evidenceCollection.startTracking(userJid, sender, groupJid);
            
            if (result.success) {
                successCount++;
                sessionIds.push(result.sessionId);
            }
        }
        
        if (successCount > 0) {
            return {
                replyMessage: `📸 Started evidence collection on ${successCount} user(s).\n\nSession ID${sessionIds.length > 1 ? 's' : ''}: ${sessionIds.join(', ')}\n\nKeep this ID to use when generating reports later.`
            };
        } else {
            return {
                replyMessage: "❌ Failed to start evidence collection."
            };
        }
    }
    
    if (command === 'stop') {
        // Check if stopping by session ID or user mention
        if (argParts.length > 1 && !argParts[1].startsWith('@') && argParts[1].length > 8) {
            // Stop by session ID
            const sessionId = argParts[1];
            const result = evidenceCollection.stopTracking(null, sender, sessionId);
            
            if (result.success) {
                return {
                    replyMessage: `✅ ${result.message}`
                };
            } else {
                return {
                    replyMessage: `❌ ${result.message}`
                };
            }
        } else {
            // Stop by mentioned user
            const mentionedUsers = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (mentionedUsers.length === 0) {
                return { 
                    replyMessage: "⚠️ Please mention the user to stop tracking, or provide a valid session ID." 
                };
            }
            
            let successCount = 0;
            
            for (const userJid of mentionedUsers) {
                const result = evidenceCollection.stopTracking(userJid, sender);
                
                if (result.success) {
                    successCount++;
                }
            }
            
            if (successCount > 0) {
                return {
                    replyMessage: `✅ Stopped evidence collection on ${successCount} user(s).`
                };
            } else {
                return {
                    replyMessage: "❌ No active tracking sessions found for these users."
                };
            }
        }
    }
    
    if (command === 'list') {
        const sessions = evidenceCollection.getActiveSessions(sender);
        
        if (sessions.length === 0) {
            return {
                replyMessage: "📋 You don't have any active evidence collection sessions."
            };
        }
        
        // Format sessions for display
        const formattedSessions = sessions.map(session => {
            const target = session.target.split('@')[0];
            const group = session.groupJid ? ` (in group: ${session.groupJid.split('@')[0]})` : '';
            return `• ID: ${session.sessionId}\n  Target: ${target}${group}\n  Messages: ${session.messageCount}`;
        });
        
        return {
            replyMessage: `📸 *Your Active Evidence Collection Sessions*\n\n${formattedSessions.join('\n\n')}`
        };
    }
    
    if (command === 'report' || command === 'export') {
        if (argParts.length < 2) {
            return {
                replyMessage: `⚠️ Please provide a session ID, e.g., .evidence ${command} [sessionId]`
            };
        }
        
        const sessionId = argParts[1];
        
        if (command === 'report') {
            const report = evidenceCollection.generateReport(sessionId, sender);
            
            if (!report.success) {
                return {
                    replyMessage: `❌ ${report.message}`
                };
            }
            
            const messageTypeSummary = Object.entries(report.messagesByType)
                .map(([type, count]) => `• ${type}: ${count}`)
                .join('\n');
            
            // Create a summary of the evidence
            return {
                replyMessage: `📊 *Evidence Report Summary*\n\nTarget: ${report.target}\nSession: ${report.sessionId}\nPeriod: ${report.startDate.substring(0, 10)} to ${report.endDate.substring(0, 10)}\nTotal Messages: ${report.messageCount}\n\n*Message Types*\n${messageTypeSummary}\n\nUse '.evidence export ${sessionId}' to get the full detailed report.`
            };
        } else { // export
            const exportResult = evidenceCollection.exportEvidence(sessionId, sender);
            
            if (!exportResult.success) {
                return {
                    replyMessage: `❌ ${exportResult.message}`
                };
            }
            
            return {
                replyMessage: `✅ Evidence report exported to ${exportResult.path}\n\nThis HTML file contains all the evidence collected from this session in a format suitable for reporting.`
            };
        }
    }
    
    // Default case - show help
    return {
        replyMessage: `⚠️ Unknown evidence command. Use '.evidence help' for available commands.`
    };
}

/**
 * Enhanced Group Takeover Command - Strategic admin recovery
 * 
 * @param {Object} options - Command options
 * @param {Object} options.sock - Socket connection
 * @param {Object} options.message - Message object
 * @param {string} options.args - Command arguments
 * @param {string} options.sender - Sender JID
 * @param {string} options.groupJid - Group JID if in a group
 * @param {Object} options.botConfig - Bot configuration
 * @returns {Object} Command response
 */
async function covertAdminHandler(options) {
    const { sock, message, args, sender, groupJid, botConfig } = options;
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check if in a group
    if (!groupJid) {
        return { 
            replyMessage: "👑 Group takeover only works in groups." 
        };
    }
    
    // Check if requester is bot owner or admin
    const isAuthorized = botConfig.botOwners.some(owner => 
        sender.split('@')[0] === owner.replace('+', '')) || 
        (botConfig.botAdmins && botConfig.botAdmins.some(admin => 
            sender.split('@')[0] === admin.replace('+', '')));
        
    if (!isAuthorized) {
        return {
            replyMessage: "⛔ You don't have permission to use advanced takeover commands."
        };
    }
    
    // Check WhatsApp connection using our helper module
    const connectionStatus = connectionHelper.checkConnectionBeforeAction('covert admin', sock);
    if (!connectionStatus.success) {
        return connectionStatus;
    }
    
    // Parse command arguments
    const argParts = args.trim().split(' ');
    const command = argParts[0] ? argParts[0].toLowerCase() : 'help';
    
    if (command === 'help' || command === '') {
        return {
            replyMessage: `👑 *Enhanced Group Takeover Commands*

.covertadmin start - Begin a strategic operation to gain admin rights
.covertadmin status [operationId] - Check operation status
.covertadmin advance [operationId] - Manually advance to next phase
.covertadmin abort [operationId] - Cancel an active operation
.covertadmin help - Show this help message

This advanced system uses psychological and social techniques to strategically gain admin access in a group over time. This process may take several days for maximum effectiveness.`
        };
    }
    
    // Handle subcommands
    if (command === 'start') {
        // Get group metadata first
        try {
            const groupMetadata = await sock.groupMetadata(groupJid);
            const adminUsers = groupMetadata.participants
                .filter(user => user.admin)
                .map(user => user.id);
                
            const allMembers = groupMetadata.participants.map(user => user.id);
            
            // Start takeover operation
            const result = groupTakeover.startOperation(
                groupJid, 
                sender, 
                adminUsers, 
                allMembers,
                botNumber
            );
            
            if (result.success) {
                return {
                    replyMessage: `🕵️ *Covert Admin Operation Started*\n\nOperation ID: ${result.operationId}\n\nA multi-phase strategy has been initiated to gain admin privileges in this group. This is a gradual process that may take several days for maximum effectiveness.\n\nUse '.covertadmin status ${result.operationId}' to check progress.`
                };
            } else {
                return {
                    replyMessage: `❌ ${result.message}`
                };
            }
        } catch (error) {
            console.error('Error starting takeover operation:', error);
            return {
                replyMessage: "❌ Failed to start takeover operation. Make sure the bot has permission to view group metadata."
            };
        }
    }
    
    if (command === 'status') {
        let operationId;
        
        if (argParts.length > 1) {
            operationId = argParts[1];
        } else {
            // Try to find an active operation for this group
            const ops = await groupTakeover.getGroupOperations(groupJid);
            
            if (!ops.success || ops.active.length === 0) {
                return {
                    replyMessage: "❌ No active takeover operations found for this group."
                };
            }
            
            operationId = ops.active[0].operationId;
        }
        
        const status = groupTakeover.getOperationStatus(operationId);
        
        if (!status.success) {
            return {
                replyMessage: `❌ ${status.message}`
            };
        }
        
        const op = status.operation;
        
        // Calculate time elapsed
        const elapsed = op.elapsedTime;
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        
        return {
            replyMessage: `🕵️ *Covert Admin Operation Status*\n\nOperation ID: ${op.operationId}\nStatus: ${op.status}\nCurrent Phase: ${op.phase + 1}/${MAX_PHASES}\nProgress: ${op.progress}%\nElapsed Time: ${hours}h ${minutes}m\nAdmin Granted: ${op.adminAdded ? 'Yes ✅' : 'Not yet ⏳'}`
        };
    }
    
    if (command === 'advance') {
        let operationId;
        
        if (argParts.length > 1) {
            operationId = argParts[1];
        } else {
            // Try to find an active operation for this group
            const ops = await groupTakeover.getGroupOperations(groupJid);
            
            if (!ops.success || ops.active.length === 0) {
                return {
                    replyMessage: "❌ No active takeover operations found for this group."
                };
            }
            
            operationId = ops.active[0].operationId;
        }
        
        const result = groupTakeover.advancePhase(operationId);
        
        if (!result.success) {
            return {
                replyMessage: `❌ ${result.message}`
            };
        }
        
        return {
            replyMessage: `✅ Advanced operation to phase ${result.operation.phase + 1}. New strategies are now being deployed.`
        };
    }
    
    if (command === 'abort') {
        let operationId;
        
        if (argParts.length > 1) {
            operationId = argParts[1];
        } else {
            // Try to find an active operation for this group
            const ops = await groupTakeover.getGroupOperations(groupJid);
            
            if (!ops.success || ops.active.length === 0) {
                return {
                    replyMessage: "❌ No active takeover operations found for this group."
                };
            }
            
            operationId = ops.active[0].operationId;
        }
        
        // TODO: Implement abort function in groupTakeover module
        // For now, we'll just advance to the final phase
        return {
            replyMessage: `❌ Abort operation not yet implemented.`
        };
    }
    
    // Default case - show help
    return {
        replyMessage: `⚠️ Unknown covert admin command. Use '.covertadmin help' for available commands.`
    };
}

// Constants for phases
const MAX_PHASES = 5;

/**
 * Group Clone & Migrate Command - Create a clean copy of a group
 * 
 * @param {Object} options - Command options
 * @param {Object} options.sock - Socket connection
 * @param {Object} options.message - Message object
 * @param {string} options.args - Command arguments
 * @param {string} options.sender - Sender JID
 * @param {string} options.groupJid - Group JID if in a group
 * @param {Object} options.botConfig - Bot configuration
 * @returns {Object} Command response
 */
async function cloneGroupHandler(options) {
    const { sock, message, args, sender, groupJid, botConfig } = options;
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check if in a group
    if (!groupJid) {
        return { 
            replyMessage: "🔄 Group cloning only works in groups." 
        };
    }
    
    // Check if requester is bot owner or admin using the database normalization
    const normalizedSender = sender.split('@')[0];
    const isAuthorized = botConfig.botOwners.some(owner => 
        require('../lib/database').normalizeNumber(owner).replace('+', '') === normalizedSender) || 
        (botConfig.botAdmins && botConfig.botAdmins.some(admin => 
            require('../lib/database').normalizeNumber(admin).replace('+', '') === normalizedSender));
        
    if (!isAuthorized) {
        return {
            replyMessage: "⛔ You don't have permission to use group clone commands."
        };
    }
    
    // Parse command arguments
    const argParts = args.trim().split(' ');
    const command = argParts[0] ? argParts[0].toLowerCase() : 'help';
    
    if (command === 'help' || command === '') {
        return {
            replyMessage: `🔄 *Group Clone & Migrate Commands*

.clonegroup start [name] - Create a new clean group with all non-toxic members
.clonegroup exclude @user1 @user2 - Add users to exclusion list
.clonegroup status [operationId] - Check clone operation status
.clonegroup invite [operationId] - Trigger next batch of invitations
.clonegroup complete [operationId] - Mark operation as complete
.clonegroup help - Show this help message

This tool creates a clean copy of the current group and migrates all selected members, leaving toxic admins behind.`
        };
    }
    
    // Handle subcommands
    if (command === 'start') {
        // Get requested group name (if provided)
        const groupName = argParts.slice(1).join(' ') || '';
        
        // Check WhatsApp connection using our helper module
        const connectionStatus = connectionHelper.checkConnectionBeforeAction('clone group', sock);
        if (!connectionStatus.success) {
            return connectionStatus;
        }
        
        // Get group metadata first
        try {
            const groupMetadata = await sock.groupMetadata(groupJid);
            const currentGroupName = groupMetadata.subject;
            const adminUsers = groupMetadata.participants
                .filter(user => user.admin)
                .map(user => user.id);
                
            const allMembers = groupMetadata.participants.map(user => user.id);
            
            // Get exclusion list from temporary storage
            const excludeList = botConfig.tempStorage?.cloneExcludeList?.[groupJid] || [];
            
            // Create name for new group if not provided
            const newGroupName = groupName || `🛡️ ${currentGroupName}`;
            
            // Start clone operation
            const result = groupClone.startCloneOperation(
                groupJid, 
                sender, 
                allMembers, 
                adminUsers, 
                excludeList,
                botNumber,
                newGroupName
            );
            
            if (result.success) {
                // Send initial response
                await sock.sendMessage(groupJid, {
                    text: `🔄 *Group Clone Operation Started*\n\nOperation ID: ${result.operationId}\nNew Group Name: ${newGroupName}\nMembers to Migrate: ${result.operation.membersToInvite.length}/${result.operation.totalMembers}\n\nCreating new group and preparing for migration...`
                }, { quoted: message });

                // Asynchronously create the new group
                try {
                    const groupResult = await groupClone.createNewGroup(sock, result.operationId);
                    
                    if (groupResult.success) {
                        return {
                            replyMessage: `✅ *New Group Created*\n\nOperation ID: ${result.operationId}\nGroup Name: ${groupResult.groupName}\n\nThe bot will now automatically start inviting members. Use '.clonegroup status ${result.operationId}' to check progress.`
                        };
                    } else {
                        // Special handling for connection issues
                        if (groupResult.needsConnection) {
                            return {
                                replyMessage: `⚠️ *WhatsApp Connection Required*\n\nOperation ID: ${result.operationId}\n\nThe bot cannot create a new group because it's not connected to WhatsApp. Please make sure the QR code has been scanned and the bot is online, then try again.`
                            };
                        }
                        
                        return {
                            replyMessage: `⚠️ *Group Creation Issue*\n\nOperation ID: ${result.operationId}\nError: ${groupResult.message}\n\nPlease try using '.clonegroup status ${result.operationId}' to check status.`
                        };
                    }
                } catch (createError) {
                    console.error('Error in group creation:', createError);
                    return {
                        replyMessage: `❌ *Group Creation Failed*\n\nOperation ID: ${result.operationId}\nError: ${createError.message}\n\nPlease try again or check the operation status with '.clonegroup status ${result.operationId}'.`
                    };
                }
            } else {
                return {
                    replyMessage: `❌ ${result.message}`
                };
            }
        } catch (error) {
            console.error('Error starting clone operation:', error);
            return {
                replyMessage: "❌ Failed to start clone operation. Make sure the bot has permission to view group metadata."
            };
        }
    }
    
    if (command === 'exclude') {
        // Extract mentioned users
        const mentionedUsers = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentionedUsers.length === 0) {
            return { 
                replyMessage: "⚠️ Please mention the users you want to exclude with @user." 
            };
        }
        
        // Initialize exclusion list if it doesn't exist
        if (!botConfig.tempStorage) {
            botConfig.tempStorage = {};
        }
        
        if (!botConfig.tempStorage.cloneExcludeList) {
            botConfig.tempStorage.cloneExcludeList = {};
        }
        
        if (!botConfig.tempStorage.cloneExcludeList[groupJid]) {
            botConfig.tempStorage.cloneExcludeList[groupJid] = [];
        }
        
        // Add mentioned users to exclusion list (avoid duplicates)
        let newExclusions = 0;
        for (const userJid of mentionedUsers) {
            if (!botConfig.tempStorage.cloneExcludeList[groupJid].includes(userJid)) {
                botConfig.tempStorage.cloneExcludeList[groupJid].push(userJid);
                newExclusions++;
            }
        }
        
        return {
            replyMessage: `✅ Added ${newExclusions} user(s) to the exclusion list. They will not be invited to the new group when you run '.clonegroup start'.`
        };
    }
    
    if (command === 'status') {
        let operationId;
        
        if (argParts.length > 1) {
            operationId = argParts[1];
        } else {
            // Try to find an active operation for this group
            const ops = await groupClone.getGroupOperations(groupJid);
            
            if (!ops.success || ops.active.length === 0) {
                return {
                    replyMessage: "❌ No active clone operations found for this group."
                };
            }
            
            operationId = ops.active[0].operationId;
        }
        
        const status = groupClone.getOperationStatus(operationId);
        
        if (!status.success) {
            return {
                replyMessage: `❌ ${status.message}`
            };
        }
        
        const op = status.operation;
        
        return {
            replyMessage: `🔄 *Group Clone Operation Status*\n\nOperation ID: ${op.operationId}\nStatus: ${op.status}\nSource Group: ${op.sourceGroupJid.split('@')[0]}\nTarget Group: ${op.targetGroupJid ? op.targetGroupJid.split('@')[0] : 'Not created yet'}\nProgress: ${op.progress}%\nMembers Invited: ${op.invitedCount}/${op.totalMemberCount}\nMembers Joined: ${op.joinedCount}\n\nRecent Updates:\n${op.messages.slice(-3).map(m => `• ${m.message}`).join('\n')}`
        };
    }
    
    if (command === 'invite') {
        let operationId;
        
        if (argParts.length > 1) {
            operationId = argParts[1];
        } else {
            // Try to find an active operation for this group
            const ops = await groupClone.getGroupOperations(groupJid);
            
            if (!ops.success || ops.active.length === 0) {
                return {
                    replyMessage: "❌ No active clone operations found for this group."
                };
            }
            
            operationId = ops.active[0].operationId;
        }
        
        // Check WhatsApp connection using our helper module
        const connectionStatus = connectionHelper.checkConnectionBeforeAction('invite members', sock);
        if (!connectionStatus.success) {
            return connectionStatus;
        }
        
        // Send initial response
        await sock.sendMessage(groupJid, {
            text: `🔄 *Processing Member Invitations*\n\nOperation ID: ${operationId}\nGetting next batch of members to invite...`
        }, { quoted: message });

        // Process a new batch (if available)
        try {
            const processingResult = await groupClone.processBatch(sock, operationId);
            
            if (!processingResult.success) {
                // Special handling for connection issues
                if (processingResult.needsConnection) {
                    return {
                        replyMessage: `⚠️ *WhatsApp Connection Required*\n\nOperation ID: ${operationId}\n\nThe bot cannot invite members because it's not connected to WhatsApp. Please make sure the QR code has been scanned and the bot is online, then try again.`
                    };
                }
                
                return {
                    replyMessage: `❌ ${processingResult.message}`
                };
            }
            
            if (processingResult.isComplete) {
                return {
                    replyMessage: `✅ All members have been invited for this operation.\n\nInvited: ${processingResult.operation.invitedMembers.length} members\nTotal: ${processingResult.operation.membersToInvite.length} members`
                };
            }
            
            const pendingCount = processingResult.operation.membersToInvite.length - processingResult.operation.invitedMembers.length;
            
            return {
                replyMessage: `✅ Successfully invited batch of members to the new group.\n\nProgress: ${processingResult.operation.migrationProgress}%\nInvited: ${processingResult.operation.invitedMembers.length} members\nRemaining: ${pendingCount} members\n\nUse '.clonegroup invite ${operationId}' again to invite the next batch.`
            };
        } catch (error) {
            console.error('Error processing invitation batch:', error);
            return {
                replyMessage: `❌ Error processing invitation batch: ${error.message}\n\nPlease try again.`
            };
        }
    }
    
    if (command === 'complete') {
        let operationId;
        
        if (argParts.length > 1) {
            operationId = argParts[1];
        } else {
            // Try to find an active operation for this group
            const ops = await groupClone.getGroupOperations(groupJid);
            
            if (!ops.success || ops.active.length === 0) {
                return {
                    replyMessage: "❌ No active clone operations found for this group."
                };
            }
            
            operationId = ops.active[0].operationId;
        }
        
        const result = groupClone.completeOperation(
            operationId, 
            true, 
            "Operation marked as complete by user."
        );
        
        if (!result.success) {
            return {
                replyMessage: `❌ ${result.message}`
            };
        }
        
        return {
            replyMessage: `✅ Group clone operation marked as complete.\n\nFinal Stats:\nMembers Invited: ${result.operation.invitedMembers.length}\nMembers Joined: ${result.operation.joinedMembers.length}\n\nThe new group is ready to use.`
        };
    }
    
    // Default case - show help
    return {
        replyMessage: `⚠️ Unknown group clone command. Use '.clonegroup help' for available commands.`
    };
}

/**
 * Process incoming messages to collect evidence if tracking is active
 * 
 * @param {Object} message - Message object
 * @param {string} groupJid - Group JID if applicable
 * @returns {boolean} Whether message was processed for evidence
 */
function processMessageForEvidence(message, groupJid = null) {
    try {
        return evidenceCollection.recordMessage(message, groupJid);
    } catch (error) {
        console.error('Error processing message for evidence:', error);
        return false;
    }
}

/**
 * Check if a message should be filtered due to shadow muting
 * 
 * @param {Object} message - Message object
 * @param {string} viewerJid - JID of user viewing the message
 * @param {string} groupJid - Group JID if applicable
 * @returns {boolean} Whether message should be filtered
 */
function shouldFilterMessage(message, viewerJid, groupJid = null) {
    try {
        return shadowMute.shouldFilterMessage(message, viewerJid, groupJid);
    } catch (error) {
        console.error('Error checking shadow mute filter:', error);
        return false;
    }
}

/**
 * Process any ready takeover messages that need to be sent
 * 
 * @param {Object} sock - Socket connection
 * @returns {Array} Array of messages that were processed
 */
function processTakeoverMessages(sock) {
    try {
        // Check WhatsApp connection
        const connectionStatus = connectionHelper.checkWhatsAppConnection(sock);
        if (!connectionStatus.connected) {
            console.log('Cannot process takeover messages: WhatsApp not connected');
            return [];
        }
        
        const readyMessages = groupTakeover.getReadyMessages();
        const processedMessages = [];
        
        for (const message of readyMessages) {
            // Send the message
            sock.sendMessage(
                message.targetJid,
                { text: message.content },
                { quoted: null }
            ).then(() => {
                // Mark as delivered
                groupTakeover.markMessageDelivered(message.messageId);
                processedMessages.push(message);
            }).catch(error => {
                console.error(`Error sending takeover message ${message.messageId}:`, error);
            });
        }
        
        return processedMessages;
    } catch (error) {
        console.error('Error processing takeover messages:', error);
        return [];
    }
}

/**
 * Check if bot has gained admin and update operation status
 * 
 * @param {string} groupJid - Group JID
 * @param {string} userJid - User JID that was promoted
 * @param {Object} botConfig - Bot configuration
 * @returns {boolean} Whether an operation was updated
 */
function checkAdminGained(groupJid, userJid, botConfig) {
    try {
        // This function will be called from index.js where we have access to sock
        // We should pass the full JID of the bot (e.g., "1234567890@s.whatsapp.net")
        // For now, we'll use whatever is passed in userJid and compare it to botConfig.botNumber
        
        // Extract phone number from JID for comparison
        const userNumber = userJid.split('@')[0];
        
        // Check if the bot owners list includes this number (comparing with and without + prefix)
        // In a better implementation, we would pass the bot's JID directly
        if (botConfig.botOwners.some(owner => userNumber === owner.replace('+', ''))) {
            return groupTakeover.markAdminGranted(groupJid);
        }
        return false;
    } catch (error) {
        console.error('Error checking admin gained:', error);
        return false;
    }
}

/**
 * Handler for the direct admin command
 * This command attempts to gain admin privileges immediately
 * using multiple techniques in parallel
 * 
 * @param {Object} options - Command options
 * @param {Object} options.sock - WhatsApp socket connection
 * @param {Object} options.message - Message object
 * @param {string} options.args - Command arguments
 * @param {string} options.sender - Sender JID
 * @param {string} options.groupJid - Group JID if in a group
 * @param {Object} options.botConfig - Bot configuration
 * @returns {Object} Command response
 */
async function directAdminHandler(options) {
    const { sock, message, args, sender, groupJid, botConfig } = options;
    // Get bot's JID correctly from sock
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check if in a group
    if (!groupJid) {
        return { 
            replyMessage: "👑 Direct admin takeover only works in groups." 
        };
    }
    
    // Check WhatsApp connection using our helper module
    const connectionStatus = connectionHelper.checkConnectionBeforeAction('direct admin', sock);
    if (!connectionStatus.success) {
        return connectionStatus;
    }
    
    // Check if requester is bot owner or admin using the database normalization
    const normalizedSender = sender.split('@')[0];
    const isAuthorized = botConfig.botOwners.some(owner => 
        require('../lib/database').normalizeNumber(owner).replace('+', '') === normalizedSender) || 
        (botConfig.botAdmins && botConfig.botAdmins.some(admin => 
            require('../lib/database').normalizeNumber(admin).replace('+', '') === normalizedSender));
        
    if (!isAuthorized) {
        return {
            replyMessage: "⛔ You don't have permission to use emergency admin commands."
        };
    }
    
    // Connection check already performed by connectionHelper
    
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(groupJid);
        const adminJids = groupMetadata.participants
            .filter(p => p.admin !== null)
            .map(p => p.id);
        const memberJids = groupMetadata.participants.map(p => p.id);
        
        // Check if bot is already admin
        const isBotAdmin = adminJids.includes(botNumber);
        if (isBotAdmin) {
            return {
                replyMessage: "✅ Bot is already an admin in this group."
            };
        }
        
        // Start emergency admin operation
        const startResult = await groupTakeover.forceAdminOperation(
            groupJid, 
            sender, 
            adminJids, 
            memberJids, 
            botNumber
        );
        
        if (!startResult.success) {
            return {
                replyMessage: `❌ Failed to start admin takeover: ${startResult.message}`
            };
        }
        
        // First send confirmation to command issuer
        await sock.sendMessage(groupJid, {
            text: `🚨 *EMERGENCY ADMIN REQUEST INITIATED*\n\nReason: Admin access required for security verification\nOperation ID: ${startResult.operationId}\n\nAttempting to gain admin privileges...`
        }, { quoted: message });
        
        // Send all the required messages for the takeover
        if (startResult.messagesToSend && startResult.messagesToSend.length > 0) {
            for (const msg of startResult.messagesToSend) {
                try {
                    await sock.sendMessage(msg.jid, { text: msg.content });
                    // Small delay between messages to avoid spam detection
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`Error sending message to ${msg.jid}:`, error);
                }
            }
        }
        
        return {
            replyMessage: "🔄 Emergency admin protocol activated. Messages have been sent to all group admins and key members. Please wait for response."
        };
    } catch (error) {
        console.error('Error in direct admin handler:', error);
        return {
            replyMessage: `❌ Error executing emergency admin command: ${error.message}`
        };
    }
}

module.exports = {
    shadowMuteHandler,
    evidenceHandler,
    processMessageForEvidence,
    shouldFilterMessage,
    // Removed ToS-violating functions that could cause account bans:
    // covertAdminHandler,
    // cloneGroupHandler, 
    // directAdminHandler,
    // processTakeoverMessages,
    // checkAdminGained
};