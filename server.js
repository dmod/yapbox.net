const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3');
const db3 = new sqlite3.verbose().Database;
const { open } = require('sqlite');
const { runMigrations } = require('./db/migrations');
const crypto = require('crypto');
const session = require('express-session');

// Static admin credentials - pre-computed hash of password with salt
const ADMIN_SALT = 'f7d8e9c4b3a2';
const PBKDF2_ITERATIONS = 650009; // High iteration count for single admin user
const ADMIN_HASH = '6a2a986f8cd14cf7b2e770172b45306dc6834ca6b72c2a51ff17976b46700d2177e1bcdaacdc6596b0c0713572ec6a41b34541dfac60b8c33f26c9053a018060';

const app = express();
const port = 3000;
const isProd = process.env.NODE_ENV === 'production';
const dbPath = isProd ? '/data/messages.db' : './dev.db';

app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProd, // Use secure cookies in production
        httpOnly: true,
        maxAge: 60 * 60 * 1000 // 1 hour
    }
}));


let db;

app.set('trust proxy', true);

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
}

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

// Admin authentication function
function authenticatePassword(password) {
    const hashedInput = crypto.pbkdf2Sync(password, ADMIN_SALT, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    return hashedInput === ADMIN_HASH;
}

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'admin.html'));
});

app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;

    try {
        const isValid = authenticatePassword(password);
        if (isValid) {
            req.session.isAuthenticated = true;
            res.sendStatus(200);
        } else {
            res.status(401).send('Invalid password');
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.delete('/api/admin/messages/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        await db.run('DELETE FROM messages WHERE id = ?', id);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const messages = await db.all('SELECT * FROM messages ORDER BY timestamp DESC');
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

app.get('/api/message-count', async (req, res) => {
    try {
        const result = await db.get('SELECT MAX(id) as count FROM messages');
        res.json({ count: result.count || 0 });
    } catch (error) {
        console.error('Error fetching message count:', error);
        res.status(500).send('Internal Server Error');
    }
});

initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
});