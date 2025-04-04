/**
 * Group Relationship Analysis Module
 * Analyzes interaction patterns within groups to identify key members, clusters, and influencers
 */
const database = require('./database');

// Store interaction data
let interactionData = {};

// Initialize from database
async function init() {
    try {
        const savedData = database.getData('groupInteractionData');
        if (savedData) {
            interactionData = savedData;
        } else {
            // Initialize with empty structure if no data exists
            interactionData = {
                groups: {},
                lastAnalysis: {}
            };
        }
        
        // Ensure required properties exist
        if (!interactionData.groups) {
            interactionData.groups = {};
        }
        if (!interactionData.lastAnalysis) {
            interactionData.lastAnalysis = {};
        }
        
        console.log('Group relationship module initialized');
        return true;
    } catch (error) {
        console.error('Error initializing group relationship module:', error);
        interactionData = {
            groups: {},
            lastAnalysis: {}
        };
        return false;
    }
}

/**
 * Record an interaction between users
 * @param {Object} params - Interaction parameters
 */
function recordInteraction(params) {
    try {
        const { sender, group, recipient, msgType, replyTo, timestamp } = params;
        
        if (!group || !group.endsWith('@g.us')) {
            // Only track group interactions
            return;
        }
        
        // Ensure interactionData is properly initialized
        if (!interactionData) {
            interactionData = {
                groups: {},
                lastAnalysis: {}
            };
        }
        
        // Ensure groups object exists
        if (!interactionData.groups) {
            interactionData.groups = {};
        }
        
        // Normalize numbers for consistency
        const senderNormalized = normalizeJid(sender);
        
        // Initialize group data if it doesn't exist
        if (!interactionData.groups[group]) {
            interactionData.groups[group] = {
                members: {},
                interactions: [],
                lastUpdate: timestamp || Date.now()
            };
        }
        // Update group data
        const groupData = interactionData.groups[group];
        groupData.lastUpdate = timestamp || Date.now();
        
        // Initialize sender data if it doesn't exist
        if (!groupData.members) {
            groupData.members = {};
        }
        
        if (!groupData.members[senderNormalized]) {
            groupData.members[senderNormalized] = {
                messageCount: 0,
                firstSeen: timestamp || Date.now(),
                lastActivity: timestamp || Date.now(),
                interactedWith: {},
                messageTypes: {},
                repliedToCount: 0 // Add this field to track times received replies
            };
        }
        
        // Update sender stats
        const senderData = groupData.members[senderNormalized];
        senderData.messageCount += 1;
        senderData.lastActivity = timestamp || Date.now();
        
        // Record message type
        if (!senderData.messageTypes) {
            senderData.messageTypes = {};
        }
        senderData.messageTypes[msgType] = (senderData.messageTypes[msgType] || 0) + 1;
        
        // If this is a reply to someone, record the interaction
        if (replyTo) {
            const recipientNormalized = normalizeJid(replyTo);
            
            // Initialize recipient data if needed
            if (!groupData.members[recipientNormalized]) {
                groupData.members[recipientNormalized] = {
                    messageCount: 0,
                    firstSeen: timestamp || Date.now(),
                    lastActivity: timestamp || Date.now(),
                    interactedWith: {},
                    messageTypes: {},
                    repliedToCount: 0 // Track how many times this user gets replies
                };
            }
            
            // Record interaction between sender and recipient
            if (!senderData.interactedWith) {
                senderData.interactedWith = {};
            }
            senderData.interactedWith[recipientNormalized] = (senderData.interactedWith[recipientNormalized] || 0) + 1;
            
            // Track that the recipient received a reply - this is key for influence analysis
            const recipientData = groupData.members[recipientNormalized];
            if (recipientData) {
                if (typeof recipientData.repliedToCount !== 'number') {
                    recipientData.repliedToCount = 0;
                }
                recipientData.repliedToCount += 1;
            }
            
            // Initialize interactions array if needed
            if (!groupData.interactions) {
                groupData.interactions = [];
            }
            
            // Record interaction in the interactions list
            groupData.interactions.push({
                from: senderNormalized,
                to: recipientNormalized,
                type: msgType,
                timestamp: timestamp || Date.now()
            });
            
            // Only keep the last 1000 interactions to save memory
            if (groupData.interactions.length > 1000) {
                groupData.interactions = groupData.interactions.slice(-1000);
            }
        } else if (recipient) {
            // Direct mention or interaction with another user
            const recipientNormalized = normalizeJid(recipient);
            
            // Initialize recipient data if needed
            if (!groupData.members[recipientNormalized]) {
                groupData.members[recipientNormalized] = {
                    messageCount: 0,
                    firstSeen: timestamp || Date.now(),
                    lastActivity: timestamp || Date.now(),
                    interactedWith: {},
                    messageTypes: {},
                    repliedToCount: 0 // Track replies here too
                };
            }
            
            // Record interaction between sender and recipient
            if (!senderData.interactedWith) {
                senderData.interactedWith = {};
            }
            senderData.interactedWith[recipientNormalized] = (senderData.interactedWith[recipientNormalized] || 0) + 1;
            
            // Initialize interactions array if needed
            if (!groupData.interactions) {
                groupData.interactions = [];
            }
            
            // Record interaction in the interactions list
            groupData.interactions.push({
                from: senderNormalized,
                to: recipientNormalized,
                type: msgType,
                timestamp: timestamp || Date.now()
            });
            
            // Only keep the last 1000 interactions to save memory
            if (groupData.interactions.length > 1000) {
                groupData.interactions = groupData.interactions.slice(-1000);
            }
        }
        
        // Save changes to database
        saveInteractionData();
    } catch (error) {
        console.error('Error in recordInteraction:', error);
        // Initialize with a safe structure if there was an error
        if (!interactionData || !interactionData.groups) {
            interactionData = {
                groups: {},
                lastAnalysis: {}
            };
            saveInteractionData();
        }
    }
}

/**
 * Analyze interaction patterns in a group
 * @param {string} groupId - The group ID to analyze
 * @returns {Object} Analysis results
 */
function analyzeGroup(groupId) {
    try {
        // Ensure interactionData is properly initialized
        if (!interactionData) {
            interactionData = { groups: {}, lastAnalysis: {} };
        }
        
        if (!interactionData.groups) {
            interactionData.groups = {};
        }
        
        if (!interactionData.groups[groupId]) {
            return {
                error: 'No interaction data found for this group',
                needsData: true
            };
        }
        
        const groupData = interactionData.groups[groupId];
        
        // Ensure required structures exist
        if (!groupData.members) {
            groupData.members = {};
        }
        
        if (!groupData.interactions) {
            groupData.interactions = [];
        }
        
        // Only analyze if we have enough data
        if (Object.keys(groupData.members).length < 3) {
            return {
                error: 'Not enough member data for meaningful analysis',
                needsData: true,
                members: Object.keys(groupData.members).length
            };
        }
    } catch (error) {
        console.error('Error in analyzeGroup initial check:', error);
        return {
            error: 'Error analyzing group data',
            needsData: true
        };
    }
    
    try {
        // We'll analyze several metrics to identify key influencers:
        // 1. Message Count (raw activity)
        // 2. Response Rate (how often they get replies)
        // 3. Conversation Starters (who starts discussions)
        // 4. Reply Patterns (who replies to whom)
        
        const groupData = interactionData.groups[groupId];
        const memberIds = Object.keys(groupData.members);
        
        // Extract IDs without the "@s.whatsapp.net" part
        const normalizeId = (id) => {
            return id.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
        };
        
        // 1. MOST ACTIVE MEMBERS (by message count)
        const mostActive = memberIds
            .map(id => ({ 
                id: normalizeId(id), 
                count: groupData.members[id].messageCount || 0 
            }))
            .sort((a, b) => b.count - a.count)
            .filter(m => m.count > 0)
            .slice(0, 5);
        
        // 2. CONVERSATION STARTERS
        // Identify members who tend to start new conversation threads
        // We'll use message types as proxy - images, links, and certain types often start conversations
        const conversationStarters = memberIds
            .map(id => {
                const member = groupData.members[id];
                const messageTypes = member.messageTypes || {};
                
                // These message types often start conversations
                const starterTypes = ['image', 'video', 'document', 'link'];
                let starterCount = 0;
                
                // Count messages of types that tend to start discussions
                for (const type of starterTypes) {
                    starterCount += messageTypes[type] || 0;
                }
                
                return {
                    id: normalizeId(id),
                    count: starterCount
                };
            })
            .sort((a, b) => b.count - a.count)
            .filter(m => m.count > 0)
            .slice(0, 3);
        
        // 3. MOST REPLIED TO
        // Identify members who receive the most replies
        const repliedTo = {};
        
        // Count how many times each member gets replied to
        for (const memberId of memberIds) {
            const member = groupData.members[memberId];
            const replyCount = member.repliedToCount || 0;
            
            repliedTo[normalizeId(memberId)] = (repliedTo[normalizeId(memberId)] || 0) + replyCount;
        }
        
        const mostRepliedTo = Object.keys(repliedTo)
            .map(id => ({ id, count: repliedTo[id] }))
            .sort((a, b) => b.count - a.count)
            .filter(m => m.count > 0)
            .slice(0, 3);
        
        // 4. KEY INFLUENCERS
        // Combine different metrics to identify true influencers
        // We'll score members based on multiple factors:
        // - High message count
        // - High reply received rate
        // - Conversation starter
        
        const influencerScores = {};
        
        // Add scores from message activity
        for (const member of mostActive) {
            if (!influencerScores[member.id]) {
                influencerScores[member.id] = { score: 0, metrics: {} };
            }
            
            // Activity score (0-3 points)
            const activityScore = Math.min(3, member.count / 20);
            influencerScores[member.id].score += activityScore;
            influencerScores[member.id].metrics.activity = member.count;
        }
        
        // Add scores from conversation starting
        for (const starter of conversationStarters) {
            if (!influencerScores[starter.id]) {
                influencerScores[starter.id] = { score: 0, metrics: {} };
            }
            
            // Starter score (0-4 points)
            const starterScore = Math.min(4, starter.count);
            influencerScores[starter.id].score += starterScore;
            influencerScores[starter.id].metrics.threadStarts = starter.count;
        }
        
        // Add scores from being replied to
        for (const replied of mostRepliedTo) {
            if (!influencerScores[replied.id]) {
                influencerScores[replied.id] = { score: 0, metrics: {} };
            }
            
            // Reply received score (0-5 points)
            const replyScore = Math.min(5, replied.count);
            influencerScores[replied.id].score += replyScore;
            influencerScores[replied.id].metrics.receivedReplies = replied.count;
        }
        
        // Calculate response rates for each member
        // Response rate = replies received / messages sent
        for (const id of memberIds) {
            const normalId = normalizeId(id);
            const member = groupData.members[id];
            const messageCount = member.messageCount || 0;
            const repliesReceived = repliedTo[normalId] || 0;
            
            if (messageCount > 10 && repliesReceived > 0) {
                const responseRate = repliesReceived / messageCount;
                
                if (!influencerScores[normalId]) {
                    influencerScores[normalId] = { score: 0, metrics: {} };
                }
                
                // Response rate score (0-5 points)
                // High if more than 30% of messages get replies
                const responseScore = Math.min(5, responseRate * 10);
                influencerScores[normalId].score += responseScore;
                influencerScores[normalId].metrics.responseRate = responseRate;
            }
        }
        
        // Sort by total influence score
        const keyInfluencers = Object.keys(influencerScores)
            .map(id => ({
                id,
                score: influencerScores[id].score,
                ...influencerScores[id].metrics
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        
        // Create results object with normalized data
        const results = {
            keyInfluencers,
            mostActive,
            conversationStarters,
            mostRepliedTo,
            totalMembers: memberIds.length
        };
        
        // Save analysis results in a format that's easier to use for us
        if (!interactionData.lastAnalysis) {
            interactionData.lastAnalysis = {};
        }
        
        interactionData.lastAnalysis[groupId] = {
            timestamp: Date.now(),
            results
        };
        
        saveInteractionData();
        
        return results;
    } catch (error) {
        console.error('Error in analyzeGroup processing:', error);
        return {
            error: 'Error processing group analysis data: ' + error.message,
            needsData: true
        };
    }
}

/**
 * Get the last analysis results for a group
 * @param {string} groupId - The group ID
 * @returns {Object} Last analysis results or null
 */
function getLastAnalysis(groupId) {
    try {
        // Ensure interactionData is initialized
        if (!interactionData) {
            interactionData = {
                groups: {},
                lastAnalysis: {}
            };
            return null;
        }
        
        // Ensure lastAnalysis exists
        if (!interactionData.lastAnalysis) {
            interactionData.lastAnalysis = {};
            return null;
        }
        
        return interactionData.lastAnalysis[groupId] || null;
    } catch (error) {
        console.error('Error in getLastAnalysis:', error);
        return null;
    }
}

/**
 * Clear interaction data for a group
 * @param {string} groupId - The group ID
 */
function clearGroupData(groupId) {
    try {
        // Ensure interactionData is initialized
        if (!interactionData) {
            interactionData = {
                groups: {},
                lastAnalysis: {}
            };
            return;
        }
        
        // Ensure groups and lastAnalysis exist
        if (!interactionData.groups) {
            interactionData.groups = {};
        }
        
        if (!interactionData.lastAnalysis) {
            interactionData.lastAnalysis = {};
        }
        
        if (interactionData.groups[groupId]) {
            delete interactionData.groups[groupId];
        }
        
        if (interactionData.lastAnalysis[groupId]) {
            delete interactionData.lastAnalysis[groupId];
        }
        
        saveInteractionData();
    } catch (error) {
        console.error('Error in clearGroupData:', error);
        // Initialize with a safe structure if there was an error
        interactionData = {
            groups: {},
            lastAnalysis: {}
        };
        saveInteractionData();
    }
}

// Helper functions
function normalizeJid(jid) {
    if (!jid) return '';
    // Remove @s.whatsapp.net or @g.us if present
    return jid.split('@')[0];
}

function formatMemberForDisplay(member) {
    // Format the member ID for display, could be enhanced to show names
    return member;
}

function detectClusters(groupData) {
    try {
        // Simple cluster detection based on interaction frequency
        // This is a placeholder for a more sophisticated algorithm
        const clusters = [];
        const interactions = {};
        
        // Make sure interactions array exists
        if (!groupData.interactions || !Array.isArray(groupData.interactions)) {
            console.warn('No valid interactions array found in group data');
            return [];
        }
        
        // Build interaction graph
        groupData.interactions.forEach(interaction => {
            if (!interaction || !interaction.from || !interaction.to) {
                return; // Skip invalid interactions
            }
            const pair = [interaction.from, interaction.to].sort().join(':');
            interactions[pair] = (interactions[pair] || 0) + 1;
        });
        
        // Get frequently interacting pairs
        const frequentPairs = Object.keys(interactions)
            .filter(pair => interactions[pair] > 3)
            .sort((a, b) => interactions[b] - interactions[a]);
        
        // Simple clustering: just group frequent pairs
        const assigned = new Set();
        
        frequentPairs.forEach(pair => {
            const parts = pair.split(':');
            if (parts.length !== 2) return; // Skip invalid pairs
            
            const [a, b] = parts;
            if (!a || !b) return; // Skip if parts are missing
            
            // Check if either member is already in a cluster
            let existingCluster = -1;
            
            for (let i = 0; i < clusters.length; i++) {
                if (clusters[i].has(a) || clusters[i].has(b)) {
                    existingCluster = i;
                    break;
                }
            }
            
            if (existingCluster >= 0) {
                // Add to existing cluster
                clusters[existingCluster].add(a);
                clusters[existingCluster].add(b);
            } else if (!assigned.has(a) && !assigned.has(b)) {
                // Create new cluster
                const newCluster = new Set([a, b]);
                clusters.push(newCluster);
            }
            
            assigned.add(a);
            assigned.add(b);
        });
        
        return clusters;
    } catch (error) {
        console.error('Error in detectClusters:', error);
        return []; // Return empty clusters list on error
    }
}

function saveInteractionData() {
    try {
        database.saveData('groupInteractionData', interactionData);
    } catch (error) {
        console.error('Error saving group interaction data:', error);
    }
}

module.exports = {
    init,
    recordInteraction,
    analyzeGroup,
    getLastAnalysis,
    clearGroupData
};