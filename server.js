const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;

// In-memory storage for messages (replace this with a database in production)
let messages = [];

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'web')));

app.get('/api/messages', (req, res) => {
    res.json(messages);
});

app.post('/api/messages', (req, res) => {
    const message = req.body.message;
    if (message && message.length <= 140) {
        messages.unshift(message); // Add new message to the beginning of the array
        if (messages.length > 100) {
            messages = messages.slice(0, 100); // Keep only the latest 100 messages
        }
        console.log(`messages length: ${messages.length}`)
        res.sendStatus(200);
    } else {
        res.status(400).send('Invalid message');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});