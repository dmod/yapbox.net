const crypto = require('crypto');
const readline = require('readline');

// Use the same salt and iterations as in server.js
const ADMIN_SALT = 'f7d8e9c4b3a2';
const PBKDF2_ITERATIONS = 650009; // High iteration count for single admin user

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(`\nGenerating hash with ${PBKDF2_ITERATIONS.toLocaleString()} iterations (this may take a few seconds)...`);

rl.question('Enter new admin password: ', (password) => {
    const hashedPassword = crypto.pbkdf2Sync(password, ADMIN_SALT, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    console.log('\nNew ADMIN_HASH value:');
    console.log(hashedPassword);
    console.log('\nReplace the ADMIN_HASH value in server.js with this hash to update the admin password.');
    rl.close();
}); 