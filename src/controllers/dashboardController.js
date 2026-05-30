const pool = require('../config/database');

async function getResumen(req, res) {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'capturado') as capturados,
        COUNT(*) FILTER (WHERE estado = 'sincronizado') as sincronizados
      FROM edificios
    `);

    const recentActivity = await pool.query(`
      SELECT sl.*, e.nombre as edificio_nombre
      FROM sync_logs sl
      LEFT JOIN edificios e ON sl.edificio_codigo = e.codigo
      ORDER BY sl.created_at DESC
      LIMIT 10
    `);

    const todayCaptures = await pool.query(`
      SELECT COUNT(*) as count
      FROM coordenadas
      WHERE DATE(timestamp) = CURRENT_DATE
    `);

    const stats = statsResult.rows[0];
    const porcentajeAvance = stats.total > 0 
      ? ((parseInt(stats.capturados) + parseInt(stats.sincronizados)) / parseInt(stats.total) * 100).toFixed(1)
      : 0;

    res.json({
      edificios: {
        total: parseInt(stats.total),
        pendientes: parseInt(stats.pendientes),
        capturados: parseInt(stats.capturados),
        sincronizados: parseInt(stats.sincronizados),
        porcentajeAvance: parseFloat(porcentajeAvance),
      },
      capturasHoy: parseInt(todayCaptures.rows[0].count),
      actividadReciente: recentActivity.rows,
    });
  } catch (error) {
    console.error('Resumen error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getActividad(req, res) {
  try {
    const { page = 1, limit = 50, tipo } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT sl.*, e.nombre as edificio_nombre, u.nombre as tecnico_nombre
      FROM sync_logs sl
      LEFT JOIN edificios e ON sl.edificio_codigo = e.codigo
      LEFT JOIN usuarios u ON sl.tecnico_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (tipo) {
      query += ` AND sl.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    query += ` ORDER BY sl.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query('SELECT COUNT(*) FROM sync_logs');

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Actividad error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getPorTecnico(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.username,
        COUNT(DISTINCT e.codigo) as edificios_asignados,
        COUNT(DISTINCT e.codigo) FILTER (WHERE e.estado = 'capturado') as edificios_capturados,
        COUNT(DISTINCT e.codigo) FILTER (WHERE e.estado = 'sincronizado') as edificios_sincronizados,
        COUNT(c.id) as total_coordenadas,
        MAX(c.timestamp) as ultima_captura
      FROM usuarios u
      LEFT JOIN edificios e ON u.id = e.tecnico_id
      LEFT JOIN coordenadas c ON u.id = c.tecnico_id
      WHERE u.rol = 'tecnico'
      GROUP BY u.id, u.nombre, u.username
      ORDER BY total_coordenadas DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('PorTecnico error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getPorEstado(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as cantidad,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as porcentaje
      FROM edificios
      GROUP BY estado
      ORDER BY 
        CASE estado 
          WHEN 'pendiente' THEN 1 
          WHEN 'capturado' THEN 2 
          WHEN 'sincronizado' THEN 3 
        END
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('PorEstado error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getTimeline(req, res) {
  try {
    const { periodo = 'dia' } = req.query;

    let dateFormat;
    switch (periodo) {
      case 'semana':
        dateFormat = 'IYYY-IW';
        break;
      case 'mes':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const result = await pool.query(`
      SELECT 
        TO_CHAR(timestamp, '${dateFormat}') as periodo,
        COUNT(*) as capturas,
        COUNT(DISTINCT edificio_codigo) as edificios_unicos
      FROM coordenadas
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY TO_CHAR(timestamp, '${dateFormat}')
      ORDER BY periodo ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  getResumen,
  getActividad,
  getPorTecnico,
  getPorEstado,
  getTimeline,
};
