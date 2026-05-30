const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const XLS_DIR = path.join(__dirname, '..', '..', '..', 'xlss');
const BATCH_SIZE = 500;

async function importAll() {
  const files = fs.readdirSync(XLS_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('.~'));
  console.log(`Found ${files.length} files to process`);

  let totalFiles = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    try {
      const filePath = path.join(XLS_DIR, file);
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length < 4) {
        console.log(`SKIP ${file}: less than 4 rows`);
        totalSkipped++;
        continue;
      }

      const rows = data.slice(3);
      const edificios = [];

      for (const row of rows) {
        if (!row || row.length < 10) continue;

        const cod_le_id = row[3];
        if (!cod_le_id) continue;

        edificios.push({
          codigo: String(cod_le_id),
          nombre: row[5] || 'Sin nombre',
          direccion: row[7] || '',
          id_departamento: row[1] || null,
          desc_departamento: row[2] || null,
          cod_ue: String(row[4] || ''),
          desc_ue: row[5] || null,
          codigo_distrito: row[6] || null,
          distrito: row[7] || null,
          lat: row[8] ? parseFloat(row[8]) : null,
          lng: row[9] ? parseFloat(row[9]) : null,
          estado: 'pendiente',
        });
      }

      if (edificios.length === 0) {
        console.log(`SKIP ${file}: no valid rows`);
        totalSkipped++;
        continue;
      }

      for (let i = 0; i < edificios.length; i += BATCH_SIZE) {
        const batch = edificios.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const e of batch) {
          placeholders.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10},$${idx+11})`);
          values.push(
            e.codigo, e.nombre, e.direccion, e.id_departamento,
            e.desc_departamento, e.cod_ue, e.desc_ue, e.codigo_distrito,
            e.distrito, e.lat, e.lng, e.estado
          );
          idx += 12;
        }

        const sql = `
          INSERT INTO edificios (codigo, nombre, direccion, id_departamento, desc_departamento, cod_ue, desc_ue, codigo_distrito, distrito, lat, lng, estado)
          VALUES ${placeholders.join(',')}
          ON CONFLICT (codigo) DO NOTHING
        `;

        const result = await pool.query(sql, values);
        totalInserted += result.rowCount;
      }

      totalFiles++;
      console.log(`OK ${file}: ${edificios.length} rows`);
    } catch (error) {
      totalErrors++;
      console.error(`ERROR ${file}: ${error.message}`);
    }
  }

  console.log(`\n=== IMPORT SUMMARY ===`);
  console.log(`Files processed: ${totalFiles}`);
  console.log(`Files skipped: ${totalSkipped}`);
  console.log(`Files with errors: ${totalErrors}`);
  console.log(`Total inserted: ${totalInserted}`);

  const countResult = await pool.query('SELECT COUNT(*) FROM edificios');
  console.log(`Total edificios in DB: ${countResult.rows[0].count}`);

  await pool.end();
}

importAll();
