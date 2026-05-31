const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { errorHandler } = require('./middleware/validation');
const authRoutes = require('./routes/authRoutes');
const edificiosRoutes = require('./routes/edificiosRoutes');
const coordenadasRoutes = require('./routes/coordenadasRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3001',
    'http://localhost:3000',
    'http://146.190.208.76',
    'http://146.190.208.76:80',
    'https://146.190.208.76',
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/edificios', edificiosRoutes);
app.use('/api/v1/coordenadas', coordenadasRoutes);
app.use('/api/v1/usuarios', usuariosRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
