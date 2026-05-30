const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    const hashedPassword = await bcrypt.hash('1234', 10);
    const hashedAdmin = await bcrypt.hash('admin', 10);

    const usersSQL = `
      INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES
        ('tecnico1', $1, 'Carlos Mendez', 'tecnico'),
        ('tecnico2', $1, 'Ana Rodriguez', 'tecnico'),
        ('supervisor', $2, 'Luis Torres', 'supervisor'),
        ('admin', $2, 'Administrador', 'admin')
      ON CONFLICT (username) DO NOTHING
    `;

    await pool.query(usersSQL, [hashedPassword, hashedAdmin]);

    const edificiosSQL = `
      INSERT INTO edificios (codigo, nombre, direccion, estado) VALUES
        ('ED001234', 'Edificio Central', 'Av. Principal 123', 'pendiente'),
        ('ED002567', 'Torre Norte', 'Calle Los Olivos 456', 'pendiente'),
        ('ED003891', 'Plaza Sur', 'Jr. Amazonas 789', 'pendiente'),
        ('ED004123', 'Centro Comercial', 'Av. Arequipa 1010', 'pendiente'),
        ('ED005678', 'Hospital General', 'Av. Salaverry 2020', 'pendiente'),
        ('ED006912', 'Escuela San Martin', 'Calle 28 de Julio 305', 'pendiente'),
        ('ED007345', 'Municipalidad', 'Plaza de Armas 100', 'pendiente'),
        ('ED008789', 'Estadio Nacional', 'Av. Jose Diaz 456', 'pendiente'),
        ('ED009012', 'Biblioteca Municipal', 'Jr. Ucayali 789', 'pendiente'),
        ('ED010345', 'Mercado Central', 'Av. Colon 1234', 'pendiente'),
        ('ED011678', 'Terminal Terrestre', 'Av. Velasco Astete 500', 'pendiente'),
        ('ED012901', 'Parque Industrial', 'Zona Industrial Lote 8', 'pendiente'),
        ('ED013234', 'Club Deportivo', 'Av. La Marina 2500', 'pendiente'),
        ('ED014567', 'Iglesia San Pedro', 'Jr. Ayacucho 321', 'pendiente'),
        ('ED015890', 'Hotel Continental', 'Av. Pardo 654', 'pendiente'),
        ('ED016123', 'Banco de la Nacion', 'Jr. Callao 987', 'pendiente'),
        ('ED017456', 'Comisaria PNP', 'Av. Grau 1500', 'pendiente'),
        ('ED018789', 'Posta Medica', 'Calle Los Jazmines 200', 'pendiente'),
        ('ED019012', 'Universidad Nacional', 'Av. Universitaria 3000', 'pendiente'),
        ('ED020345', 'Residencial Las Palmas', 'Urb. Las Palmas Mz A', 'pendiente')
      ON CONFLICT (codigo) DO NOTHING
    `;

    await pool.query(edificiosSQL);

    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Seed failed:', error.message);
  } finally {
    await pool.end();
  }
}

seed();
