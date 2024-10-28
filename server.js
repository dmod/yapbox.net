const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const port = 3000;

let db;

async function initializeDatabase() {
    db = await open({
        filename: '/data/messages.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    `);
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'web')));

app.get('/api/messages', async (req, res) => {
    try {
        const messages = await db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100');
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/messages', async (req, res) => {
    const messageText = req.body.message;
    if (messageText && messageText.length <= 140) {
        try {
            await db.run('INSERT INTO messages (text, timestamp) VALUES (?, ?)',
                [messageText, new Date().toISOString()]);
            res.sendStatus(200);
        } catch (error) {
            console.error('Error inserting message:', error);
            res.status(500).send('Internal Server Error');
        }
    } else {
        res.status(400).send('Invalid message');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});
