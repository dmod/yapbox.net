const fs = require('fs');
const path = require('path');

const migrationName = process.argv[2];
if (!migrationName) {
    console.error('Please provide a migration name');
    process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'migrations');
const existingMigrations = fs.readdirSync(migrationsDir);
const nextVersion = String(existingMigrations.length + 1).padStart(3, '0');

const template = `module.exports = {
    version: ${parseInt(nextVersion)},
    up: async (db) => {
        await db.exec(\`
            -- Your migration SQL here
        \`);
    }
};
`;

const filename = `${nextVersion}-${migrationName}.js`;
fs.writeFileSync(path.join(migrationsDir, filename), template);
console.log(`Created migration file: ${filename}`); 