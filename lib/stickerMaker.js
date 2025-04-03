const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');
const { downloadMediaMessage: baileysDLMedia } = require('@whiskeysockets/baileys');

/**
 * Create a sticker from a media message
 * 
 * @param {Object} sock - The WhatsApp socket
 * @param {Object} message - The message object
 * @param {Object} quotedMsg - The quoted message containing media
 * @returns {Promise<boolean>} Success status
 */
async function createStickerFromMedia(sock, message, quotedMsg) {
    try {
        // Check if quoted message exists
        if (!quotedMsg) {
            await sock.sendMessage(message.key.remoteJid, {
                text: 'Please reply to an image or video to convert it to a sticker.'
            });
            return false;
        }
        
        // Check if quoted message has media
        const hasImage = !!quotedMsg.imageMessage;
        const hasVideo = !!quotedMsg.videoMessage;
        
        if (!hasImage && !hasVideo) {
            await sock.sendMessage(message.key.remoteJid, {
                text: 'Please reply to an image or video to convert it to a sticker.'
            });
            return false;
        }
        
        // Send processing message
        await sock.sendMessage(message.key.remoteJid, {
            text: 'Creating sticker... Please wait.'
        });
        
        // Get media message
        const mediaMessage = hasImage ? quotedMsg.imageMessage : quotedMsg.videoMessage;
        
        // Download media using Baileys' downloadMediaMessage function
        const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            'buffer',
            {},
            {
                logger: sock.logger,
                reuploadRequest: sock.updateMediaMessage
            }
        );
        
        // Create sticker
        const sticker = new Sticker(buffer, {
            pack: 'WhatsApp Bot',
            author: 'Created with Baileys',
            type: hasVideo ? StickerTypes.VIDEO : StickerTypes.FULL,
            categories: ['🤩', '🎉'],
            quality: 70
        });
        
        // Get sticker buffer
        const stickerBuffer = await sticker.toBuffer();
        
        // Send sticker
        await sock.sendMessage(message.key.remoteJid, {
            sticker: stickerBuffer
        });
        
        return true;
    } catch (error) {
        console.error('Error creating sticker:', error);
        
        // Send error message
        await sock.sendMessage(message.key.remoteJid, {
            text: 'Failed to create sticker. Please try again with a different image or video.'
        });
        
        return false;
    }
}

/**
 * Wrapper around Baileys' downloadMediaMessage function
 */
async function downloadMediaMessage(message, type, options, helpers) {
    try {
        return await baileysDLMedia(message, type, options, helpers);
    } catch (error) {
        console.error('Error downloading media:', error);
        throw error;
    }
}

module.exports = {
    createStickerFromMedia
};
