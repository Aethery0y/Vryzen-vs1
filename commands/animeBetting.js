/**
 * Command handler for anime betting system
 */

const animeBetting = require('../lib/animeBetting');
const pointsSystem = require('../lib/pointsSystem');
const config = require('../config');
const database = require('../lib/database');

/**
 * Show available bet types and description
 */
async function showBetTypes(sock, remoteJid) {
    const betTypes = animeBetting.getBetTypes();
    
    let message = `🎲 *Available Betting Types* 🎲\n\n`;
    
    Object.entries(betTypes).forEach(([type, info]) => {
        message += `*${type}*: ${info.description}\n`;
        if (info.options && info.options.length > 0) {
            message += `   Options: ${info.options.join(', ')}\n`;
        } else {
            message += `   Options: Custom (specify when creating bet)\n`;
        }
        message += `\n`;
    });
    
    message += `\nTo create a bet, use:\n.createbet <type> "<title>" "<option1,option2,...>"\n\nExample:\n.createbet custom "Will Luffy find the One Piece?" "yes,no,never"\n\nFor more help, use: .bethelp`;
    
    await sock.sendMessage(remoteJid, { text: message });
}

/**
 * Create a new betting game
 */
async function createBet(sock, remoteJid, sender, args) {
    // Parse arguments
    if (!args || args.length < 2) {
        await sock.sendMessage(remoteJid, {
            text: '❌ Invalid command format. Use: .createbet <type> "<title>" "<option1,option2,...>" [<multiplier>]'
        });
        return;
    }
    
    const betType = args[0].toLowerCase();
    const title = args[1];
    
    // Parse options if provided, otherwise use default for that bet type
    let options = [];
    if (args.length >= 3) {
        options = args[2].split(',').map(opt => opt.trim());
    }
    
    // Parse multiplier if provided
    let multiplier = null;
    if (args.length >= 4 && !isNaN(args[3])) {
        multiplier = parseFloat(args[3]);
    }
    
    // Create the betting game
    const result = animeBetting.createBettingGame(
        sender,
        remoteJid,
        betType,
        title,
        options,
        multiplier
    );
    
    if (result.success) {
        // Format bet options
        const optionsText = result.game.options.map((opt, index) => 
            `${index + 1}. ${opt}`
        ).join('\n');
        
        // Format expiry time
        const expiryDate = new Date(result.game.expiresAt);
        const expiryTime = expiryDate.toLocaleString();
        
        const message = `🎲 *New Betting Game Created!* 🎲\n\n` +
            `🆔 *Game ID:* ${result.gameId}\n` +
            `📌 *Title:* ${result.game.title}\n` +
            `💰 *Payout Multiplier:* ${result.game.multiplier}x\n` +
            `⏱️ *Expires:* ${expiryTime}\n\n` +
            `*Betting Options:*\n${optionsText}\n\n` +
            `To place a bet, use:\n.bet ${result.gameId} <option> <amount>\n\n` +
            `Example: .bet ${result.gameId} ${result.game.options[0]} 100`;
        
        await sock.sendMessage(remoteJid, { text: message });
    } else {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
    }
}

/**
 * Place a bet on a game
 */
async function placeBet(sock, remoteJid, sender, args) {
    if (!args || args.length < 3) {
        await sock.sendMessage(remoteJid, {
            text: '❌ Invalid command format. Use: .bet <game_id> <option> <amount>'
        });
        return;
    }
    
    const gameId = args[0];
    const option = args[1];
    const amount = parseInt(args[2]);
    
    const result = animeBetting.placeBet(sender, gameId, option, amount);
    
    if (result.success) {
        await sock.sendMessage(remoteJid, { 
            text: `✅ ${result.message}\nYou now have ${result.currentPoints} points.` 
        });
    } else {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
    }
}

/**
 * List all active betting games
 */
async function listBets(sock, remoteJid) {
    const activeGames = animeBetting.getActiveBettingGames(remoteJid);
    
    if (activeGames.length === 0) {
        await sock.sendMessage(remoteJid, { 
            text: '📢 There are no active betting games in this group currently.' 
        });
        return;
    }
    
    let message = `🎲 *Active Betting Games* 🎲\n\n`;
    
    activeGames.forEach((game, index) => {
        // Calculate time left
        const timeLeft = Math.max(0, game.expiresAt - Date.now());
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        message += `*${index + 1}. ${game.title}*\n` +
            `🆔 Game ID: ${game.id}\n` +
            `💰 Total pot: ${game.totalAmount} points\n` +
            `👥 Total bets: ${game.totalBets}\n` +
            `⏱️ Expires in: ${hoursLeft}h ${minutesLeft}m\n\n`;
    });
    
    message += `To view details about a specific game, use:\n.betinfo <game_id>`;
    
    await sock.sendMessage(remoteJid, { text: message });
}

/**
 * Show details about a specific betting game
 */
async function showBetInfo(sock, remoteJid, args) {
    if (!args || args.length < 1) {
        await sock.sendMessage(remoteJid, {
            text: '❌ Invalid command format. Use: .betinfo <game_id>'
        });
        return;
    }
    
    const gameId = args[0];
    const result = animeBetting.getBettingGame(gameId);
    
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }
    
    const game = result.game;
    
    // Calculate time left
    const timeLeft = Math.max(0, game.expiresAt - Date.now());
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format options with bet counts
    const optionCounts = {};
    Object.values(game.bets).forEach(bet => {
        optionCounts[bet.option] = (optionCounts[bet.option] || 0) + 1;
    });
    
    const optionsText = game.options.map(opt => {
        const count = optionCounts[opt] || 0;
        const percentage = game.totalBets > 0 ? Math.round((count / game.totalBets) * 100) : 0;
        return `- ${opt}: ${count} bets (${percentage}%)`;
    }).join('\n');
    
    // Format status
    let statusText = game.ended ? 
        `🔴 Ended - Winner: ${game.winner}` : 
        `🟢 Active - Expires in: ${hoursLeft}h ${minutesLeft}m`;
    
    const message = `🎲 *Betting Game Details* 🎲\n\n` +
        `🆔 *Game ID:* ${game.id}\n` +
        `📌 *Title:* ${game.title}\n` +
        `📊 *Status:* ${statusText}\n` +
        `💰 *Total pot:* ${game.totalAmount} points\n` +
        `👥 *Total bets:* ${game.totalBets}\n` +
        `💱 *Multiplier:* ${game.multiplier}x\n\n` +
        `*Betting Options:*\n${optionsText}\n\n` +
        (game.ended ? '' : `To place a bet, use:\n.bet ${game.id} <option> <amount>`);
    
    await sock.sendMessage(remoteJid, { text: message });
}

/**
 * End a betting game (admin/owner only)
 */
async function endBet(sock, remoteJid, sender, args) {
    // Check if user is admin or owner
    const senderNumber = sender.split('@')[0];
    const normalizedNumber = database.normalizeNumber(senderNumber);
    
    // Check if owner
    const isUserOwner = config.botOwners.some(owner => 
        database.normalizeNumber(owner) === normalizedNumber
    );
    
    // Check if admin
    const isUserAdmin = config.botAdmins.some(admin => 
        database.normalizeNumber(admin) === normalizedNumber
    ) || isUserOwner;
    
    if (!isUserAdmin && !isUserOwner) {
        await sock.sendMessage(remoteJid, { 
            text: '⛔ Sorry, only admins can end betting games.' 
        });
        return;
    }
    
    if (!args || args.length < 2) {
        await sock.sendMessage(remoteJid, {
            text: '❌ Invalid command format. Use: .endbet <game_id> <winning_option>'
        });
        return;
    }
    
    const gameId = args[0];
    const winningOption = args[1];
    
    const result = animeBetting.endBettingGame(gameId, winningOption);
    
    if (result.success) {
        // Format winners list
        let winnersText = '';
        if (result.winners && result.winners.length > 0) {
            winnersText = '\n\n*Winners:*\n';
            result.winners.forEach((winner, index) => {
                winnersText += `${index + 1}. @${winner.userId.replace(/\D/g, '')} - Bet: ${winner.bet} points, Won: ${winner.winnings} points\n`;
            });
        } else {
            winnersText = '\n\nNo winners for this betting game.';
        }
        
        const message = `🏆 *Betting Game Ended!* 🏆\n\n` +
            `🆔 Game ID: ${result.gameId}\n` +
            `🎯 Winning option: *${result.winningOption}*\n` +
            `👥 Total winners: ${result.totalWinners}\n` +
            `👥 Total losers: ${result.totalLosers}${winnersText}`;
        
        // Get mentions for the winners
        const mentions = result.winners.map(winner => {
            return {
                tag: '@' + winner.userId.replace(/\D/g, ''),
                id: winner.userId.includes('@') ? winner.userId : winner.userId + '@s.whatsapp.net'
            };
        });
        
        await sock.sendMessage(remoteJid, { 
            text: message,
            mentions: mentions.map(m => m.id)
        });
    } else {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
    }
}

/**
 * Show user's betting statistics
 */
async function showUserStats(sock, remoteJid, sender) {
    const stats = animeBetting.getUserBettingStats(sender);
    
    // Get user points
    const points = pointsSystem.getUserPoints(sender);
    
    const message = `📊 *Your Betting Statistics* 📊\n\n` +
        `💰 *Current Points:* ${points}\n` +
        `🎲 *Total Bets Placed:* ${stats.totalBets}\n` +
        `🏆 *Wins:* ${stats.wins}\n` +
        `❌ *Losses:* ${stats.losses}\n` +
        `📈 *Win Rate:* ${stats.winRate}%\n` +
        `💵 *Total Amount Bet:* ${stats.totalAmount} points\n` +
        `💰 *Total Winnings:* ${stats.totalWinnings} points\n` +
        `📉 *Net Profit/Loss:* ${stats.netProfit > 0 ? '+' : ''}${stats.netProfit} points\n` +
        `📊 *ROI:* ${stats.roi > 0 ? '+' : ''}${stats.roi}%`;
    
    await sock.sendMessage(remoteJid, { text: message });
}

/**
 * Show help for betting commands
 */
async function showBettingHelp(sock, remoteJid) {
    const helpText = `🎲 *Anime Betting System Help* 🎲\n\n` +
        `*Available Commands:*\n\n` +
        
        `🎮 *.createbet <type> "<title>" "<options>" [<multiplier>]*\n` +
        `Creates a new betting game.\n` +
        `- <type>: The type of bet (use .bettypes to see all)\n` +
        `- "<title>": The title of your betting game\n` +
        `- "<options>": Comma-separated list of options to bet on\n` +
        `- [<multiplier>]: Optional payout multiplier (default: 2.0)\n\n` +
        
        `🎯 *.bet <game_id> <option> <amount>*\n` +
        `Places a bet on a specific game.\n` +
        `- <game_id>: The ID of the betting game\n` +
        `- <option>: The option you want to bet on\n` +
        `- <amount>: The amount of points to bet\n\n` +
        
        `📋 *.bets*\n` +
        `Lists all active betting games in the current group.\n\n` +
        
        `ℹ️ *.betinfo <game_id>*\n` +
        `Shows detailed information about a specific betting game.\n\n` +
        
        `🏁 *.endbet <game_id> <winning_option>* (Admin only)\n` +
        `Ends a betting game and distributes winnings.\n\n` +
        
        `📊 *.mystats*\n` +
        `Shows your personal betting statistics.\n\n` +
        
        `📜 *.bettypes*\n` +
        `Shows all available betting types and their descriptions.\n\n` +
        
        `*Betting Limits:*\n` +
        `- Minimum bet: ${require('../config').animeGames.betting.minBetAmount} points\n` +
        `- Maximum bet: ${require('../config').animeGames.betting.maxBetAmount} points\n` +
        `- Default multiplier: ${require('../config').animeGames.betting.defaultMultiplier}x\n` +
        `- Bet expiry: ${require('../config').animeGames.betting.gameExpiry} hours`;
    
    await sock.sendMessage(remoteJid, { text: helpText });
}

module.exports = {
    showBetTypes,
    createBet,
    placeBet,
    listBets,
    showBetInfo,
    endBet,
    showUserStats,
    showBettingHelp
};