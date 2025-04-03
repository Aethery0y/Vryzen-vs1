// WhatsApp Bot using Baileys with Gemini AI integration
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');

// Import modules
const database = require('./lib/database');
const ai = require('./lib/ai');
const animeNews = require('./lib/animeNews');
const profanityFilter = require('./lib/profanityFilter');
const contacts = require('./lib/contacts');
const commandHandler = require('./commands');
const config = require('./config');

// Conversation context map (for short-term memory)
const conversationContext = new Map();

// Track bot connections
let sock = null;
let isConnected = false;

// Function to connect to WhatsApp
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        // Create socket connection
        sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: state,
            browser: ['WhatsApp Bot', 'Chrome', '10.0.0']
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                const shouldReconnect = 
                    (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
                    DisconnectReason.loggedOut;
                
                console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting:', shouldReconnect);
                
                // Reconnect if not logged out
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('WhatsApp bot connected!');
                isConnected = true;
                
                // Schedule anime news updates
                schedule.scheduleJob('*/10 * * * *', async () => { // Every 10 minutes
                    if (isConnected) {
                        try {
                            await animeNews.sendAnimeNewsUpdates(sock);
                        } catch (error) {
                            console.error('Error sending scheduled anime news:', error);
                        }
                    }
                });
            }
        });

        // Save credentials whenever they're updated
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                // Skip status updates and messages sent by the bot
                if (message.key.remoteJid === 'status@broadcast' || message.key.fromMe) continue;
                
                // Get message content
                const messageContent = message.message?.conversation || 
                                      message.message?.extendedTextMessage?.text || 
                                      message.message?.imageMessage?.caption || 
                                      message.message?.videoMessage?.caption || '';
                
                const remoteJid = message.key.remoteJid;
                const sender = message.key.participant || remoteJid;
                const isGroup = remoteJid.endsWith('@g.us');
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedSender = message.message?.extendedTextMessage?.contextInfo?.participant;
                const isReplyToBot = quotedSender && 
                                    quotedSender.split('@')[0] === sock.user.id.split('@')[0];
                
                // Check if message is a direct message to bot or a reply to bot
                const isDirectToBot = !isGroup || isReplyToBot;

                // Check if message is a command (starts with '.')
                if (messageContent.startsWith('.')) {
                    // Process command
                    await commandHandler.handleCommand({
                        sock,
                        message,
                        messageContent,
                        sender,
                        remoteJid,
                        isGroup,
                        quotedMsg
                    });
                    continue;
                }
                
                // Check for profanity
                const profanityCheck = await profanityFilter.checkMessage(messageContent, sender);
                if (profanityCheck.hasProfanity) {
                    await sock.sendMessage(remoteJid, { text: profanityCheck.warningMessage });
                    continue;
                }
                
                // Process message with AI if direct message or reply to bot
                if (isDirectToBot) {
                    // Send typing indicator
                    await sock.presenceSubscribe(remoteJid);
                    await sock.sendPresenceUpdate('composing', remoteJid);
                    
                    // Get previous context
                    const chatId = isGroup ? `${remoteJid}-${sender}` : remoteJid;
                    const context = conversationContext.get(chatId) || [];
                    
                    try {
                        // Get AI response
                        console.log('Sending message to AI:', messageContent);
                        const response = await ai.getResponse(messageContent, context);
                        console.log('AI response received successfully');
                        
                        // Update context (keep last 5 messages)
                        let newContext = [];
                        
                        // If there's existing context, preserve it
                        if (context.length > 0) {
                            newContext = [...context.slice(-8)]; // Keep last 4 exchanges (8 messages)
                        }
                        
                        // Add new messages to context
                        newContext.push({ role: 'user', parts: [{ text: messageContent }] });
                        newContext.push({ role: 'model', parts: [{ text: response }] });
                        
                        conversationContext.set(chatId, newContext);
                        
                        // Send response
                        await sock.sendMessage(remoteJid, { text: response });
                    } catch (error) {
                        console.error('Error getting AI response:', error);
                        
                        // Rate limit specific message
                        let errorMessage = '';
                        
                        if (error.message && error.message.includes('429')) {
                            errorMessage = "I'm currently handling too many requests. Please try again in a minute when I'm less busy.";
                        } else if (error.message && error.message.includes('multiple attempts')) {
                            errorMessage = "I'm having trouble connecting to my AI service right now. Please try a simpler question or try again later.";
                        } else {
                            errorMessage = "Sorry, I encountered an error while processing your message. Please try again later.";
                        }
                        
                        // Track this user interaction even if AI failed
                        const senderJid = sender || remoteJid;
                        if (senderJid) {
                            const number = senderJid.split('@')[0];
                            contacts.trackEngagement(number, 1);
                        }
                        
                        await sock.sendMessage(remoteJid, { text: errorMessage });
                    }
                }
            }
        });

        // Initialize database
        await database.init();
        
        return sock;
    } catch (err) {
        console.error('Failed to connect to WhatsApp:', err);
        setTimeout(connectToWhatsApp, 10000); // Try to reconnect after 10 seconds
    }
}

// Start the bot
connectToWhatsApp();
