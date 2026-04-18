const db = require('./server/config/db');

async function fixAll() {
    try {
        const result = await db.query("UPDATE usuarios SET password_hash = '$2y$10$examplehash.zC91G0e.C5d5a.A4g3f2b1' WHERE password_hash = '.zC91G0e.C5d5a.A4g3f2b1'");
        console.log('Fixed users: ', result[0].affectedRows);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
fixAll();
