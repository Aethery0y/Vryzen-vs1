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
    } catch (error) {
        console.error('Error initializing group relationship module:', error);
        // Create a new interaction data structure
        interactionData = {
            groups: {},
            lastAnalysis: {}
        };
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
                messageTypes: {}
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
                    messageTypes: {}
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
                    messageTypes: {}
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
        if (Object.keys(groupData.members).length < 3 || groupData.interactions.length < 10) {
            return {
                error: 'Not enough interaction data for meaningful analysis',
                needsData: true,
                members: Object.keys(groupData.members).length,
                interactions: groupData.interactions.length
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
        // Get interaction counts for each member
        const interactionCounts = {};
        const memberData = {};
        const groupData = interactionData.groups[groupId];
        
        // Count total outgoing and incoming interactions for each member
        Object.keys(groupData.members).forEach(member => {
            const data = groupData.members[member];
            interactionCounts[member] = {
                outgoing: 0,
                incoming: 0,
                total: 0
            };
            memberData[member] = data;
        });
        
        // Count interactions from the interaction list
        groupData.interactions.forEach(interaction => {
            if (interaction && interaction.from && interactionCounts[interaction.from]) {
                interactionCounts[interaction.from].outgoing += 1;
                interactionCounts[interaction.from].total += 1;
            }
            
            if (interaction && interaction.to && interactionCounts[interaction.to]) {
                interactionCounts[interaction.to].incoming += 1;
                interactionCounts[interaction.to].total += 1;
            }
        });
        
        // Find most connected members (highest total interactions)
        const mostConnected = Object.keys(interactionCounts)
            .sort((a, b) => interactionCounts[b].total - interactionCounts[a].total)
            .slice(0, 5);
        
        // Find key influencers (highest ratio of incoming to outgoing interactions)
        const keyInfluencers = Object.keys(interactionCounts)
            .filter(member => interactionCounts[member].outgoing > 0)
            .map(member => ({
                member,
                ratio: interactionCounts[member].incoming / interactionCounts[member].outgoing,
                total: interactionCounts[member].total
            }))
            .sort((a, b) => b.ratio - a.ratio)
            .slice(0, 5);
        
        // Basic cluster detection
        // A more sophisticated clustering algorithm could be implemented here
        const clusters = detectClusters(groupData);
        
        // Ensure lastAnalysis exists
        if (!interactionData.lastAnalysis) {
            interactionData.lastAnalysis = {};
        }
        
        // Save analysis results
        const analysisResults = {
            timestamp: Date.now(),
            mostConnected,
            keyInfluencers: keyInfluencers.map(i => i.member),
            clusters: clusters.length,
            totalMembers: Object.keys(groupData.members).length,
            totalInteractions: groupData.interactions.length
        };
        
        interactionData.lastAnalysis[groupId] = analysisResults;
        saveInteractionData();
        
        return {
            mostConnected: mostConnected.map(member => formatMemberForDisplay(member)),
            keyInfluencers: keyInfluencers.map(influencer => ({
                member: formatMemberForDisplay(influencer.member),
                ratio: influencer.ratio.toFixed(2),
                total: influencer.total
            })),
            clusters: clusters.length,
            totalMembers: Object.keys(groupData.members).length,
            totalInteractions: groupData.interactions.length,
            lastUpdated: new Date(groupData.lastUpdate).toISOString()
        };
    } catch (error) {
        console.error('Error in analyzeGroup processing:', error);
        return {
            error: 'Error processing group analysis data',
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