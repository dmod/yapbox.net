const fs = require('fs');
const path = require('path');

async function initMigrationTable(db) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function getAppliedMigrations(db) {
    return await db.all('SELECT version FROM migrations ORDER BY version ASC');
}

async function runMigrations(db) {
    await initMigrationTable(db);
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrations = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .map(file => require(path.join(migrationsDir, file)))
        .sort((a, b) => a.version - b.version);

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(db);
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    console.log(`Applied migrations: ${appliedMigrations.map(m => m.version).join(', ')}`);

    // Run pending migrations
    for (const migration of migrations) {
        if (!appliedVersions.has(migration.version)) {
            console.log(`Running migration version ${migration.version}...`);
            await migration.up(db);
            await db.run('INSERT INTO migrations (version) VALUES (?)', migration.version);
            console.log(`Migration version ${migration.version} completed`);
        }
    }
}

module.exports = { runMigrations }; 