const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3');
const db3 = new sqlite3.verbose().Database;
const { open } = require('sqlite');
const { runMigrations } = require('./db/migrations');

const app = express();
const port = 3000;
const isProd = process.env.NODE_ENV === 'production';
const dbPath = isProd ? '/data/messages.db' : './dev.db';

let db;

app.set('trust proxy', true);

async function initializeDatabase() {
    try {
        db = await open({
            filename: dbPath,
            driver: db3
        });
        
        await runMigrations(db);
        console.log('Database initialization and migrations completed');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;  // Re-throw to prevent server start if DB init fails
    }
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
    const ip = req.ip || req.socket.remoteAddress;

    if (messageText && messageText.length <= 3000) {
        try {
            console.log(`Incoming message from ${ip}: ${messageText}`);
            await db.run(
                'INSERT INTO messages (text, timestamp, ip_address) VALUES (?, ?, ?)',
                [messageText, new Date().toISOString(), ip]
            );
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
        console.log(`Server running on port ${port}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
});
