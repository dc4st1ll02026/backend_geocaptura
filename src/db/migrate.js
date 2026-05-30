const pool = require('../config/database');

const migrationSQL = `
-- Drop tables if they exist (for re-running migration)
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS coordenadas CASCADE;
DROP TABLE IF EXISTS edificios CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- Usuarios (compartido PWA + Admin Web)
CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre        VARCHAR(100) NOT NULL,
    rol           VARCHAR(20) NOT NULL CHECK (rol IN ('tecnico', 'supervisor', 'admin')),
    activo        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- Edificios
CREATE TABLE edificios (
    codigo              VARCHAR(20) PRIMARY KEY,
    nombre              VARCHAR(200) NOT NULL,
    direccion           VARCHAR(300) NOT NULL,
    estado              VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'capturado', 'sincronizado')),
    lat                 DECIMAL(10, 8),
    lng                 DECIMAL(10, 8),
    accuracy            DECIMAL(6, 2),
    captura_timestamp   TIMESTAMP,
    sync_timestamp      TIMESTAMP,
    tecnico_id          INTEGER REFERENCES usuarios(id),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Historial de coordenadas
CREATE TABLE coordenadas (
    id              SERIAL PRIMARY KEY,
    edificio_codigo VARCHAR(20) REFERENCES edificios(codigo),
    lat             DECIMAL(10, 8) NOT NULL,
    lng             DECIMAL(10, 8) NOT NULL,
    accuracy        DECIMAL(6, 2) NOT NULL,
    timestamp       TIMESTAMP NOT NULL,
    tecnico_id      INTEGER REFERENCES usuarios(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Logs de sincronización
CREATE TABLE sync_logs (
    id              SERIAL PRIMARY KEY,
    tipo            VARCHAR(10) CHECK (tipo IN ('sync', 'error', 'info')),
    mensaje         TEXT NOT NULL,
    exito           BOOLEAN NOT NULL,
    edificio_codigo VARCHAR(20) REFERENCES edificios(codigo),
    tecnico_id      INTEGER REFERENCES usuarios(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Tokens de refresco
CREATE TABLE refresh_tokens (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER REFERENCES usuarios(id),
    token       VARCHAR(500) UNIQUE NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_edificios_estado ON edificios(estado);
CREATE INDEX idx_edificios_tecnico ON edificios(tecnico_id);
CREATE INDEX idx_coordenadas_edificio ON coordenadas(edificio_codigo);
CREATE INDEX idx_coordenadas_tecnico ON coordenadas(tecnico_id);
CREATE INDEX idx_coordenadas_timestamp ON coordenadas(timestamp DESC);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at DESC);
CREATE INDEX idx_sync_logs_tecnico ON sync_logs(tecnico_id);
`;

async function migrate() {
  try {
    await pool.query(migrationSQL);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

migrate();
