const db = require('./server/config/db');

async function dumpSchemas() {
    try {
        const [estudiantes] = await db.query('DESCRIBE estudiantes');
        console.log('ESTUDIANTES', JSON.stringify(estudiantes, null, 2));

        const [apoderados] = await db.query('DESCRIBE apoderados');
        console.log('APODERADOS', JSON.stringify(apoderados, null, 2));

        const [cursos] = await db.query('DESCRIBE cursos');
        console.log('CURSOS', JSON.stringify(cursos, null, 2));

        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
dumpSchemas();
