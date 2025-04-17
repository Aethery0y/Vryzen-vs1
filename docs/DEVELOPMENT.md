# Development Guide

## Getting Started

1. Fork and clone the repository
2. Install dependencies:
```bash
npm install
```
3. Copy `.env.example` to `.env` and configure your settings
4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
Vryzen-vs1/
├── commands/         # Command handlers
│   ├── general.js    # General commands
│   ├── points.js     # Points system
│   ├── animeQuiz.js  # Quiz game
│   └── ...          # Other commands
├── lib/             # Core functionality
│   ├── database.js   # Database operations
│   ├── pointsSystem.js # Points system
│   └── ...          # Other core features
├── config/          # Configuration
│   └── index.js     # Main config
├── database/        # Data storage
└── index.js         # Main entry point
```

## Adding New Commands

1. Create a new file in `commands/` directory
2. Implement your command handler:
```javascript
async function handleYourCommand(params) {
    const { sock, message, messageContent, sender, remoteJid } = params;
    // Your command logic here
}

module.exports = {
    handleYourCommand
};
```

3. Add your command to `commands/index.js`:
```javascript
case 'yourcommand':
    await yourCommands.handleYourCommand(params);
    break;
```

## Database Operations

Use the database module for data operations:
```javascript
const database = require('../lib/database');

// Get data
const data = database.getData(key);

// Set data
database.setData(key, value);

// Update data
database.updateData(key, (oldValue) => {
    // Modify oldValue
    return newValue;
});
```

## Testing

1. Run tests:
```bash
npm test
```

2. Test specific features:
```bash
npm test -- --grep "feature name"
```

## Code Style

- Use 2 spaces for indentation
- Follow JavaScript Standard Style
- Add JSDoc comments for functions
- Write descriptive commit messages

## Pull Request Process

1. Create a new branch for your feature
2. Write tests for your changes
3. Update documentation
4. Submit pull request with description

## Common Issues

### Database Connection
- Ensure database path is correct in `.env`
- Check file permissions
- Verify encryption key

### WhatsApp Connection
- Check session validity
- Verify phone number format
- Ensure stable internet connection

### Command Issues
- Check command permissions
- Verify argument parsing
- Test error handling

## Need Help?

- Open an issue
- Join our Discord server
- Check the FAQ 