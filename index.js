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
                        const response = await ai.getResponse(messageContent, context);
                        
                        // Update context (keep last 5 messages)
                        const newContext = [
                            ...context.slice(-8), // Keep last 4 exchanges (8 messages)
                            { role: 'user', parts: [{ text: messageContent }] },
                            { role: 'model', parts: [{ text: response }] }
                        ];
                        conversationContext.set(chatId, newContext);
                        
                        // Send response
                        await sock.sendMessage(remoteJid, { text: response });
                    } catch (error) {
                        console.error('Error getting AI response:', error);
                        await sock.sendMessage(remoteJid, { 
                            text: 'Sorry, I encountered an error while processing your message. Please try again later.' 
                        });
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
