const pool = require('../config/database');

async function getAll(req, res) {
  try {
    const { page = 1, limit = 50, edificio_codigo, tecnico_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT c.*, e.nombre as edificio_nombre, u.nombre as tecnico_nombre
      FROM coordenadas c
      LEFT JOIN edificios e ON c.edificio_codigo = e.codigo
      LEFT JOIN usuarios u ON c.tecnico_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (edificio_codigo) {
      query += ` AND c.edificio_codigo = $${paramIndex}`;
      params.push(edificio_codigo);
      paramIndex++;
    }

    if (tecnico_id) {
      query += ` AND c.tecnico_id = $${paramIndex}`;
      params.push(parseInt(tecnico_id));
      paramIndex++;
    }

    query += ` ORDER BY c.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM coordenadas WHERE 1=1` +
      (edificio_codigo ? ` AND edificio_codigo = '${edificio_codigo}'` : '') +
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
    console.error('GetAll coordenadas error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, e.nombre as edificio_nombre, u.nombre as tecnico_nombre
       FROM coordenadas c
       LEFT JOIN edificios e ON c.edificio_codigo = e.codigo
       LEFT JOIN usuarios u ON c.tecnico_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coordenada no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('GetById error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getAll, getById };
