const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

// Database structure
const db = {
    contacts: {},
    warnings: {},
    settings: {
        isPublic: config.defaultPublicAccess,
        allowedUsers: [...config.botOwners]
    },
    data: {} // General data store for various features
};

// Initialize database
async function init() {
    try {
        // Create data directory if it doesn't exist
        try {
            await fs.mkdir(config.databaseDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }

        // Load contacts
        try {
            const contactsData = await fs.readFile(config.contactsFile, 'utf8');
            db.contacts = JSON.parse(contactsData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading contacts:', error);
            }
            // Create new contacts file
            await fs.writeFile(config.contactsFile, JSON.stringify(db.contacts, null, 2));
        }

        // Load warnings
        try {
            const warningsData = await fs.readFile(config.warningsFile, 'utf8');
            db.warnings = JSON.parse(warningsData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading warnings:', error);
            }
            // Create new warnings file
            await fs.writeFile(config.warningsFile, JSON.stringify(db.warnings, null, 2));
        }

        // Load settings
        try {
            const settingsData = await fs.readFile(config.settingsFile, 'utf8');
            db.settings = { ...db.settings, ...JSON.parse(settingsData) };
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading settings:', error);
            }
            // Create new settings file
            await fs.writeFile(config.settingsFile, JSON.stringify(db.settings, null, 2));
        }
        
        // Load general data store
        try {
            const dataFile = path.join(config.databaseDir, 'data.json');
            const dataContent = await fs.readFile(dataFile, 'utf8');
            db.data = JSON.parse(dataContent);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading data store:', error);
            }
            // Don't create a file yet - only create when there's actual data
            db.data = {};
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
}

// Save all data
async function saveAll() {
    try {
        await fs.writeFile(config.contactsFile, JSON.stringify(db.contacts, null, 2));
        await fs.writeFile(config.warningsFile, JSON.stringify(db.warnings, null, 2));
        await fs.writeFile(config.settingsFile, JSON.stringify(db.settings, null, 2));
        
        // Save general data store
        if (Object.keys(db.data).length > 0) {
            const dataFile = path.join(config.databaseDir, 'data.json');
            await fs.writeFile(dataFile, JSON.stringify(db.data, null, 2));
        }
    } catch (error) {
        console.error('Error saving database:', error);
    }
}

// Contact management
function getContact(number) {
    // Normalize number
    const normalizedNumber = normalizeNumber(number);
    return db.contacts[normalizedNumber] || null;
}

function saveContact(number, data) {
    // Normalize number
    const normalizedNumber = normalizeNumber(number);
    
    // Initialize if doesn't exist
    if (!db.contacts[normalizedNumber]) {
        db.contacts[normalizedNumber] = {
            number: normalizedNumber,
            labels: [],
            engagement: 0,
            lastInteraction: Date.now(),
            metadata: {}
        };
    }
    
    // Update with new data
    db.contacts[normalizedNumber] = {
        ...db.contacts[normalizedNumber],
        ...data
    };
    
    // Save to file
    saveAll();
    return db.contacts[normalizedNumber];
}

function getAllContacts() {
    return db.contacts;
}

// Warning and strike system
function getWarnings(number) {
    const normalizedNumber = normalizeNumber(number);
    return db.warnings[normalizedNumber] || { warnings: 0, strikes: 0, banned: false };
}

function addWarning(number) {
    const normalizedNumber = normalizeNumber(number);
    
    // Initialize if doesn't exist
    if (!db.warnings[normalizedNumber]) {
        db.warnings[normalizedNumber] = { warnings: 0, strikes: 0, banned: false };
    }
    
    // Add warning
    db.warnings[normalizedNumber].warnings += 1;
    
    // Check if warnings should convert to strike
    if (db.warnings[normalizedNumber].warnings >= config.maxWarnings) {
        db.warnings[normalizedNumber].warnings = 0;
        db.warnings[normalizedNumber].strikes += 1;
        
        // Check if strikes should result in ban
        if (db.warnings[normalizedNumber].strikes >= config.maxStrikes) {
            db.warnings[normalizedNumber].banned = true;
        }
    }
    
    // Save to file
    saveAll();
    return db.warnings[normalizedNumber];
}

function resetWarnings(number) {
    const normalizedNumber = normalizeNumber(number);
    db.warnings[normalizedNumber] = { warnings: 0, strikes: 0, banned: false };
    saveAll();
}

// Bot settings
function getBotSettings() {
    return db.settings;
}

function updateBotSettings(settings) {
    db.settings = { ...db.settings, ...settings };
    saveAll();
    return db.settings;
}

// Helper function to normalize phone numbers
function normalizeNumber(number) {
    // Remove any non-digit characters
    let normalized = number.toString().replace(/\D/g, '');
    
    // Remove @s.whatsapp.net or @g.us if present
    normalized = normalized.split('@')[0];
    
    // Ensure it starts with a '+'
    if (!normalized.startsWith('+')) {
        normalized = '+' + normalized;
    }
    
    return normalized;
}

// General data store functions
function getData(key) {
    return db.data[key] || null;
}

function saveData(key, value) {
    db.data[key] = value;
    saveAll();
    return value;
}

module.exports = {
    init,
    getContact,
    saveContact,
    getAllContacts,
    getWarnings,
    addWarning,
    resetWarnings,
    getBotSettings,
    updateBotSettings,
    normalizeNumber,
    getData,
    saveData
};
