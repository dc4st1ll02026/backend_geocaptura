function errorHandler(err, req, res, next) {
  console.error(err.stack);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'El recurso ya existe' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia a recurso inexistente' });
  }

  res.status(500).json({ error: 'Error interno del servidor' });
}

function validationMiddleware(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { errorHandler, validationMiddleware };
