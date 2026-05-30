const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../config/database');
const { validationMiddleware } = require('../middleware/validation');

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(4).max(100),
  nombre: z.string().min(1).max(100),
  rol: z.enum(['tecnico', 'supervisor', 'admin']),
});

const updateUserSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  password: z.string().min(4).max(100).optional(),
  rol: z.enum(['tecnico', 'supervisor', 'admin']).optional(),
  activo: z.boolean().optional(),
});

async function getAll(req, res) {
  try {
    const { rol, activo } = req.query;

    let query = 'SELECT id, username, nombre, rol, activo, created_at, updated_at FROM usuarios WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (rol) {
      query += ` AND rol = $${paramIndex}`;
      params.push(rol);
      paramIndex++;
    }

    if (activo !== undefined) {
      query += ` AND activo = $${paramIndex}`;
      params.push(activo === 'true');
      paramIndex++;
    }

    query += ' ORDER BY nombre ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('GetAll usuarios error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, username, nombre, rol, activo, created_at, updated_at FROM usuarios WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('GetById error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function create(req, res) {
  const { username, password, nombre, rol } = req.validatedBody;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1, $2, $3, $4) RETURNING id, username, nombre, rol, activo, created_at',
      [username, passwordHash, nombre, rol]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese username' });
    }
    console.error('Create error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const updates = req.validatedBody;

  try {
    if (updates.password) {
      updates.password_hash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const setClauses = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = Object.values(updates);

    const result = await pool.query(
      `UPDATE usuarios SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING id, username, nombre, rol, activo, updated_at`,
      [...values, parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE usuarios SET activo = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  getAll,
  getById,
  create: [validationMiddleware(createUserSchema), create],
  update: [validationMiddleware(updateUserSchema), update],
  remove,
};
