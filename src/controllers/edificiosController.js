const { z } = require('zod');
const pool = require('../config/database');
const { validationMiddleware } = require('../middleware/validation');

const createEdificioSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(1).max(200),
  direccion: z.string().min(1).max(300),
  id_departamento: z.number().int().optional(),
  desc_departamento: z.string().max(100).optional(),
  cod_ue: z.string().max(20).optional(),
  desc_ue: z.string().max(200).optional(),
  codigo_distrito: z.number().int().optional(),
  distrito: z.string().max(100).optional(),
});

const updateEdificioSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  direccion: z.string().min(1).max(300).optional(),
  estado: z.enum(['pendiente', 'capturado', 'sincronizado']).optional(),
  id_departamento: z.number().int().optional(),
  desc_departamento: z.string().max(100).optional(),
  cod_ue: z.string().max(20).optional(),
  desc_ue: z.string().max(200).optional(),
  codigo_distrito: z.number().int().optional(),
  distrito: z.string().max(100).optional(),
});

const coordenadaSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number(),
  timestamp: z.string().datetime(),
});

async function getAll(req, res) {
  try {
    const { estado, search, tecnico_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT e.*, u.nombre as tecnico_nombre
      FROM edificios e
      LEFT JOIN usuarios u ON e.tecnico_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (estado) {
      query += ` AND e.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    if (search) {
      query += ` AND (e.codigo ILIKE $${paramIndex} OR e.nombre ILIKE $${paramIndex} OR e.direccion ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (tecnico_id) {
      query += ` AND e.tecnico_id = $${paramIndex}`;
      params.push(parseInt(tecnico_id));
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE e.estado 
        WHEN 'pendiente' THEN 1 
        WHEN 'capturado' THEN 2 
        WHEN 'sincronizado' THEN 3 
      END, e.codigo
    `;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const countQuery = 'SELECT COUNT(*) FROM edificios WHERE 1=1' +
      (estado ? ` AND estado = '${estado}'` : '') +
      (search ? ` AND (codigo ILIKE '%${search}%' OR nombre ILIKE '%${search}%' OR direccion ILIKE '%${search}%')` : '') +
      (tecnico_id ? ` AND tecnico_id = ${tecnico_id}` : '');
    const countResult = await pool.query(countQuery);

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('GetAll edificios error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getById(req, res) {
  try {
    const { codigo } = req.params;
    const result = await pool.query(
      `SELECT e.*, u.nombre as tecnico_nombre 
       FROM edificios e 
       LEFT JOIN usuarios u ON e.tecnico_id = u.id 
       WHERE e.codigo = $1`,
      [codigo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }

    const coordenadasResult = await pool.query(
      `SELECT c.*, u.nombre as tecnico_nombre 
       FROM coordenadas c 
       LEFT JOIN usuarios u ON c.tecnico_id = u.id 
       WHERE c.edificio_codigo = $1 
       ORDER BY c.timestamp DESC`,
      [codigo]
    );

    res.json({
      ...result.rows[0],
      coordenadas: coordenadasResult.rows,
    });
  } catch (error) {
    console.error('GetById error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function create(req, res) {
  const { codigo, nombre, direccion, id_departamento, desc_departamento, cod_ue, desc_ue, codigo_distrito, distrito } = req.validatedBody;

  try {
    const result = await pool.query(
      `INSERT INTO edificios (codigo, nombre, direccion, id_departamento, desc_departamento, cod_ue, desc_ue, codigo_distrito, distrito) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [codigo, nombre, direccion, id_departamento || null, desc_departamento || null, cod_ue || null, desc_ue || null, codigo_distrito || null, distrito || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un edificio con ese código' });
    }
    console.error('Create error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function update(req, res) {
  const { codigo } = req.params;
  const updates = req.validatedBody;

  try {
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = Object.values(updates);

    const result = await pool.query(
      `UPDATE edificios SET ${setClauses}, updated_at = NOW() WHERE codigo = $${values.length + 1} RETURNING *`,
      [...values, codigo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function remove(req, res) {
  try {
    const { codigo } = req.params;
    const result = await pool.query('DELETE FROM edificios WHERE codigo = $1 RETURNING codigo', [codigo]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }

    res.json({ message: 'Edificio eliminado correctamente' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateCoordenada(req, res) {
  const { codigo } = req.params;
  const { lat, lng, accuracy, timestamp } = req.validatedBody;
  const tecnicoId = req.usuario.id;

  try {
    const edificioResult = await pool.query('SELECT * FROM edificios WHERE codigo = $1', [codigo]);
    if (edificioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }

    await pool.query(
      'INSERT INTO coordenadas (edificio_codigo, lat, lng, accuracy, timestamp, tecnico_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [codigo, lat, lng, accuracy, timestamp, tecnicoId]
    );

    const updated = await pool.query(
      `UPDATE edificios 
       SET lat = $1, lng = $2, accuracy = $3, captura_timestamp = $4, estado = 'capturado', tecnico_id = $5, updated_at = NOW() 
       WHERE codigo = $6 RETURNING *`,
      [lat, lng, accuracy, timestamp, tecnicoId, codigo]
    );

    res.json({
      message: 'Coordenada actualizada correctamente',
      edificio: updated.rows[0],
    });
  } catch (error) {
    console.error('Update coordenada error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function sincronizar(req, res) {
  const { codigo } = req.params;
  const { lat, lng, accuracy, timestamp } = req.body;
  const tecnicoId = req.usuario.id;

  try {
    const edificioResult = await pool.query('SELECT * FROM edificios WHERE codigo = $1', [codigo]);
    if (edificioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }

    const edificio = edificioResult.rows[0];

    if (edificio.estado === 'sincronizado') {
      return res.status(400).json({ error: 'El edificio ya fue sincronizado previamente' });
    }

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Se requieren coordenadas para sincronizar' });
    }

    await pool.query(
      'INSERT INTO coordenadas (edificio_codigo, lat, lng, accuracy, timestamp, tecnico_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [codigo, lat, lng, accuracy, timestamp, tecnicoId]
    );

    const updated = await pool.query(
      `UPDATE edificios 
       SET lat = $1, lng = $2, accuracy = $3, captura_timestamp = $4, estado = 'sincronizado', sync_timestamp = NOW(), tecnico_id = $5, updated_at = NOW() 
       WHERE codigo = $6 RETURNING *`,
      [lat, lng, accuracy, timestamp, tecnicoId, codigo]
    );

    await pool.query(
      'INSERT INTO sync_logs (tipo, mensaje, exito, edificio_codigo, tecnico_id) VALUES ($1, $2, $3, $4, $5)',
      ['sync', `Edificio ${codigo} sincronizado correctamente`, true, codigo, tecnicoId]
    );

    res.json({
      message: 'Edificio sincronizado correctamente',
      edificio: updated.rows[0],
    });
  } catch (error) {
    await pool.query(
      'INSERT INTO sync_logs (tipo, mensaje, exito, edificio_codigo, tecnico_id) VALUES ($1, $2, $3, $4, $5)',
      ['error', `Error sincronizando edificio ${codigo}: ${error.message}`, false, codigo, tecnicoId]
    );

    console.error('Sincronizar error:', error);
    res.status(500).json({ error: 'Error al sincronizar' });
  }
}

const asignarSchema = z.object({
  tecnico_id: z.number().int().positive(),
});

const asignarLoteSchema = z.object({
  tecnico_id: z.number().int().positive(),
  codigos: z.array(z.string().min(1)).min(1),
});

async function getMisEdificios(req, res) {
  try {
    const result = await pool.query(
      `SELECT e.*, u.nombre as tecnico_nombre
       FROM edificios e
       LEFT JOIN usuarios u ON e.tecnico_id = u.id
       WHERE e.tecnico_id = $1
       ORDER BY 
         CASE e.estado 
           WHEN 'pendiente' THEN 1 
           WHEN 'capturado' THEN 2 
           WHEN 'sincronizado' THEN 3 
         END, e.codigo`,
      [req.usuario.id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('GetMisEdificios error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function asignarEdificio(req, res) {
  const { tecnico_id } = req.validatedBody;
  const { codigo } = req.params;

  try {
    const userCheck = await pool.query('SELECT id FROM usuarios WHERE id = $1 AND rol = $2', [tecnico_id, 'tecnico']);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'El usuario debe ser un técnico de campo' });
    }

    const result = await pool.query(
      'UPDATE edificios SET tecnico_id = $1, updated_at = NOW() WHERE codigo = $2 RETURNING *',
      [tecnico_id, codigo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Asignar edificio error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function asignarLote(req, res) {
  const { tecnico_id, codigos } = req.validatedBody;

  try {
    const userCheck = await pool.query('SELECT id FROM usuarios WHERE id = $1 AND rol = $2', [tecnico_id, 'tecnico']);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'El usuario debe ser un técnico de campo' });
    }

    const result = await pool.query(
      'UPDATE edificios SET tecnico_id = $1, updated_at = NOW() WHERE codigo = ANY($2) RETURNING codigo, nombre, tecnico_id',
      [tecnico_id, codigos]
    );

    res.json({
      message: `${result.rows.length} edificios asignados correctamente`,
      asignados: result.rows,
    });
  } catch (error) {
    console.error('Asignar lote error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getEdificiosPorTecnico(req, res) {
  try {
    const { tecnico_id } = req.params;
    const result = await pool.query(
      `SELECT e.*, u.nombre as tecnico_nombre
       FROM edificios e
       LEFT JOIN usuarios u ON e.tecnico_id = u.id
       WHERE e.tecnico_id = $1
       ORDER BY e.codigo`,
      [tecnico_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('GetEdificiosPorTecnico error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function resetSincronizacion(req, res) {
  const { codigo } = req.params;
  const adminId = req.usuario.id;

  try {
    const edificioResult = await pool.query('SELECT * FROM edificios WHERE codigo = $1', [codigo]);
    if (edificioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Edificio no encontrado' });
    }

    const edificio = edificioResult.rows[0];

    await pool.query(
      `UPDATE edificios 
       SET estado = 'pendiente', lat = NULL, lng = NULL, accuracy = NULL, 
           captura_timestamp = NULL, sync_timestamp = NULL, tecnico_id = NULL, updated_at = NOW() 
       WHERE codigo = $1 RETURNING *`,
      [codigo]
    );

    await pool.query('DELETE FROM coordenadas WHERE edificio_codigo = $1', [codigo]);

    await pool.query(
      'INSERT INTO sync_logs (tipo, mensaje, exito, edificio_codigo, tecnico_id) VALUES ($1, $2, $3, $4, $5)',
      ['info', `Sincronización reseteada por admin (edificio ${codigo})`, true, codigo, adminId]
    );

    res.json({
      message: 'Sincronización reseteada correctamente',
      edificio: { codigo, estado: 'pendiente' },
    });
  } catch (error) {
    console.error('ResetSincronizacion error:', error);
    res.status(500).json({ error: 'Error al resetear sincronización' });
  }
}

module.exports = {
  getAll,
  getById,
  getMisEdificios,
  create: [validationMiddleware(createEdificioSchema), create],
  update: [validationMiddleware(updateEdificioSchema), update],
  remove,
  asignarEdificio: [validationMiddleware(asignarSchema), asignarEdificio],
  asignarLote: [validationMiddleware(asignarLoteSchema), asignarLote],
  getEdificiosPorTecnico,
  updateCoordenada: [validationMiddleware(coordenadaSchema), updateCoordenada],
  sincronizar,
  resetSincronizacion,
};
