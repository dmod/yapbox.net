module.exports = {
    version: 2,
    up: async (db) => {
        await db.exec(`
            ALTER TABLE messages 
            ADD COLUMN ip_address TEXT DEFAULT 'unknown' NOT NULL
        `);
    }
}; 