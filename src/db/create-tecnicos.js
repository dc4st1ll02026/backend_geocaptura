const bcrypt = require('bcryptjs');
const pool = require('../config/database');

function normalizeDistrito(distrito) {
  let normalized = distrito.toLowerCase();

  const accentMap = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
    'ñ': 'n', 'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
    'ã': 'a', 'õ': 'o',
  };

  normalized = normalized.replace(/[áéíóúàèìòùäëïöüñâêîôûãõ]/g, (m) => accentMap[m] || m);

  normalized = normalized.replace(/[/()"''.]/g, '');

  normalized = normalized.replace(/\s+/g, '-');

  normalized = normalized.replace(/-+/g, '-');

  normalized = normalized.replace(/^-|-$/g, '');

  return normalized;
}

async function main() {
  try {
    console.log('=== PASO 1: Obtener distritos únicos ===');
    const distritosRes = await pool.query(
      'SELECT DISTINCT codigo_distrito, distrito FROM edificios WHERE codigo_distrito IS NOT NULL ORDER BY codigo_distrito'
    );
    console.log(`Total distritos: ${distritosRes.rows.length}`);

    console.log('\n=== PASO 2: Crear usuarios técnicos ===');
    let created = 0;
    let skipped = 0;
    const usuariosCreados = [];

    for (const row of distritosRes.rows) {
      const cod = row.codigo_distrito;
      const distrito = row.distrito;
      const username = `${cod}-${normalizeDistrito(distrito)}`;
      const password = String(cod);
      const nombre = `Técnico ${distrito}`;

      try {
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
          `INSERT INTO usuarios (username, password_hash, nombre, rol, activo)
           VALUES ($1, $2, $3, 'tecnico', true)
           ON CONFLICT (username) DO NOTHING RETURNING id`,
          [username, passwordHash, nombre]
        );

        if (result.rows.length > 0) {
          usuariosCreados.push({ id: result.rows[0].id, codigo_distrito: cod });
          created++;
        } else {
          const existing = await pool.query('SELECT id FROM usuarios WHERE username = $1', [username]);
          if (existing.rows.length > 0) {
            usuariosCreados.push({ id: existing.rows[0].id, codigo_distrito: cod });
            skipped++;
          }
        }
      } catch (error) {
        console.error(`Error creando usuario ${username}: ${error.message}`);
      }
    }

    console.log(`Usuarios creados: ${created}`);
    console.log(`Usuarios existentes (reutilizados): ${skipped}`);
    console.log(`Total usuarios listos: ${usuariosCreados.length}`);

    console.log('\n=== PASO 3: Asignar edificios a técnicos ===');
    let totalAsignados = 0;

    for (const user of usuariosCreados) {
      const result = await pool.query(
        'UPDATE edificios SET tecnico_id = $1 WHERE codigo_distrito = $2 AND (tecnico_id IS NULL OR tecnico_id != $1)',
        [user.id, user.codigo_distrito]
      );
      totalAsignados += result.rowCount;
    }

    console.log(`Edificios asignados: ${totalAsignados}`);

    console.log('\n=== PASO 4: Verificación ===');
    const verifyRes = await pool.query(`
      SELECT 
        u.username,
        u.nombre,
        COUNT(e.codigo) as edificios_asignados
      FROM usuarios u
      LEFT JOIN edificios e ON u.id = e.tecnico_id
      WHERE u.rol = 'tecnico'
      GROUP BY u.id, u.username, u.nombre
      ORDER BY edificios_asignados DESC
      LIMIT 10
    `);

    console.log('Top 10 técnicos por edificios asignados:');
    verifyRes.rows.forEach(row => {
      console.log(`  ${row.username} (${row.nombre}): ${row.edificios_asignados} edificios`);
    });

    const totalTecnicos = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'tecnico'");
    const totalConAsignacion = await pool.query('SELECT COUNT(*) FROM usuarios u WHERE u.rol = $1 AND EXISTS (SELECT 1 FROM edificios e WHERE e.tecnico_id = u.id)', ['tecnico']);
    const totalEdificiosAsignados = await pool.query('SELECT COUNT(*) FROM edificios WHERE tecnico_id IS NOT NULL');

    console.log(`\nTotal técnicos: ${totalTecnicos.rows[0].count}`);
    console.log(`Técnicos con edificios asignados: ${totalConAsignacion.rows[0].count}`);
    console.log(`Total edificios asignados: ${totalEdificiosAsignados.rows[0].count}`);

    const sinAsignar = await pool.query('SELECT COUNT(*) FROM edificios WHERE tecnico_id IS NULL');
    console.log(`Edificios sin asignar: ${sinAsignar.rows[0].count}`);

  } catch (error) {
    console.error('Error general:', error);
  } finally {
    await pool.end();
  }
}

main();
