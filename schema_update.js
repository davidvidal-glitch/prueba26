const db = require('./server/config/db');

async function updateSchema() {
    try {
        console.log('Adding columns...');
        await db.query(`ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS sexo VARCHAR(1)`);
        await db.query(`ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS comuna VARCHAR(100)`);
        console.log('Columns added.');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
updateSchema();
