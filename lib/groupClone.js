/**
 * Group Clone & Migrate System
 * 
 * This module provides functionality to clone an entire group's member list
 * and essential content, create a new clean group, and mass-invite all non-problematic
 * members - effectively allowing members to migrate away from toxic administrators.
 */

const database = require('./database');
const { v4: uuidv4 } = require('uuid');
const analytics = require('./analytics');

// Constants
const CLONE_DB_KEY = 'groupCloneSettings';
const MAX_BATCH_SIZE = 15; // Maximum number of users to invite at once
const BATCH_INTERVAL = 1000 * 20; // 20 seconds between invitation batches

/**
 * Initialize the group clone system
 */
function init() {
    // Make sure the clone settings exist in the database
    if (!database.getData(CLONE_DB_KEY)) {
        database.saveData(CLONE_DB_KEY, {
            operations: {},    // Map of clone operations: { operationId: { sourceGroupJid, targetGroupJid, initiator, status, ... } }
            completedClones: [],  // History of completed clone operations
            invitationBatches: {} // Active invitation batches being processed
        });
        console.log('Group clone system initialized');
    }
}

/**
 * Start a new group clone operation
 * 
 * @param {string} sourceGroupJid - JID of the source group to clone
 * @param {string} initiatorJid - JID of the user initiating the clone
 * @param {Array} memberJids - Array of all member JIDs in the source group
 * @param {Array} adminJids - Array of admin JIDs in the source group
 * @param {Array} excludeJids - Array of JIDs to exclude from migration (e.g., toxic users)
 * @param {string} botJid - JID of the bot
 * @param {string} groupName - Optional name for the new group (defaults to "🛡️ [original name]")
 * @returns {Object} Status object with operation details
 */
function startCloneOperation(sourceGroupJid, initiatorJid, memberJids, adminJids, excludeJids = [], botJid, groupName = '') {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        // Check if there's an active clone for this group
        const existingOp = Object.values(settings.operations).find(
            op => op.sourceGroupJid === sourceGroupJid && 
                 ['init', 'preparing', 'inviting'].includes(op.status)
        );
        
        if (existingOp) {
            return {
                success: false,
                message: `There's already an active clone operation for this group (ID: ${existingOp.operationId})`,
                operationId: existingOp.operationId
            };
        }
        
        // Normalize member lists
        const normalizedMembers = memberJids.map(jid => normalizeJid(jid));
        const normalizedAdmins = adminJids.map(jid => normalizeJid(jid));
        const normalizedExclude = excludeJids.map(jid => normalizeJid(jid));
        
        // Add toxic admins to exclude list if not already present
        normalizedAdmins.forEach(adminJid => {
            if (!normalizedExclude.includes(adminJid) && adminJid !== normalizeJid(botJid) && adminJid !== normalizeJid(initiatorJid)) {
                normalizedExclude.push(adminJid);
            }
        });
        
        // Compute members to invite (exclude toxic users and ensure bot and initiator are included)
        const inviteList = normalizedMembers.filter(jid => 
            !normalizedExclude.includes(jid) ||
            jid === normalizeJid(botJid) || 
            jid === normalizeJid(initiatorJid)
        );
        
        // Create new operation
        const operationId = uuidv4();
        
        const operation = {
            operationId,
            sourceGroupJid,
            targetGroupJid: null, // Will be set when new group is created
            initiator: initiatorJid,
            botJid,
            requestedName: groupName,
            status: 'init',
            startTime: Date.now(),
            excludedJids: normalizedExclude,
            membersToInvite: inviteList,
            invitedMembers: [],
            joinedMembers: [],
            totalMembers: normalizedMembers.length,
            migrationProgress: 0,
            messages: [] // Will store status messages about the operation
        };
        
        // Add message
        operation.messages.push({
            time: Date.now(),
            message: `Group clone operation initiated. Planning to migrate ${inviteList.length} members.`,
            type: 'info'
        });
        
        settings.operations[operationId] = operation;
        database.saveData(CLONE_DB_KEY, settings);
        
        return {
            success: true,
            message: `Started group clone operation (ID: ${operationId})`,
            operationId,
            operation
        };
    } catch (error) {
        console.error('Error starting clone operation:', error);
        return {
            success: false,
            message: `Failed to start clone operation: ${error.message}`
        };
    }
}

/**
 * Set the target group for a clone operation
 * (Called after the new group has been created)
 * 
 * @param {string} operationId - ID of the clone operation 
 * @param {string} targetGroupJid - JID of the newly created target group
 * @returns {Object} Updated operation details
 */
function setTargetGroup(operationId, targetGroupJid) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        if (!settings.operations[operationId]) {
            return {
                success: false,
                message: `Operation ${operationId} not found`
            };
        }
        
        const operation = settings.operations[operationId];
        
        // Update target group and status
        operation.targetGroupJid = targetGroupJid;
        operation.status = 'preparing';
        
        // Add message
        operation.messages.push({
            time: Date.now(),
            message: `New group created: ${targetGroupJid}. Preparing for member migration.`,
            type: 'info'
        });
        
        settings.operations[operationId] = operation;
        database.saveData(CLONE_DB_KEY, settings);
        
        return {
            success: true,
            message: `Set target group ${targetGroupJid} for operation ${operationId}`,
            operation
        };
    } catch (error) {
        console.error(`Error setting target group for operation ${operationId}:`, error);
        return {
            success: false,
            message: `Failed to set target group: ${error.message}`
        };
    }
}

/**
 * Start the invitation process for a clone operation
 * 
 * @param {string} operationId - ID of the clone operation
 * @returns {Object} Status with the first batch of members to invite
 */
function startInvitations(operationId) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        if (!settings.operations[operationId]) {
            return {
                success: false,
                message: `Operation ${operationId} not found`
            };
        }
        
        const operation = settings.operations[operationId];
        
        // Verify we have a target group
        if (!operation.targetGroupJid) {
            return {
                success: false,
                message: `No target group set for operation ${operationId}`
            };
        }
        
        // Update status
        operation.status = 'inviting';
        operation.invitationStartTime = Date.now();
        
        // Prepare the first batch of invitations
        const firstBatch = createInvitationBatch(operationId);
        
        // Add message
        operation.messages.push({
            time: Date.now(),
            message: `Starting member migration. First batch: ${firstBatch.members.length} members.`,
            type: 'info'
        });
        
        settings.operations[operationId] = operation;
        database.saveData(CLONE_DB_KEY, settings);
        
        return {
            success: true,
            message: `Started invitations for operation ${operationId}`,
            batch: firstBatch,
            operation
        };
    } catch (error) {
        console.error(`Error starting invitations for operation ${operationId}:`, error);
        return {
            success: false,
            message: `Failed to start invitations: ${error.message}`
        };
    }
}

/**
 * Create a batch of members to invite
 * 
 * @param {string} operationId - ID of the clone operation
 * @returns {Object} Batch details with members to invite
 */
function createInvitationBatch(operationId) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        const operation = settings.operations[operationId];
        
        // Get members that haven't been invited yet
        const pendingMembers = operation.membersToInvite.filter(
            jid => !operation.invitedMembers.includes(jid)
        );
        
        if (pendingMembers.length === 0) {
            // All members have been invited
            return {
                batchId: null,
                members: [],
                isLastBatch: true
            };
        }
        
        // Create batch ID
        const batchId = `${operationId}_batch_${Date.now()}`;
        
        // Take up to MAX_BATCH_SIZE members
        const batchMembers = pendingMembers.slice(0, MAX_BATCH_SIZE);
        const isLastBatch = batchMembers.length === pendingMembers.length;
        
        // Store batch info
        settings.invitationBatches[batchId] = {
            operationId,
            members: batchMembers,
            created: Date.now(),
            status: 'pending'
        };
        
        database.saveData(CLONE_DB_KEY, settings);
        
        return {
            batchId,
            members: batchMembers,
            isLastBatch
        };
    } catch (error) {
        console.error(`Error creating invitation batch for ${operationId}:`, error);
        return {
            batchId: null,
            members: [],
            isLastBatch: true,
            error: error.message
        };
    }
}

/**
 * Mark a batch of invitations as sent
 * 
 * @param {string} batchId - ID of the invitation batch
 * @param {Array} sentMembers - Array of member JIDs that were successfully invited
 * @returns {Object} Status and next batch to invite (if any)
 */
function markBatchInvited(batchId, sentMembers) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        if (!settings.invitationBatches[batchId]) {
            return {
                success: false,
                message: `Batch ${batchId} not found`
            };
        }
        
        const batch = settings.invitationBatches[batchId];
        const operationId = batch.operationId;
        const operation = settings.operations[operationId];
        
        // Update batch status
        batch.status = 'sent';
        batch.sentTime = Date.now();
        batch.sentMembers = sentMembers;
        
        // Update operation invited members
        sentMembers.forEach(jid => {
            if (!operation.invitedMembers.includes(jid)) {
                operation.invitedMembers.push(jid);
            }
        });
        
        // Update progress
        operation.migrationProgress = Math.round(
            (operation.invitedMembers.length / operation.membersToInvite.length) * 100
        );
        
        // Add message
        operation.messages.push({
            time: Date.now(),
            message: `Invited ${sentMembers.length} members (${operation.invitedMembers.length}/${operation.membersToInvite.length} total).`,
            type: 'info'
        });
        
        settings.operations[operationId] = operation;
        database.saveData(CLONE_DB_KEY, settings);
        
        // Check if we need to create another batch
        const pendingMembers = operation.membersToInvite.filter(
            jid => !operation.invitedMembers.includes(jid)
        );
        
        if (pendingMembers.length > 0) {
            // Schedule creation of next batch
            setTimeout(() => {
                createInvitationBatch(operationId);
            }, BATCH_INTERVAL);
            
            return {
                success: true,
                message: `Marked batch ${batchId} as invited. ${pendingMembers.length} members remaining.`,
                isComplete: false,
                nextBatchScheduled: true,
                operation
            };
        } else {
            // All members have been invited
            operation.status = 'monitoring';
            operation.invitationEndTime = Date.now();
            
            // Add message
            operation.messages.push({
                time: Date.now(),
                message: `All ${operation.invitedMembers.length} members have been invited. Monitoring join status.`,
                type: 'success'
            });
            
            settings.operations[operationId] = operation;
            database.saveData(CLONE_DB_KEY, settings);
            
            return {
                success: true,
                message: `All members invited for operation ${operationId}.`,
                isComplete: true,
                operation
            };
        }
    } catch (error) {
        console.error(`Error marking batch ${batchId} as invited:`, error);
        return {
            success: false,
            message: `Failed to mark batch as invited: ${error.message}`
        };
    }
}

/**
 * Record when a member joins the new group
 * 
 * @param {string} targetGroupJid - JID of the target group
 * @param {string} memberJid - JID of the member who joined
 * @returns {Object} Status update
 */
function recordMemberJoined(targetGroupJid, memberJid) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        // Find the operation for this target group
        const operationId = Object.keys(settings.operations).find(id => 
            settings.operations[id].targetGroupJid === targetGroupJid &&
            ['inviting', 'monitoring'].includes(settings.operations[id].status)
        );
        
        if (!operationId) {
            return {
                success: false,
                message: `No active clone operation found for group ${targetGroupJid}`
            };
        }
        
        const operation = settings.operations[operationId];
        const normalizedMemberJid = normalizeJid(memberJid);
        
        // Record member join if they were invited
        if (operation.invitedMembers.includes(normalizedMemberJid) && 
            !operation.joinedMembers.includes(normalizedMemberJid)) {
            
            operation.joinedMembers.push(normalizedMemberJid);
            
            // Calculate join percentage
            const joinPercentage = Math.round(
                (operation.joinedMembers.length / operation.invitedMembers.length) * 100
            );
            
            // Add message if it's a milestone (every 25%)
            if (joinPercentage % 25 === 0 || operation.joinedMembers.length === 1) {
                operation.messages.push({
                    time: Date.now(),
                    message: `Migration milestone: ${operation.joinedMembers.length} members (${joinPercentage}%) have joined the new group.`,
                    type: 'info'
                });
            }
            
            settings.operations[operationId] = operation;
            database.saveData(CLONE_DB_KEY, settings);
            
            return {
                success: true,
                message: `Recorded member ${memberJid} joined group ${targetGroupJid}`,
                joinedCount: operation.joinedMembers.length,
                joinPercentage
            };
        }
        
        return {
            success: false,
            message: `Member ${memberJid} was not on the invite list for operation ${operationId}`
        };
    } catch (error) {
        console.error(`Error recording member join for ${memberJid}:`, error);
        return {
            success: false,
            message: `Failed to record member join: ${error.message}`
        };
    }
}

/**
 * Complete a clone operation (manually or automatically)
 * 
 * @param {string} operationId - ID of the clone operation
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Optional completion message
 * @returns {Object} Final operation status
 */
function completeOperation(operationId, success = true, message = '') {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        if (!settings.operations[operationId]) {
            return {
                success: false,
                message: `Operation ${operationId} not found`
            };
        }
        
        const operation = settings.operations[operationId];
        
        // Update status
        operation.status = success ? 'completed' : 'failed';
        operation.endTime = Date.now();
        
        // Add final message
        operation.messages.push({
            time: Date.now(),
            message: message || `Clone operation ${success ? 'completed' : 'failed'}. ${operation.joinedMembers.length} members migrated.`,
            type: success ? 'success' : 'error'
        });
        
        // Move to history
        settings.completedClones.push({
            ...operation,
            completionTime: Date.now()
        });
        
        // Keep in active operations for a while before removal
        settings.operations[operationId] = operation;
        database.saveData(CLONE_DB_KEY, settings);
        
        return {
            success: true,
            message: `Operation ${operationId} marked as ${operation.status}`,
            operation
        };
    } catch (error) {
        console.error(`Error completing operation ${operationId}:`, error);
        return {
            success: false,
            message: `Failed to complete operation: ${error.message}`
        };
    }
}

/**
 * Get detailed status of a clone operation
 * 
 * @param {string} operationId - ID of the clone operation
 * @returns {Object} Detailed operation status
 */
function getOperationStatus(operationId) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        // Check active operations
        if (settings.operations[operationId]) {
            const operation = settings.operations[operationId];
            
            return {
                success: true,
                operation: {
                    operationId,
                    sourceGroupJid: operation.sourceGroupJid,
                    targetGroupJid: operation.targetGroupJid,
                    status: operation.status,
                    progress: operation.migrationProgress,
                    startTime: operation.startTime,
                    endTime: operation.endTime || null,
                    invitedCount: operation.invitedMembers.length,
                    joinedCount: operation.joinedMembers.length,
                    totalMemberCount: operation.membersToInvite.length,
                    messages: operation.messages.slice(-10) // Get the 10 most recent messages
                }
            };
        }
        
        // Check completed operations
        const completedOp = settings.completedClones.find(op => op.operationId === operationId);
        
        if (completedOp) {
            return {
                success: true,
                operation: {
                    operationId,
                    sourceGroupJid: completedOp.sourceGroupJid,
                    targetGroupJid: completedOp.targetGroupJid,
                    status: completedOp.status,
                    progress: 100,
                    startTime: completedOp.startTime,
                    endTime: completedOp.endTime,
                    completionTime: completedOp.completionTime,
                    invitedCount: completedOp.invitedMembers.length,
                    joinedCount: completedOp.joinedMembers.length,
                    totalMemberCount: completedOp.membersToInvite.length,
                    messages: completedOp.messages.slice(-10) // Get the 10 most recent messages
                }
            };
        }
        
        return {
            success: false,
            message: `Operation ${operationId} not found`
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
 * Get all clone operations for a specific group (source or target)
 * 
 * @param {string} groupJid - JID of the group
 * @returns {Array} Array of operations for this group
 */
function getGroupOperations(groupJid) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        // Get active operations
        const active = Object.values(settings.operations)
            .filter(op => op.sourceGroupJid === groupJid || op.targetGroupJid === groupJid)
            .map(op => ({
                operationId: op.operationId,
                sourceGroupJid: op.sourceGroupJid,
                targetGroupJid: op.targetGroupJid,
                status: op.status,
                progress: op.migrationProgress,
                startTime: op.startTime,
                invitedCount: op.invitedMembers.length,
                joinedCount: op.joinedMembers.length,
                totalCount: op.membersToInvite.length
            }));
            
        // Get historical operations
        const historical = settings.completedClones
            .filter(op => op.sourceGroupJid === groupJid || op.targetGroupJid === groupJid)
            .map(op => ({
                operationId: op.operationId,
                sourceGroupJid: op.sourceGroupJid,
                targetGroupJid: op.targetGroupJid,
                status: op.status,
                progress: 100,
                startTime: op.startTime,
                endTime: op.endTime,
                completionTime: op.completionTime,
                invitedCount: op.invitedMembers.length,
                joinedCount: op.joinedMembers.length,
                totalCount: op.membersToInvite.length
            }));
            
        return {
            success: true,
            active,
            historical
        };
    } catch (error) {
        console.error(`Error getting clone operations for group ${groupJid}:`, error);
        return {
            success: false,
            message: `Error getting group operations: ${error.message}`
        };
    }
}

/**
 * Get next batch of members to invite
 * 
 * @param {string} operationId - ID of the clone operation
 * @returns {Object} Batch details with members to invite
 */
function getNextBatch(operationId) {
    try {
        const settings = database.getData(CLONE_DB_KEY);
        
        if (!settings.operations[operationId]) {
            return {
                success: false,
                message: `Operation ${operationId} not found`
            };
        }
        
        const operation = settings.operations[operationId];
        
        // Check if the operation is in inviting state
        if (operation.status !== 'inviting') {
            return {
                success: false,
                message: `Operation ${operationId} is not in inviting state (current: ${operation.status})`
            };
        }
        
        // Create a new batch
        const batch = createInvitationBatch(operationId);
        
        return {
            success: true,
            batch,
            isComplete: batch.members.length === 0
        };
    } catch (error) {
        console.error(`Error getting next batch for operation ${operationId}:`, error);
        return {
            success: false,
            message: `Failed to get next batch: ${error.message}`
        };
    }
}

/**
 * Normalize a JID to a consistent format
 * 
 * @param {string} jid - JID to normalize
 * @returns {string} Normalized JID
 */
function normalizeJid(jid) {
    if (!jid) return '';
    
    // Remove any device part (after the colon)
    let normalizedJid = jid.split(':')[0];
    
    // Make sure it ends with @s.whatsapp.net for users
    if (!normalizedJid.includes('@g.us') && !normalizedJid.includes('@s.whatsapp.net')) {
        normalizedJid += '@s.whatsapp.net';
    }
    
    return normalizedJid;
}

// Initialize on module load
init();

module.exports = {
    init,
    startCloneOperation,
    setTargetGroup,
    startInvitations,
    markBatchInvited,
    recordMemberJoined,
    completeOperation,
    getOperationStatus,
    getGroupOperations,
    getNextBatch
};