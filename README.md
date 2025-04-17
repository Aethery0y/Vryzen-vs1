# Vryzen WhatsApp Bot

A feature-rich WhatsApp bot with anime-themed games, group management tools, and interactive features.

## 🌟 Features

- 🎮 Anime Quiz Game
- 🎴 Anime Card Collection Game
- 📊 Points & Achievement System
- 📰 Anime News Updates
- 👥 Group Management Tools
- 🔒 Admin & Protection Features
- 📈 Analytics & Activity Tracking

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/Aethery0y/Vryzen-vs1.git
cd Vryzen-vs1
```

2. Install dependencies:
```bash
npm install
```

3. Configure the bot:
- Copy `.env.example` to `.env`
- Fill in your configuration settings (see Configuration section below)

4. Connect to WhatsApp:
   
   Choose one of the following methods:

   ### Method 1: QR Code (Recommended)
   ```bash
   npm run start:qr
   ```
   - Scan the QR code with your WhatsApp
   - The session will be saved automatically

   ### Method 2: Phone Number Verification
   ```bash
   npm run start:phone
   ```
   - Enter your phone number with country code (e.g., +1234567890)
   - You'll receive a verification code on WhatsApp
   - Enter the verification code when prompted
   - The session will be saved automatically

5. Start the bot:
```bash
npm start
```

## 📝 Configuration

Create a `.env` file with the following variables:
```
# WhatsApp Configuration
WHATSAPP_CONNECTION_METHOD=qr    # Use 'qr' or 'phone'
WHATSAPP_NUMBER=your_number      # Required only for phone verification method
WHATSAPP_SESSION=your_session_name

# Bot Settings
BOT_OWNERS=owner1,owner2
BOT_NAME=Vryzen
BOT_PREFIX=.

# API Keys (if needed)
ANIME_API_KEY=your_key
NEWS_API_KEY=your_key
GEMINI_API_KEY=your_key
```

### WhatsApp Connection Settings

1. QR Code Method:
   - Set `WHATSAPP_CONNECTION_METHOD=qr` in `.env`
   - No phone number required
   - More secure and recommended for personal use

2. Phone Number Method:
   - Set `WHATSAPP_CONNECTION_METHOD=phone` in `.env`
   - Set `WHATSAPP_NUMBER` with your full phone number including country code
   - Useful for business accounts or when QR scanning is not possible

## 🎮 Available Commands

### General Commands
- `.cmds` - Shows all available commands
- `.help [command]` - Shows detailed help for a specific command
- `.admincmds` - Shows admin-only commands
- `.clear` - Clears the conversation
- `.sticker` - Creates a sticker from media

### Points System
- `.profile` - Shows your profile and points
- `.leaderboard` - Shows the points leaderboard
- `.dailycheck` - Claims your daily bonus points
- `.achievements` - Shows available achievements
- `.pointsinfo` - Shows points system rules

### Anime Games
- `.quiz start/new` - Starts a new quiz
- `.quiz end/stop` - Ends the current quiz
- `.quiz stats` - Shows your quiz statistics
- `.card draw` - Draws a new anime card
- `.card inventory` - Shows your card collection
- `.card trade` - Trades cards with other users

### Group Management
- `.track` - Tracks group changes
- `.active [period]` - Shows active members
- `.silence @user [duration]` - Silences a user
- `.influence` - Finds group influencers
- `.analyze` - Shows group analysis

### Admin Commands
- `.ban @user` - Bans a user
- `.setname [name]` - Sets group name
- `.adduser [number]` - Adds a user to the group
- `.admins` - Shows group admins
- `.securityalert` - Sends security alert

For a complete list of commands, see [COMMANDS.md](COMMANDS.md)

## 🔧 Development

### Project Structure
```
Vryzen-vs1/
├── commands/         # Command handlers
├── lib/             # Core functionality
├── config/          # Configuration files
├── database/        # Data storage
└── index.js         # Main entry point
```

### Adding New Features
1. Create new command handler in `commands/`
2. Add core functionality in `lib/`
3. Update command documentation in `COMMANDS.md`
4. Test thoroughly before deployment

## 📚 Documentation

- [Commands Documentation](COMMANDS.md)
- [API Documentation](docs/API.md)
- [Development Guide](docs/DEVELOPMENT.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## 👨‍💻 Author

- **Aether** - [GitHub](https://github.com/Aethery0y)

## 🙏 Acknowledgments

- Thanks to all contributors
- Special thanks to the WhatsApp Web API community
- Anime data provided by [Anime API](https://anime-api.com)

## ⚠️ Disclaimer

This bot is for educational purposes only. Use responsibly and in accordance with WhatsApp's Terms of Service.

## 🤖 AI Integration

The bot includes Gemini AI integration for enhanced interactions. To set up the AI features:

1. Get your Gemini API key:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the generated key

2. Add the key to your `.env` file:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. The AI features will be automatically enabled once the key is configured. 