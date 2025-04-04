/**
 * Shadow Muting System
 * 
 * This module allows users to mute specific users or message patterns without them knowing.
 * The muted content is still processed by the bot but not shown to the user who muted it.
 */

const database = require('./database');

// Constants
const SHADOW_MUTE_DB_KEY = 'shadowMuteSettings';

/**
 * Initialize the shadow mute system
 */
function init() {
    // Make sure the shadow mute settings exist in the database
    if (!database.getData(SHADOW_MUTE_DB_KEY)) {
        database.saveData(SHADOW_MUTE_DB_KEY, {
            userMutes: {},    // Map of users who have muted others: { userJid: { mutedUser1: true, mutedUser2: true, ... } }
            groupMutes: {}    // Map of group-specific mutes: { groupJid: { muterJid: { mutedJid1: true, mutedJid2: true, ... } } }
        });
        console.log('Shadow mute system initialized');
    }
}

/**
 * Add a user to shadow mute list
 * 
 * @param {string} muterJid - JID of user doing the muting
 * @param {string} mutedJid - JID of user to be muted
 * @param {string} groupJid - Optional group JID (for group-specific muting)
 * @returns {boolean} Success status
 */
function muteUser(muterJid, mutedJid, groupJid = null) {
    try {
        const settings = database.getData(SHADOW_MUTE_DB_KEY);
        
        // Normalize JIDs to ensure consistent format
        muterJid = normalizeJid(muterJid);
        mutedJid = normalizeJid(mutedJid);
        
        if (groupJid) {
            // Group-specific mute
            groupJid = normalizeJid(groupJid);
            
            if (!settings.groupMutes[groupJid]) {
                settings.groupMutes[groupJid] = {};
            }
            
            if (!settings.groupMutes[groupJid][muterJid]) {
                settings.groupMutes[groupJid][muterJid] = {};
            }
            
            settings.groupMutes[groupJid][muterJid][mutedJid] = true;
        } else {
            // Global mute (across all chats)
            if (!settings.userMutes[muterJid]) {
                settings.userMutes[muterJid] = {};
            }
            
            settings.userMutes[muterJid][mutedJid] = true;
        }
        
        database.saveData(SHADOW_MUTE_DB_KEY, settings);
        return true;
    } catch (error) {
        console.error('Error in shadow mute system:', error);
        return false;
    }
}

/**
 * Remove a user from shadow mute list
 * 
 * @param {string} muterJid - JID of user who did the muting
 * @param {string} mutedJid - JID of muted user to unmute
 * @param {string} groupJid - Optional group JID (for group-specific unmuting)
 * @returns {boolean} Success status
 */
function unmuteUser(muterJid, mutedJid, groupJid = null) {
    try {
        const settings = database.getData(SHADOW_MUTE_DB_KEY);
        
        // Normalize JIDs to ensure consistent format
        muterJid = normalizeJid(muterJid);
        mutedJid = normalizeJid(mutedJid);
        
        if (groupJid) {
            // Group-specific unmute
            groupJid = normalizeJid(groupJid);
            
            if (settings.groupMutes[groupJid] && 
                settings.groupMutes[groupJid][muterJid]) {
                delete settings.groupMutes[groupJid][muterJid][mutedJid];
                
                // Clean up empty objects
                if (Object.keys(settings.groupMutes[groupJid][muterJid]).length === 0) {
                    delete settings.groupMutes[groupJid][muterJid];
                }
                
                if (Object.keys(settings.groupMutes[groupJid]).length === 0) {
                    delete settings.groupMutes[groupJid];
                }
            }
        } else {
            // Global unmute
            if (settings.userMutes[muterJid]) {
                delete settings.userMutes[muterJid][mutedJid];
                
                // Clean up empty objects
                if (Object.keys(settings.userMutes[muterJid]).length === 0) {
                    delete settings.userMutes[muterJid];
                }
            }
        }
        
        database.saveData(SHADOW_MUTE_DB_KEY, settings);
        return true;
    } catch (error) {
        console.error('Error in shadow unmute:', error);
        return false;
    }
}

/**
 * Check if a message should be filtered due to shadow muting
 * 
 * @param {Object} message - Message object to check
 * @param {string} userJid - JID of user receiving the message
 * @param {string} groupJid - Optional group JID
 * @returns {boolean} True if message should be filtered out, false otherwise
 */
function shouldFilterMessage(message, userJid, groupJid = null) {
    try {
        // Get sender from the message
        const senderJid = message.key.participant || message.key.remoteJid;
        
        // If no sender or it's the user's own message, don't filter
        if (!senderJid || senderJid === userJid) {
            return false;
        }
        
        // Normalize JIDs
        const normalizedUserJid = normalizeJid(userJid);
        const normalizedSenderJid = normalizeJid(senderJid);
        
        const settings = database.getData(SHADOW_MUTE_DB_KEY);
        
        // First check global mutes
        if (settings.userMutes[normalizedUserJid] && 
            settings.userMutes[normalizedUserJid][normalizedSenderJid]) {
            return true;
        }
        
        // Then check group-specific mutes if applicable
        if (groupJid) {
            const normalizedGroupJid = normalizeJid(groupJid);
            
            return !!(settings.groupMutes[normalizedGroupJid] && 
                    settings.groupMutes[normalizedGroupJid][normalizedUserJid] && 
                    settings.groupMutes[normalizedGroupJid][normalizedUserJid][normalizedSenderJid]);
        }
        
        return false;
    } catch (error) {
        console.error('Error checking shadow mute filter:', error);
        return false; // On error, don't filter the message
    }
}

/**
 * Get list of muted users for a specific user
 * 
 * @param {string} userJid - JID of user
 * @param {string} groupJid - Optional group JID for group-specific mutes
 * @returns {Array} Array of muted user JIDs
 */
function getMutedUsers(userJid, groupJid = null) {
    try {
        const settings = database.getData(SHADOW_MUTE_DB_KEY);
        const normalizedUserJid = normalizeJid(userJid);
        let mutedUsers = [];
        
        // Get global mutes
        if (settings.userMutes[normalizedUserJid]) {
            mutedUsers = Object.keys(settings.userMutes[normalizedUserJid]);
        }
        
        // Add group-specific mutes if applicable
        if (groupJid) {
            const normalizedGroupJid = normalizeJid(groupJid);
            
            if (settings.groupMutes[normalizedGroupJid] && 
                settings.groupMutes[normalizedGroupJid][normalizedUserJid]) {
                // Add group-specific mutes, avoiding duplicates
                const groupMutes = Object.keys(settings.groupMutes[normalizedGroupJid][normalizedUserJid]);
                groupMutes.forEach(jid => {
                    if (!mutedUsers.includes(jid)) {
                        mutedUsers.push(jid);
                    }
                });
            }
        }
        
        return mutedUsers;
    } catch (error) {
        console.error('Error getting muted users:', error);
        return [];
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
    if (!normalizedJid.includes('@')) {
        normalizedJid += '@s.whatsapp.net';
    }
    
    return normalizedJid;
}

// Initialize on module load
init();

module.exports = {
    init,
    muteUser,
    unmuteUser,
    shouldFilterMessage,
    getMutedUsers
};