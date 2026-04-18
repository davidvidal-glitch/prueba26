const fs = require('fs');
const db = require('./server/config/db');

async function extractDataFromLogs() {
    const logPath = './data.tsv';
    let content = '';
    try {
        content = fs.readFileSync(logPath, 'utf8');
    } catch (e) {
        console.error('Cannot read logs:', e.message);
        process.exit(1);
    }
    
    // Find the TSV block
    const lines = content.split('\n');
    let tsvLines = [];
    let inBlock = false;
    for (const line of lines) {
        if (!inBlock && line.includes('ALUMNOS') && line.includes('R.U.N.') && line.includes('CURSO')) {
            inBlock = true;
            // dont include header or include it? let's include to skip it easily later
        }
        if (inBlock) {
            if (line.includes('</USER_REQUEST>')) {
                break;
            }
            if (line.trim().length > 0) {
                tsvLines.push(line);
            }
        }
    }
    
    if (tsvLines.length === 0) {
        console.log('TSV Data not found in logs!');
        process.exit(1);
    }
    
    console.log(`Found ${tsvLines.length - 1} records. Processing...`);
    tsvLines.shift(); // remove header
    
    // Process records
    for (const record of tsvLines) {
        const parts = record.split('\t');
        if (parts.length < 10) continue;
        
        let [
            alumnoRaw, rutAlumno, cursoRaw, sexo, fNac, 
            domicilio, comuna, rutApoderado, nombreApoderadoRaw, telefonoApod
        ] = parts.map(p => p ? p.trim() : '');
        
        // Fix dates from M/D/YYYY to YYYY-MM-DD
        let fechaNac = null;
        if (fNac) {
            const dParts = fNac.split('/');
            if (dParts.length === 3) {
                fechaNac = `${dParts[2]}-${dParts[0].padStart(2, '0')}-${dParts[1].padStart(2, '0')}`;
            }
        }
        
        // Fix RUT format: ensuring uppercase K, and maybe standardizing?
        rutAlumno = rutAlumno.toUpperCase();
        rutApoderado = rutApoderado.toUpperCase();
        
        if (rutApoderado === '-' || rutApoderado === '') rutApoderado = null;
        if (rutAlumno === '-' || rutAlumno === '') rutAlumno = null;
        
        // APODERADO
        let idApoderado = null;
        if (rutApoderado) {
            // Split name
            // "david eladio vidal molina" -> Nombres: david eladio, Apellidos: vidal molina
            const aNameParts = nombreApoderadoRaw.split(' ');
            let aNombres = nombreApoderadoRaw;
            let aApellidos = '';
            if (aNameParts.length >= 3) {
                aApellidos = aNameParts.slice(-2).join(' ');
                aNombres = aNameParts.slice(0, -2).join(' ');
            } else if (aNameParts.length === 2) {
                aNombres = aNameParts[0];
                aApellidos = aNameParts[1];
            }
            
            // Query or insert
            try {
                const [extApo] = await db.query('SELECT id_apoderado FROM apoderados WHERE rut = ?', [rutApoderado]);
                if (extApo.length > 0) {
                    idApoderado = extApo[0].id_apoderado;
                } else {
                    const [resApo] = await db.query(
                        'INSERT INTO apoderados (rut, nombres, apellidos, telefono, parentesco) VALUES (?, ?, ?, ?, ?)',
                        [rutApoderado, aNombres, aApellidos, telefonoApod !== '-' ? telefonoApod : null, 'Apoderado']
                    );
                    idApoderado = resApo.insertId;
                }
            } catch(e) { console.error('Error with apoderado '+rutApoderado, e.message); }
        }
        
        // CURSO
        let idCurso = null;
        if (cursoRaw) {
            // Find existing
            const cNivelLen = cursoRaw.lastIndexOf(' ');
            let nivelQuery = cNivelLen > 0 ? cursoRaw.substring(0, cNivelLen).trim() : cursoRaw;
            let letraQuery = cNivelLen > 0 ? cursoRaw.substring(cNivelLen).trim() : '-';
            
            try {
                const [extCur] = await db.query('SELECT id_curso FROM cursos WHERE nivel = ? AND letra = ?', [nivelQuery, letraQuery]);
                if (extCur.length > 0) {
                    idCurso = extCur[0].id_curso;
                } else {
                    const [resCur] = await db.query('INSERT INTO cursos (nivel, letra, anio_academico) VALUES (?, ?, ?)', [nivelQuery, letraQuery, new Date().getFullYear()]);
                    idCurso = resCur.insertId;
                }
            } catch(e) { console.error('Error with curso '+cursoRaw, e.message); }
        }
        
        // ESTUDIANTE
        if (rutAlumno) {
            // Split names "Vidal Umanzor Martín Aukan" -> Apellido: Vidal Umanzor, Nombre: Martín Aukan
            const eNameParts = alumnoRaw.split(' ');
            let eNombres = alumnoRaw;
            let eApellidos = '';
            if (eNameParts.length >= 3) {
                eApellidos = eNameParts.slice(0, 2).join(' ');
                eNombres = eNameParts.slice(2).join(' ');
            } else if (eNameParts.length === 2) {
                eApellidos = eNameParts[0];
                eNombres = eNameParts[1];
            }
            
            try {
                const [extEst] = await db.query('SELECT id_estudiante FROM estudiantes WHERE rut = ?', [rutAlumno]);
                if (extEst.length > 0) {
                    // Update to avoid duplicates
                    await db.query(`UPDATE estudiantes SET nombres=?, apellidos=?, sexo=?, fecha_nacimiento=?, direccion=?, comuna=?, id_curso=?, id_apoderado_titular=? WHERE rut=?`,
                    [eNombres, eApellidos, sexo, fechaNac, domicilio, comuna, idCurso, idApoderado || 0, rutAlumno]);
                } else {
                    // Insert
                    await db.query(`INSERT INTO estudiantes (rut, nombres, apellidos, sexo, fecha_nacimiento, direccion, comuna, id_curso, id_apoderado_titular, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Regular')`,
                    [rutAlumno, eNombres, eApellidos, sexo, fechaNac, domicilio, comuna, idCurso, idApoderado || 0]);
                }
            } catch(e) { console.error('Error with estudiante '+rutAlumno, e.message); }
        }
    }
    console.log('Data import completed!');
    process.exit(0);
}

extractDataFromLogs();
