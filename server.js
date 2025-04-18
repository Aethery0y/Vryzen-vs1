const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Keep-alive server running on port ${PORT}`);
}); 