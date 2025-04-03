const database = require('./database');

/**
 * Get contact information
 * 
 * @param {string} number - Phone number
 * @returns {Object} Contact data
 */
function getContactInfo(number) {
    const normalizedNumber = database.normalizeNumber(number);
    return database.getContact(normalizedNumber);
}

/**
 * Set or update contact information
 * 
 * @param {string} number - Phone number
 * @param {Object} data - Contact data to update
 * @returns {Object} Updated contact
 */
function setContactInfo(number, data) {
    const normalizedNumber = database.normalizeNumber(number);
    return database.saveContact(normalizedNumber, data);
}

/**
 * Add a label to a contact
 * 
 * @param {string} number - Phone number
 * @param {string} label - Label to add
 * @returns {Object} Updated contact
 */
function addLabel(number, label) {
    const normalizedNumber = database.normalizeNumber(number);
    const contact = database.getContact(normalizedNumber) || {
        number: normalizedNumber,
        labels: [],
        engagement: 0,
        lastInteraction: Date.now(),
        metadata: {}
    };
    
    // Add label if it doesn't already exist
    if (!contact.labels.includes(label)) {
        contact.labels.push(label);
    }
    
    return database.saveContact(normalizedNumber, contact);
}

/**
 * Remove a label from a contact
 * 
 * @param {string} number - Phone number
 * @param {string} label - Label to remove
 * @returns {Object} Updated contact
 */
function removeLabel(number, label) {
    const normalizedNumber = database.normalizeNumber(number);
    const contact = database.getContact(normalizedNumber);
    
    if (!contact) {
        return null;
    }
    
    // Remove label
    contact.labels = contact.labels.filter(l => l !== label);
    
    return database.saveContact(normalizedNumber, contact);
}

/**
 * Find contacts by label and/or engagement level
 * 
 * @param {Object} criteria - Search criteria
 * @returns {Array} Matching contacts
 */
function findContacts(criteria = {}) {
    const { label, engagement } = criteria;
    const allContacts = database.getAllContacts();
    const results = [];
    
    for (const number in allContacts) {
        const contact = allContacts[number];
        let match = true;
        
        // Check label criteria
        if (label && !contact.labels.includes(label)) {
            match = false;
        }
        
        // Check engagement criteria
        if (engagement && contact.engagement < parseInt(engagement)) {
            match = false;
        }
        
        if (match) {
            results.push(contact);
        }
    }
    
    return results;
}

/**
 * Get contact statistics
 * 
 * @param {string} number - Phone number
 * @returns {Object} Contact stats
 */
function getContactStats(number) {
    const normalizedNumber = database.normalizeNumber(number);
    const contact = database.getContact(normalizedNumber);
    const warnings = database.getWarnings(normalizedNumber);
    
    if (!contact) {
        return {
            number: normalizedNumber,
            exists: false,
            warnings: warnings
        };
    }
    
    // Format stats
    return {
        number: normalizedNumber,
        exists: true,
        labels: contact.labels,
        engagement: contact.engagement,
        lastInteraction: new Date(contact.lastInteraction).toLocaleString(),
        warnings: warnings
    };
}

/**
 * Track engagement with a contact
 * 
 * @param {string} number - Phone number
 * @param {number} points - Engagement points to add
 * @returns {Object} Updated contact
 */
function trackEngagement(number, points = 1) {
    const normalizedNumber = database.normalizeNumber(number);
    const contact = database.getContact(normalizedNumber) || {
        number: normalizedNumber,
        labels: [],
        engagement: 0,
        lastInteraction: Date.now(),
        metadata: {}
    };
    
    // Update engagement
    contact.engagement += points;
    contact.lastInteraction = Date.now();
    
    return database.saveContact(normalizedNumber, contact);
}

module.exports = {
    getContactInfo,
    setContactInfo,
    addLabel,
    removeLabel,
    findContacts,
    getContactStats,
    trackEngagement
};
